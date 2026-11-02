import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, authEnabled, checkSession } from '@/lib/auth';
import { loadPayments, periodRange } from '@/lib/data';
import { invNo, rctNo, todayStr } from '@/lib/format';

// CSV of payments for the chosen period (and method), for bookkeeping or taxes.
export async function GET(req: NextRequest) {
  if (authEnabled() && !(await checkSession((await cookies()).get(SESSION_COOKIE)?.value))) {
    return new Response('Not logged in', { status: 401 });
  }
  const period = req.nextUrl.searchParams.get('period') || 'month';
  const method = req.nextUrl.searchParams.get('method') || '';
  const r = periodRange(period);
  const rows = (await loadPayments(r.from, r.to)).filter((p) => !method || p.method === method);
  const cell = (v: unknown) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // keep spreadsheet apps from treating text as a formula
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ['Date', 'Receipt', 'Invoice', 'Customer', 'Method', 'Reference', 'Note', 'Amount'],
    ...rows.map((p) => [p.paid_date, rctNo(p.receipt_no), invNo(p.invoice_number), p.customer_name, p.method, p.reference, p.note, (p.amount_cents / 100).toFixed(2)]),
  ].map((l) => l.map(cell).join(','));
  const name = `abs-payments-${period}${method ? '-' + method.toLowerCase().replace(/\W+/g, '-') : ''}-${todayStr()}.csv`;
  return new Response(lines.join('\r\n') + '\r\n', {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"` },
  });
}
