import { headers } from 'next/headers';
import { q } from './db';
import { totals, Totals } from './calc';
import { diffDays, todayStr } from './format';

// ---------- settings ----------
export const SETTING_DEFAULTS = {
  business_name: 'ABS Hauling & Logistics',
  owner_name: 'Anthony Britt',
  phone: '404-740-9500',
  email: 'abshaulinglogistics@gmail.com',
  address: 'South Fulton, GA',
  website: 'abshaulinglogistics.netlify.app',
  tagline: 'We Make Things Better',
  payment_instructions: 'We accept cash, card, Zelle and check. Questions about paying? Call or text us.',
  invoice_footer: 'Dump and disposal fees are passed through at cost. Thank you for your business.',
  default_terms_days: '0',
  default_tax_pct: '0',
};
export type Settings = typeof SETTING_DEFAULTS;

export async function getSettings(): Promise<Settings> {
  const rows = await q<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: any = { ...SETTING_DEFAULTS };
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out;
}

export async function getOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

// ---------- types ----------
export type Item = { id?: number; description: string; qty: number; unit: string; rate_cents: number; kind: string };
export type Payment = {
  id: number;
  invoice_id: number;
  paid_date: string;
  amount_cents: number;
  method: string;
  reference: string;
  note: string;
  receipt_no: number;
  token: string;
};
export type InvoiceState = 'paid' | 'partial' | 'open' | 'overdue' | 'void';
export type Invoice = {
  id: number;
  number: number;
  customer_id: number;
  job_id: number | null;
  issue_date: string;
  due_date: string;
  discount_type: string;
  discount_value: number;
  discount_label: string;
  tax_pct: number;
  notes: string;
  status: string;
  token: string;
  customer_name: string;
  customer_contact: string;
  customer_email: string;
  customer_phone: string;
  customer_address: string;
  items: Item[];
  payments: Payment[];
  t: Totals;
  paid: number;
  balance: number;
  state: InvoiceState;
};

export async function loadInvoices(f: { id?: number; token?: string; customerId?: number } = {}): Promise<Invoice[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (f.id) { params.push(f.id); where.push(`i.id = $${params.length}`); }
  if (f.token) { params.push(f.token); where.push(`i.token = $${params.length}`); }
  if (f.customerId) { params.push(f.customerId); where.push(`i.customer_id = $${params.length}`); }
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const invs = await q<any>(
    `SELECT i.*, c.name AS customer_name, c.contact_name AS customer_contact, c.email AS customer_email,
            c.phone AS customer_phone, c.address AS customer_address
     FROM invoices i JOIN customers c ON c.id = i.customer_id ${w} ORDER BY i.number DESC`,
    params,
  );
  if (!invs.length) return [];
  const ids = invs.map((i) => i.id);
  const items = await q<any>('SELECT * FROM invoice_items WHERE invoice_id = ANY($1::int[]) ORDER BY position, id', [ids]);
  const pays = await q<any>('SELECT * FROM payments WHERE invoice_id = ANY($1::int[]) ORDER BY paid_date, id', [ids]);
  const today = todayStr();
  return invs.map((i) => {
    const its: Item[] = items.filter((x) => x.invoice_id === i.id);
    const ps: Payment[] = pays.filter((x) => x.invoice_id === i.id);
    const t = totals(its, { type: i.discount_type, value: i.discount_value }, i.tax_pct);
    const paid = ps.reduce((a, p) => a + p.amount_cents, 0);
    const balance = t.total - paid;
    let state: InvoiceState = 'open';
    if (i.status === 'void') state = 'void';
    else if (balance <= 0 && t.total > 0) state = 'paid';
    else if (paid > 0) state = i.due_date < today ? 'overdue' : 'partial';
    else if (i.due_date < today) state = 'overdue';
    return { ...i, items: its, payments: ps, t, paid, balance, state };
  });
}

