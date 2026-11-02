import { NextRequest } from 'next/server';
import { getSettings, loadInvoices } from '@/lib/data';
import { q } from '@/lib/db';
import { receiptPdf } from '@/lib/pdf';
import { rctNo } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const [row] = await q<{ invoice_id: number }>('SELECT invoice_id FROM payments WHERE token = $1', [token]);
  if (!row) return new Response('Not found', { status: 404 });
  const [inv] = await loadInvoices({ id: row.invoice_id });
  const pay = inv?.payments.find((p) => p.token === token);
  if (!inv || !pay) return new Response('Not found', { status: 404 });
  const buf = receiptPdf(inv, pay, await getSettings());
  const dl = req.nextUrl.searchParams.get('download') === '1';
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="ABS-${rctNo(pay.receipt_no)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
