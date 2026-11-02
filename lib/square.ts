// Square card payments: a "Pay by card" checkout link per invoice, with the card
// processing fee added as its own line so the customer pays it, and a webhook that
// records the payment on the invoice when Square says it went through.
//
// Vercel environment variables:
//   SQUARE_ACCESS_TOKEN            (required) from developer.squareup.com > your app > Credentials
//   SQUARE_WEBHOOK_SIGNATURE_KEY   (required for automatic recording) from the app's Webhooks page
//   SQUARE_LOCATION_ID             (optional) defaults to your first active location
//   SQUARE_ENVIRONMENT             (optional) "sandbox" for testing; production otherwise
import crypto from 'node:crypto';
import { q } from './db';
import type { Invoice, Settings } from './data';
import { invNo } from './format';

const VERSION = '2024-10-17';
const g = globalThis as any;

export function squareReady() {
  return !!process.env.SQUARE_ACCESS_TOKEN;
}
function base() {
  if (process.env.SQUARE_API_BASE) return process.env.SQUARE_API_BASE; // tests
  return process.env.SQUARE_ENVIRONMENT === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
}
async function api(path: string, init: { method?: string; body?: unknown } = {}) {
  const r = await fetch(base() + path, {
    method: init.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
      'Square-Version': VERSION,
      'Content-Type': 'application/json',
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Square ${r.status}: ${j?.errors?.[0]?.detail || j?.errors?.[0]?.code || 'request failed'}`);
  return j;
}

export async function squareLocation(): Promise<{ id: string; name: string }> {
  if (g.__absSqLoc) return g.__absSqLoc;
  const { locations = [] } = await api('/v2/locations');
  const want = process.env.SQUARE_LOCATION_ID;
  const loc = want ? locations.find((l: any) => l.id === want) : locations.find((l: any) => l.status === 'ACTIVE');
  if (!loc) throw new Error(want ? `Square location ${want} not found` : 'No active Square location');
  g.__absSqLoc = { id: loc.id, name: loc.name };
  return g.__absSqLoc;
}

export function cardEnabled(s: Settings) {
  return s.card_enabled === '1' && squareReady();
}
// Square won't take card payments under $1.
export const canPayByCard = (inv: Invoice, s: Settings) => cardEnabled(s) && inv.balance >= 100 && inv.state !== 'void';

// Fee the customer pays on top of the balance when paying by card.
export function cardFee(balanceCents: number, s: Settings) {
  if (balanceCents <= 0) return 0;
  const pct = Math.max(0, Math.min(10, Number(s.card_fee_pct) || 0));
  const fixed = Math.max(0, Math.round((Number(s.card_fee_fixed) || 0) * 100));
  return Math.round((balanceCents * pct) / 100) + fixed;
}

// Returns a Square checkout URL for the invoice's current balance (reusing one made earlier for the same amount).
export async function cardCheckoutUrl(inv: Invoice, s: Settings, origin: string) {
  const balance = Math.max(0, inv.balance);
  const fee = cardFee(balance, s);
  const [existing] = await q<{ url: string }>(
    `SELECT url FROM card_links WHERE invoice_id=$1 AND base_cents=$2 AND fee_cents=$3 AND created_at > now() - interval '30 days' ORDER BY id DESC LIMIT 1`,
    [inv.id, balance, fee],
  );
  if (existing) return existing.url;
  const loc = await squareLocation();
  const line = (name: string, amount: number) => ({ name, quantity: '1', base_price_money: { amount, currency: 'USD' } });
  const j = await api('/v2/online-checkout/payment-links', {
    method: 'POST',
    body: {
      idempotency_key: crypto.randomUUID(),
      description: `${invNo(inv.number)} - ${inv.customer_name}`,
      order: {
        location_id: loc.id,
        reference_id: invNo(inv.number),
        line_items: [line(`Invoice ${invNo(inv.number)}`, balance), ...(fee > 0 ? [line('Card processing fee', fee)] : [])],
      },
      checkout_options: {
        redirect_url: `${origin}/i/${inv.token}?card=1`,
        ask_for_shipping_address: false,
        accepted_payment_methods: { apple_pay: true, google_pay: true },
      },
      ...(inv.customer_email ? { pre_populated_data: { buyer_email: inv.customer_email } } : {}),
    },
  });
  const pl = j.payment_link;
  await q('INSERT INTO card_links (invoice_id, base_cents, fee_cents, order_id, url) VALUES ($1,$2,$3,$4,$5)', [inv.id, balance, fee, pl.order_id, pl.url]);
  return pl.url as string;
}

// Square signs each webhook: base64(HMAC-SHA256(signature key, notification URL + raw body)).
export function validSignature(rawBody: string, signature: string | null, notificationUrl: string) {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !signature) return false;
  const want = crypto.createHmac('sha256', key).update(notificationUrl + rawBody).digest('base64');
  const a = Buffer.from(want), b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Records a completed Square payment against its invoice. Returns what was recorded, or null if nothing to do.
export async function recordSquarePayment(p: any, today: string) {
  if (!p?.id || p.status !== 'COMPLETED' || !p.order_id) return null;
  const [link] = await q<{ invoice_id: number; base_cents: number; fee_cents: number }>(
    'SELECT invoice_id, base_cents, fee_cents FROM card_links WHERE order_id=$1', [p.order_id],
  );
  if (!link) return null; // a Square payment that didn't come from one of our invoice links
  const total = Number(p.total_money?.amount ?? p.amount_money?.amount ?? 0);
  const amount = Math.max(0, Math.min(link.base_cents, total - link.fee_cents));
  if (amount <= 0) return null;
  const { getSettings } = await import('./data');
  const { receipt_start_no } = await getSettings();
  const card = p.card_details?.card;
  const ref = [card?.card_brand && card?.last_4 ? `${card.card_brand.replace(/_/g, ' ')} ${card.last_4}` : '', `Square ${p.id.slice(-6)}`].filter(Boolean).join(' - ');
  const rows = await q<{ receipt_no: number; invoice_id: number }>(
    `INSERT INTO payments (invoice_id, paid_date, amount_cents, method, reference, note, receipt_no, token, external_id)
     VALUES ($1,$2,$3,'Card',$4,$5,(SELECT GREATEST(COALESCE(MAX(receipt_no), 0) + 1, $7::int) FROM payments),$6,$8)
     ON CONFLICT (external_id) DO NOTHING RETURNING receipt_no, invoice_id`,
    [link.invoice_id, today, amount, ref, link.fee_cents ? `Paid online by card. Card fee of $${(link.fee_cents / 100).toFixed(2)} paid by customer.` : 'Paid online by card.',
      crypto.randomUUID().replace(/-/g, ''), parseInt(receipt_start_no) || 1, p.id],
  );
  return rows[0] ? { ...rows[0], amount } : null; // null = already recorded (Square retries / sends updates)
}