// ---------- customers ----------
export type Customer = {
  id: number;
  name: string;
  type: string;
  status: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  partner_rate: boolean;
  default_discount_pct: number;
  billed: number;
  paid: number;
  outstanding: number;
  invoiceCount: number;
  jobsDone: number;
  lastActivity: string | null;
  nextJob: string | null;
  corporate: boolean;
  repeat: boolean;
  dormant: boolean;
  daysQuiet: number | null;
};

export const isCorporate = (type: string) => type !== 'Residential';

export async function loadCustomers(onlyId?: number): Promise<Customer[]> {
  const rows = await q<any>(`SELECT * FROM customers ${onlyId ? 'WHERE id = $1' : ''} ORDER BY lower(name)`, onlyId ? [onlyId] : []);
  const invs = (await loadInvoices(onlyId ? { customerId: onlyId } : {})).filter((i) => i.state !== 'void');
  const today = todayStr();
  const jobs = await q<any>(
    `SELECT customer_id,
       COUNT(*) FILTER (WHERE status = 'done')::int AS done,
       MAX(job_date) FILTER (WHERE status = 'done') AS last_done,
       MIN(job_date) FILTER (WHERE status IN ('scheduled','in_progress') AND job_date >= $1) AS next_job
     FROM jobs GROUP BY customer_id`,
    [today],
  );
  return rows.map((c) => {
    const mine = invs.filter((i) => i.customer_id === c.id);
    const j = jobs.find((x) => x.customer_id === c.id);
    const dates = [j?.last_done, ...mine.map((i) => i.issue_date)].filter(Boolean) as string[];
    const lastActivity = dates.length ? dates.sort().at(-1)! : null;
    const billed = mine.reduce((a, i) => a + i.t.total, 0);
    const paid = mine.reduce((a, i) => a + i.paid, 0);
    const jobsDone = j?.done ?? 0;
    const repeat = jobsDone >= 2 || mine.length >= 2;
    const daysQuiet = lastActivity ? diffDays(today, lastActivity) : null;
    const corporate = isCorporate(c.type);
    return {
      ...c,
      billed,
      paid,
      outstanding: mine.reduce((a, i) => a + Math.max(0, i.balance), 0),
      invoiceCount: mine.length,
      jobsDone,
      lastActivity,
      nextJob: j?.next_job ?? null,
      corporate,
      repeat,
      dormant: c.status !== 'prospect' && c.status !== 'inactive' && daysQuiet !== null && daysQuiet > 45 && (repeat || corporate),
      daysQuiet,
    };
  });
}

// ---------- jobs ----------
export type Job = {
  id: number;
  customer_id: number;
  customer_name: string;
  title: string;
  job_date: string;
  start_time: string;
  address: string;
  status: string;
  notes: string;
  invoice_id: number | null;
  invoice_number: number | null;
};

export async function loadJobs(where = '', params: any[] = [], order = 'j.job_date, j.start_time, j.id', limit = 500): Promise<Job[]> {
  return q<Job>(
    `SELECT j.*, c.name AS customer_name,
       (SELECT id FROM invoices i WHERE i.job_id = j.id AND i.status <> 'void' ORDER BY i.id LIMIT 1) AS invoice_id,
       (SELECT number FROM invoices i WHERE i.job_id = j.id AND i.status <> 'void' ORDER BY i.id LIMIT 1) AS invoice_number
     FROM jobs j JOIN customers c ON c.id = j.customer_id ${where} ORDER BY ${order} LIMIT ${limit}`,
    params,
  );
}

export type Service = {
  id: number;
  name: string;
  description: string;
  unit: string;
  kind: string;
  std_cents: number;
  partner_cents: number;
  sort: number;
  active: boolean;
};
export const loadServices = (activeOnly = false) =>
  q<Service>(`SELECT * FROM services ${activeOnly ? 'WHERE active' : ''} ORDER BY sort, id`);
