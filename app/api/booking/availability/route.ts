import { NextRequest, NextResponse } from 'next/server';
import { getAvailability } from '@/lib/booking';
import { getBookingSettings } from '@/lib/booking';
import { todayStr } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const month = req.nextUrl.searchParams.get('month') || todayStr().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return NextResponse.json({ error: 'bad month' }, { status: 400 });
  const [days, s] = await Promise.all([getAvailability(month), getBookingSettings()]);
  return NextResponse.json(
    { month, today: todayStr(), maxDays: Number(s.book_max_days) || 45, days },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
