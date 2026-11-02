import { NextRequest, NextResponse } from 'next/server';
import { getOrigin, getSettings, loadInvoices } from '@/lib/data';
import { canPayByCard, cardCheckoutUrl } from '@/lib/square';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// "Pay by card" button on the customer's invoice page posts here; we send them to Square checkout.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const [inv] = await loadInvoices({ token });
  if (!inv) return new Response('Not found', { status: 404 });
  const origin = await getOrigin();
  const back = `${origin}/i/${token}`;
  const s = await getSettings();
  if (!canPayByCard(inv, s)) return NextResponse.redirect(back, 303);
  try {
    return NextResponse.redirect(await cardCheckoutUrl(inv, s, origin), 303);
  } catch (e) {
    console.error('square checkout failed', e);
    return NextResponse.redirect(`${back}?card=error`, 303);
  }
}
