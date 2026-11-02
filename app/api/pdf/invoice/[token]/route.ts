import { NextRequest } from 'next/server';
import { getSettings, loadInvoices, loadJobs } from '@/lib/data';
import { invoicePdf } from '@/lib/pdf';
import { fmtDate, invNo } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const [inv] = await loadInvoices({ token });
  if (!inv) return new Response('Not found', { status: 404 });
  const s = await getSettings();
  let jobLine: string | undefined;
  if (inv.job_id) {
    const [j] = await loadJobs('WHERE j.id = $1', [inv.job_id]);
    if (j) jobLine = [j.title, fmtDate(j.job_date), j.address].filter(Boolean).join('  |  ');
  }
  const buf = invoicePdf(inv, s, jobLine);
  const dl = req.nextUrl.searchParams.get('download') === '1';
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename="ABS-${invNo(inv.number)}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
