import { NextRequest, NextResponse, after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { recordSquarePayment, validSignature } from '@/lib/square';
import { loadInvoices } from '@/lib/data';
import { invNo, money, todayStr } from '@/lib/format';
import { notifyAll } from '@/lib/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Square calls this when a payment is made. Subscribe to "payment.created" and "payment.updated".
export async function POST(req: NextRequest) {
  const raw = await req.text();
  // Must be the exact URL entered in Square. Behind Vercel the request URL can differ, so allow an override.
  const url = process.env.SQUARE_WEBHOOK_URL || `${req.headers.get('x-forwarded-proto') || 'https'}://${req.headers.get('x-forwarded-host') || req.headers.get('host')}${req.nextUrl.pathname}`;
  if (!validSignature(raw, req.headers.get('x-square-hmacsha256-signature'), url)) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  }
  let ev: any;
  try { ev = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  if (!/^payment\.(created|updated)$/.test(ev?.type || '')) return NextResponse.json({ ok: true });
  const rec = await recordSquarePayment(ev.data?.object?.payment, todayStr());
  if (rec) {
    revalidatePath('/admin', 'layout');
    after(async () => {
      const [inv] = await loadInvoices({ id: rec.invoice_id });
      await notifyAll({
        title: `Card payment: ${money(rec.amount)}`,
        body: inv ? `${inv.customer_name} paid ${invNo(inv.number)}${inv.balance > 0 ? ` - ${money(inv.balance)} still owed` : ' in full'}` : 'Paid online by card',
        url: `/admin/invoices/${rec.invoice_id}`,
        tag: `pay-${rec.receipt_no}`,
      });
    });
  }
  return NextResponse.json({ ok: true });
}
