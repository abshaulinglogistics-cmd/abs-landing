'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { q, tx } from './db';
import { SESSION_COOKIE, adminPassword, authEnabled, checkSession, makeSession, safeEqual } from './auth';
import { addDays, toCents, todayStr } from './format';
import { getSettings } from './data';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const num = (f: FormData, k: string) => {
  const n = parseFloat(String(f.get(k) ?? '').replace(/[%,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

async function requireAuth() {
  if (!authEnabled()) return;
  const c = await cookies();
  if (!(await checkSession(c.get(SESSION_COOKIE)?.value))) redirect('/admin/login');
}

// ---------- login ----------
export async function login(f: FormData) {
  const pw = s(f, 'password');
  const next = s(f, 'next');
  const expected = adminPassword();
  if (!expected) redirect('/admin/login?error=setup');
  if (!safeEqual(pw, expected)) {
    await new Promise((r) => setTimeout(r, 600));
    redirect('/admin/login?error=1' + (next ? `&next=${encodeURIComponent(next)}` : ''));
  }
  const c = await cookies();
  c.set(SESSION_COOKIE, await makeSession(30), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86400,
  });
  redirect(next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/admin/login');
}

// ---------- customers ----------
export async function saveCustomer(id: number | null, f: FormData) {
  await requireAuth();
  const name = s(f, 'name');
  if (!name) redirect(id ? `/admin/customers/${id}?error=name` : '/admin/customers/new?error=name');
  const vals = [
    name,
    s(f, 'type') || 'Corporate / Business',
    s(f, 'status') || 'active',
    s(f, 'contact_name'),
    s(f, 'phone'),
    s(f, 'email'),
    s(f, 'address'),
    s(f, 'notes'),
    f.get('partner_rate') === 'on',
    Math.max(0, Math.min(100, num(f, 'default_discount_pct'))),
  ];
  if (id) {
    await q(
      `UPDATE customers SET name=$1, type=$2, status=$3, contact_name=$4, phone=$5, email=$6, address=$7, notes=$8,
         partner_rate=$9, default_discount_pct=$10 WHERE id=$11`,
      [...vals, id],
    );
  } else {
    const r = await q<{ id: number }>(
      `INSERT INTO customers (name, type, status, contact_name, phone, email, address, notes, partner_rate, default_discount_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      vals,
    );
    id = r[0].id;
  }
  revalidatePath('/admin', 'layout');
  redirect(`/admin/customers/${id}?saved=1`);
}

export async function deleteCustomer(id: number) {
  await requireAuth();
  const [{ n }] = await q<{ n: number }>(
    `SELECT ((SELECT COUNT(*) FROM jobs WHERE customer_id=$1) + (SELECT COUNT(*) FROM invoices WHERE customer_id=$1))::int AS n`,
    [id],
  );
  if (n > 0) redirect(`/admin/customers/${id}?error=has-records`);
  await q('DELETE FROM customers WHERE id=$1', [id]);
  revalidatePath('/admin', 'layout');
  redirect('/admin/customers');
}

// ---------- jobs ----------
export async function saveJob(id: number | null, f: FormData) {
  await requireAuth();
  const customer_id = parseInt(s(f, 'customer_id'));
  const title = s(f, 'title');
  const job_date = s(f, 'job_date');
  const back = s(f, 'back') || '/admin/schedule';
  if (!customer_id || !title || !/^\d{4}-\d{2}-\d{2}$/.test(job_date)) redirect(`${back}${back.includes('?') ? '&' : '?'}error=job`);
  const vals = [customer_id, title, job_date, s(f, 'start_time'), s(f, 'address'), s(f, 'status') || 'scheduled', s(f, 'notes')];
  if (id) {
    await q(
      'UPDATE jobs SET customer_id=$1, title=$2, job_date=$3, start_time=$4, address=$5, status=$6, notes=$7 WHERE id=$8',
      [...vals, id],
    );
  } else {
    await q('INSERT INTO jobs (customer_id, title, job_date, start_time, address, status, notes) VALUES ($1,$2,$3,$4,$5,$6,$7)', vals);
  }
  revalidatePath('/admin', 'layout');
  redirect(back);
}

export async function setJobStatus(id: number, status: string, back: string) {
  await requireAuth();
  await q('UPDATE jobs SET status=$1 WHERE id=$2', [status, id]);
  revalidatePath('/admin', 'layout');
  redirect(back);
}

export async function deleteJob(id: number) {
  await requireAuth();
  await q('DELETE FROM jobs WHERE id=$1', [id]);
  revalidatePath('/admin', 'layout');
  redirect('/admin/schedule');
}

// ---------- invoices ----------
export async function saveInvoice(id: number | null, f: FormData) {
  await requireAuth();
  let p: any;
  try {
    p = JSON.parse(s(f, 'payload'));
  } catch {
    redirect(id ? `/admin/invoices/${id}/edit?error=1` : '/admin/invoices/new?error=1');
  }
  const items = (Array.isArray(p.items) ? p.items : [])
    .map((i: any) => ({
      description: String(i.description ?? '').trim(),
      qty: Number(i.qty) || 0,
      unit: String(i.unit ?? ''),
      rate_cents: Math.round(Number(i.rate_cents) || 0),
      std_cents: Math.max(0, Math.round(Number(i.std_cents) || 0)),
      kind: i.kind === 'disposal' ? 'disposal' : 'service',
    }))
    .filter((i: any) => i.description && i.qty !== 0);
  const customer_id = parseInt(p.customer_id);
  if (!customer_id || !items.length) redirect(id ? `/admin/invoices/${id}/edit?error=1` : '/admin/invoices/new?error=1');
  const issue = /^\d{4}-\d{2}-\d{2}$/.test(p.issue_date) ? p.issue_date : todayStr();
  const due = addDays(issue, Math.max(0, parseInt(p.terms_days) || 0));
  const dtype = ['percent', 'flat'].includes(p.discount_type) ? p.discount_type : 'none';
  const dvalue = dtype === 'none' ? 0 : Math.max(0, Number(p.discount_value) || 0);
  const job_id = p.job_id ? parseInt(p.job_id) : null;
  const newNumber = parseInt(p.number) || 0;
  if (id && newNumber > 0) {
    const [clash] = await q('SELECT id FROM invoices WHERE number=$1 AND id<>$2', [newNumber, id]);
    if (clash) redirect(`/admin/invoices/${id}/edit?error=number`);
  }
  const { invoice_start_no } = await getSettings();
  const head = [
    customer_id, job_id, issue, due, dtype, dvalue, String(p.discount_label ?? '').trim(),
    Math.max(0, Number(p.tax_pct) || 0), String(p.notes ?? '').trim(),
  ];

  const invoiceId = await tx(async (query) => {
    let iid = id;
    if (iid) {
      await query(
        `UPDATE invoices SET customer_id=$1, job_id=$2, issue_date=$3, due_date=$4, discount_type=$5, discount_value=$6,
           discount_label=$7, tax_pct=$8, notes=$9 WHERE id=$10`,
        [...head, iid],
      );
      if (newNumber > 0 && newNumber < 1e9) await query('UPDATE invoices SET number=$1 WHERE id=$2', [newNumber, iid]);
      await query('DELETE FROM invoice_items WHERE invoice_id=$1', [iid]);
    } else {
      const r = await query(
        `INSERT INTO invoices (number, customer_id, job_id, issue_date, due_date, discount_type, discount_value, discount_label, tax_pct, notes, token)
         VALUES ((SELECT GREATEST(COALESCE(MAX(number), 0) + 1, $11::int) FROM invoices), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [...head, crypto.randomUUID().replace(/-/g, ''), parseInt(invoice_start_no) || 1],
      );
      iid = r.rows[0].id;
    }
    let pos = 0;
    for (const it of items) {
      await query(
        'INSERT INTO invoice_items (invoice_id, position, description, qty, unit, rate_cents, std_cents, kind) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [iid, pos++, it.description, it.qty, it.unit, it.rate_cents, it.std_cents, it.kind],
      );
    }
    return iid!;
  });
  revalidatePath('/admin', 'layout');
  redirect(`/admin/invoices/${invoiceId}?saved=1`);
}

export async function setInvoiceStatus(id: number, status: 'open' | 'void') {
  await requireAuth();
  await q('UPDATE invoices SET status=$1 WHERE id=$2', [status, id]);
  revalidatePath('/admin', 'layout');
  redirect(`/admin/invoices/${id}`);
}

export async function deleteInvoice(id: number) {
  await requireAuth();
  const [{ n }] = await q<{ n: number }>('SELECT COUNT(*)::int AS n FROM payments WHERE invoice_id=$1', [id]);
  if (n > 0) redirect(`/admin/invoices/${id}?error=has-payments`);
  await q('DELETE FROM invoices WHERE id=$1', [id]);
  revalidatePath('/admin', 'layout');
  redirect('/admin/invoices');
}

// ---------- payments ----------
export async function addPayment(invoiceId: number, f: FormData) {
  await requireAuth();
  const amount = toCents(s(f, 'amount'));
  const date = /^\d{4}-\d{2}-\d{2}$/.test(s(f, 'paid_date')) ? s(f, 'paid_date') : todayStr();
  const method = s(f, 'method') || 'Cash';
  if (amount <= 0) redirect(`/admin/invoices/${invoiceId}?error=amount`);
  const { receipt_start_no } = await getSettings();
  const rno = await tx(async (query) => {
    const r = await query(
      `INSERT INTO payments (invoice_id, paid_date, amount_cents, method, reference, note, receipt_no, token)
       VALUES ($1,$2,$3,$4,$5,$6,(SELECT GREATEST(COALESCE(MAX(receipt_no), 0) + 1, $8::int) FROM payments),$7) RETURNING receipt_no`,
      [invoiceId, date, amount, method, s(f, 'reference'), s(f, 'note'), crypto.randomUUID().replace(/-/g, ''), parseInt(receipt_start_no) || 1],
    );
    return r.rows[0].receipt_no as number;
  });
  revalidatePath('/admin', 'layout');
  redirect(`/admin/invoices/${invoiceId}?receipt=${rno}`);
}

export async function deletePayment(paymentId: number, invoiceId: number) {
  await requireAuth();
  await q('DELETE FROM payments WHERE id=$1', [paymentId]);
  revalidatePath('/admin', 'layout');
  redirect(`/admin/invoices/${invoiceId}`);
}

// ---------- getting paid (Zelle + Square card) ----------
export async function saveGettingPaid(f: FormData) {
  await requireAuth();
  const pct = Math.max(0, Math.min(10, Number(s(f, 'card_fee_pct')) || 0));
  const fixed = Math.max(0, Math.min(5, toCents(s(f, 'card_fee_fixed')) / 100));
  const vals: Record<string, string> = {
    zelle_to: s(f, 'zelle_to'),
    zelle_name: s(f, 'zelle_name'),
    card_enabled: f.get('card_enabled') === 'on' ? '1' : '',
    card_fee_pct: String(pct),
    card_fee_fixed: fixed.toFixed(2),
  };
  for (const [k, v] of Object.entries(vals)) {
    await q('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
  }
  revalidatePath('/admin', 'layout');
  redirect('/admin/settings?saved=1#getpaid');
}

export async function saveDayRate(f: FormData) {
  await requireAuth();
  const vals: Record<string, string> = {
    day_std: (toCents(s(f, 'day_std')) / 100).toFixed(2),
    day_partner: (toCents(s(f, 'day_partner')) / 100).toFixed(2),
    day_loads: String(Math.max(0, Math.min(99, parseInt(s(f, 'day_loads')) || 0))),
    day_extra_std: (toCents(s(f, 'day_extra_std')) / 100).toFixed(2),
    day_extra_partner: (toCents(s(f, 'day_extra_partner')) / 100).toFixed(2),
  };
  for (const [k, v] of Object.entries(vals)) {
    await q('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
  }
  revalidatePath('/admin', 'layout');
  redirect('/admin/settings?saved=1#dayrate');
}

// ---------- settings & rate card ----------
export async function saveSettings(f: FormData) {
  await requireAuth();
  const keys = [
    'business_name', 'owner_name', 'phone', 'email', 'address', 'website', 'tagline',
    'payment_instructions', 'invoice_footer', 'default_terms_days', 'default_tax_pct',
  ];
  for (const k of ['invoice_start_no', 'receipt_start_no']) {
    const n = parseInt(s(f, k));
    if (n > 0 && n < 1e9) keys.push(k);
  }
  for (const k of keys) {
    await q('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, s(f, k)]);
  }
  revalidatePath('/admin', 'layout');
  redirect('/admin/settings?saved=1');
}

export async function saveService(id: number | null, f: FormData) {
  await requireAuth();
  const name = s(f, 'name');
  if (!name) redirect('/admin/settings?error=service#rates');
  const vals = [
    name, s(f, 'description'), s(f, 'unit') || 'each', s(f, 'kind') === 'disposal' ? 'disposal' : 'service',
    toCents(s(f, 'std')), toCents(s(f, 'partner')), f.get('active') === 'on',
  ];
  if (id) {
    await q(
      'UPDATE services SET name=$1, description=$2, unit=$3, kind=$4, std_cents=$5, partner_cents=$6, active=$7 WHERE id=$8',
      [...vals, id],
    );
  } else {
    await q(
      `INSERT INTO services (name, description, unit, kind, std_cents, partner_cents, active, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,(SELECT COALESCE(MAX(sort),0)+1 FROM services))`,
      vals,
    );
  }
  revalidatePath('/admin', 'layout');
  redirect('/admin/settings?saved=1#rates');
}

export async function deleteService(id: number) {
  await requireAuth();
  await q('DELETE FROM services WHERE id=$1', [id]);
  revalidatePath('/admin', 'layout');
  redirect('/admin/settings#rates');
}

// ---------- online bookings ----------
const digitsOnly = (v: string) => (v || '').replace(/\D/g, '');

export async function confirmBooking(id: number) {
  await requireAuth();
  const [b] = await q<any>('SELECT * FROM bookings WHERE id=$1', [id]);
  if (!b || b.status !== 'requested') redirect('/admin/bookings');

  // Reuse an existing customer when the phone or email matches, otherwise create one.
  const people = await q<any>('SELECT id, phone, email FROM customers');
  const ph = digitsOnly(b.phone);
  const em = (b.email || '').toLowerCase();
  const match = people.find((c: any) => (ph.length >= 10 && digitsOnly(c.phone).endsWith(ph.slice(-10))) || (em && (c.email || '').toLowerCase() === em));

  const jobId = await tx(async (query) => {
    let customerId: number = match?.id;
    if (!customerId) {
      const r = await query(
        `INSERT INTO customers (name, type, status, contact_name, phone, email, address, notes)
         VALUES ($1,$2,'active',$3,$4,$5,$6,$7) RETURNING id`,
        [b.company || b.name, b.company ? 'Corporate / Business' : 'Residential', b.company ? b.name : '', b.phone, b.email || '', b.address, 'Booked online'],
      );
      customerId = r.rows[0].id;
    }
    const title = `${b.service}${b.size ? ` (${b.size})` : ''}`;
    const notes = [b.notes, `Booked online (BK-${1000 + b.id})`].filter(Boolean).join('\n');
    const j = await query(
      `INSERT INTO jobs (customer_id, title, job_date, start_time, address, status, notes)
       VALUES ($1,$2,$3,$4,$5,'scheduled',$6) RETURNING id`,
      [customerId, title, b.booking_date, b.booking_time, b.address, notes],
    );
    await query(`UPDATE bookings SET status='confirmed', customer_id=$1, job_id=$2 WHERE id=$3`, [customerId, j.rows[0].id, id]);
    return j.rows[0].id as number;
  });
  revalidatePath('/admin', 'layout');
  redirect(`/admin/bookings?confirmed=${jobId}`);
}

export async function declineBooking(id: number) {
  await requireAuth();
  await q(`UPDATE bookings SET status='declined' WHERE id=$1 AND status='requested'`, [id]);
  revalidatePath('/admin', 'layout');
  redirect('/admin/bookings');
}

export async function cancelBooking(id: number) {
  await requireAuth();
  const [b] = await q<any>('SELECT job_id FROM bookings WHERE id=$1', [id]);
  await q(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [id]);
  if (b?.job_id) await q(`UPDATE jobs SET status='cancelled' WHERE id=$1 AND status IN ('scheduled','in_progress')`, [b.job_id]);
  revalidatePath('/admin', 'layout');
  redirect('/admin/bookings');
}

export async function saveBookingSettings(f: FormData) {
  await requireAuth();
  const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => f.get(`day_${d}`) === 'on').join(',');
  const clampInt = (k: string, lo: number, hi: number, dflt: number) => {
    const n = parseInt(s(f, k));
    return String(Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt);
  };
  const time = (k: string, dflt: string) => (/^\d{2}:\d{2}$/.test(s(f, k)) ? s(f, k) : dflt);
  const blocked = s(f, 'book_blocked').split(/[\s,;]+/).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).join(', ');
  const rows: [string, string][] = [
    ['book_days', days],
    ['book_start', time('book_start', '08:00')],
    ['book_end', time('book_end', '17:00')],
    ['book_slot_minutes', clampInt('book_slot_minutes', 15, 240, 60)],
    ['book_hold_minutes', clampInt('book_hold_minutes', 15, 480, 120)],
    ['book_notice_hours', clampInt('book_notice_hours', 0, 72, 3)],
    ['book_max_days', clampInt('book_max_days', 1, 180, 45)],
    ['book_blocked', blocked],
  ];
  for (const [k, v] of rows) {
    await q('INSERT INTO settings (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [k, v]);
  }
  revalidatePath('/admin', 'layout');
  redirect('/admin/settings?saved=1#booking');
}

// ---------- phone notifications ----------
export async function pushPublicKey() {
  await requireAuth();
  const { vapidKeys } = await import('./push');
  return (await vapidKeys()).publicKey;
}

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, device: string) {
  await requireAuth();
  if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error('Bad subscription');
  await q(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, device) VALUES ($1,$2,$3,$4)
     ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, device = EXCLUDED.device`,
    [sub.endpoint, sub.keys.p256dh, sub.keys.auth, String(device || '').slice(0, 80)],
  );
  revalidatePath('/admin/settings');
}

export async function removePushSubscription(endpoint: string) {
  await requireAuth();
  await q('DELETE FROM push_subscriptions WHERE endpoint=$1', [endpoint]);
  revalidatePath('/admin/settings');
}

export async function removePushDevice(id: number) {
  await requireAuth();
  await q('DELETE FROM push_subscriptions WHERE id=$1', [id]);
  revalidatePath('/admin/settings');
  redirect('/admin/settings#notify');
}

export async function sendTestPush() {
  await requireAuth();
  const { notifyAll } = await import('./push');
  return notifyAll({ title: 'ABS Admin', body: 'Notifications are working. You will get one for each new booking request.', url: '/admin/bookings', tag: 'test' });
}
