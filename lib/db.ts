import { Pool } from 'pg';

type QFn = (sql: string, params?: any[]) => Promise<{ rows: any[] }>;
type Conn = { query: QFn; tx: <T>(fn: (q: QFn) => Promise<T>) => Promise<T> };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'Corporate / Business',
    status TEXT NOT NULL DEFAULT 'active',
    contact_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    address TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    partner_rate BOOLEAN NOT NULL DEFAULT FALSE,
    default_discount_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    unit TEXT NOT NULL DEFAULT 'each',
    kind TEXT NOT NULL DEFAULT 'service',
    std_cents INT NOT NULL DEFAULT 0,
    partner_cents INT NOT NULL DEFAULT 0,
    sort INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
  )`,
  `CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    title TEXT NOT NULL,
    job_date TEXT NOT NULL,
    start_time TEXT DEFAULT '',
    address TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'scheduled',
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    number INT NOT NULL UNIQUE,
    customer_id INT NOT NULL REFERENCES customers(id),
    job_id INT REFERENCES jobs(id) ON DELETE SET NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'none',
    discount_value DOUBLE PRECISION NOT NULL DEFAULT 0,
    discount_label TEXT DEFAULT '',
    tax_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    notes TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open',
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position INT NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    qty DOUBLE PRECISION NOT NULL DEFAULT 1,
    unit TEXT DEFAULT '',
    rate_cents INT NOT NULL DEFAULT 0,
    std_cents INT NOT NULL DEFAULT 0,
    kind TEXT NOT NULL DEFAULT 'service'
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    paid_date TEXT NOT NULL,
    amount_cents INT NOT NULL,
    method TEXT NOT NULL,
    reference TEXT DEFAULT '',
    note TEXT DEFAULT '',
    receipt_no INT NOT NULL UNIQUE,
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'requested',
    service TEXT NOT NULL,
    size TEXT DEFAULT '',
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    name TEXT NOT NULL,
    company TEXT DEFAULT '',
    phone TEXT NOT NULL,
    email TEXT DEFAULT '',
    address TEXT NOT NULL,
    notes TEXT DEFAULT '',
    customer_id INT REFERENCES customers(id) ON DELETE SET NULL,
    job_id INT REFERENCES jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // std_cents = the standard price when a line was billed at the Preferred Partner rate (0 = not a partner line).
  `ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS std_cents INT NOT NULL DEFAULT 0`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    device TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  // Square card payments: one row per checkout link we hand a customer.
  `CREATE TABLE IF NOT EXISTS card_links (
    id SERIAL PRIMARY KEY,
    invoice_id INT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    base_cents INT NOT NULL,
    fee_cents INT NOT NULL,
    order_id TEXT NOT NULL UNIQUE,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `ALTER TABLE payments ADD COLUMN IF NOT EXISTS external_id TEXT`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_external ON payments(external_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_slot ON bookings(booking_date, booking_time) WHERE status IN ('requested','confirmed')`,
  `CREATE INDEX IF NOT EXISTS idx_booking_date ON bookings(booking_date)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_date ON jobs(job_date)`,
  `CREATE INDEX IF NOT EXISTS idx_inv_customer ON invoices(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id)`,
  `CREATE INDEX IF NOT EXISTS idx_pay_invoice ON payments(invoice_id)`,
];

// Starting rate card, taken from the ABS proposal. Editable in Settings.
// std = standard rate, partner = Preferred Partner rate. Ranges from the proposal
// are shown in the description; the price is the midpoint.
const SEED_SERVICES: [string, string, string, string, number, number][] = [
  ['Minimum Service Call', 'Trip charge + first 15 min on-site', 'call', 'service', 9500, 8000],
  ['Quarter Load (bed only)', 'Typical $165-$195 (partner $140-$165). 1-2 furniture pieces / small cleanout', 'load', 'service', 18000, 15000],
  ['Half Load (bed + partial trailer)', 'Typical $250-$300 (partner $215-$255). Studio/1BR cleanout, small demo debris', 'load', 'service', 27500, 23500],
  ['Full Load (bed + full trailer)', 'Typical $425-$500 (partner $365-$425). 2-3BR cleanout, full demo debris load', 'load', 'service', 46000, 39500],
  ['Demolition Labor', 'Per laborer. Interior tear-out, sheds, decks', 'hr', 'service', 7000, 6000],
  ['Pickup & Delivery: base', 'Base charge per local trip', 'trip', 'service', 5000, 4000],
  ['Pickup & Delivery: mileage', 'Round-trip miles from pickup to drop-off', 'mile', 'service', 125, 105],
  ['Moving Support Labor', 'Per mover. 2-hour minimum, loading/unloading only', 'hr', 'service', 6000, 5000],
  ['Dump / Landfill Fee (at cost)', 'Disposal passed through at cost. Enter the actual amount', 'each', 'disposal', 0, 0],
];

const g = globalThis as any;

async function connect(): Promise<Conn> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    const pool = new Pool({
      connectionString: url,
      ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
      max: 5,
    });
    return {
      query: (sql, params) => pool.query(sql, params) as any,
      tx: async (fn) => {
        const c = await pool.connect();
        try {
          await c.query('BEGIN');
          const r = await fn((sql, params) => c.query(sql, params) as any);
          await c.query('COMMIT');
          return r;
        } catch (e) {
          await c.query('ROLLBACK').catch(() => {});
          throw e;
        } finally {
          c.release();
        }
      },
    };
  }
  if ((process.env.VERCEL || process.env.NODE_ENV === 'production') && !process.env.LOCAL_DB_DIR) {
    throw new Error('DATABASE_URL is not set. In Vercel, open Storage, add a Postgres database (Neon) and connect it to this project, then redeploy.');
  }
  // Local development without a database URL: a file-based Postgres (PGlite).
  const mod = '@electric-sql/pglite';
  const { PGlite } = await import(/* webpackIgnore: true */ mod);
  const dir = process.env.LOCAL_DB_DIR || '.data/pglite';
  const fs = 'node:fs';
  (await import(/* webpackIgnore: true */ fs)).mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.waitReady;
  return {
    query: (sql, params) => db.query(sql, params),
    tx: (fn) => db.transaction((t: any) => fn((sql, params) => t.query(sql, params))),
  };
}

async function init(): Promise<Conn> {
  const conn = await connect();
  for (const stmt of SCHEMA) await conn.query(stmt);
  const { rows } = await conn.query('SELECT COUNT(*)::int AS n FROM services');
  if (rows[0].n === 0) {
    let i = 0;
    for (const [name, desc, unit, kind, std, partner] of SEED_SERVICES) {
      await conn.query(
        'INSERT INTO services (name, description, unit, kind, std_cents, partner_cents, sort) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [name, desc, unit, kind, std, partner, ++i],
      );
    }
  }
  return conn;
}

function ready(): Promise<Conn> {
  if (!g.__absDb) {
    g.__absDb = init().catch((e) => {
      g.__absDb = null;
      throw e;
    });
  }
  return g.__absDb;
}

export async function q<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const c = await ready();
  const r = await c.query(sql, params);
  return r.rows as T[];
}

export async function tx<T>(fn: (q: QFn) => Promise<T>): Promise<T> {
  const c = await ready();
  return c.tx(fn);
}
