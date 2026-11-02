import { NextRequest, NextResponse, after } from 'next/server';
import { notifyAll } from '@/lib/push';
import { q } from '@/lib/db';
import { bookingRef, getAvailability, SERVICES, SIZES } from '@/lib/booking';
import { fmtDate, fmtTime } from '@/lib/format';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > 6;
}

const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

export async function POST(req: NextRequest) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (b.website) return NextResponse.json({ ok: true }); // honeypot: bots fill this in, people never see it
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (limited(ip)) return NextResponse.json({ error: 'Too many requests. Please call or text 404-740-9500.' }, { status: 429 });

  const name = clean(b.name, 80);
  const phone = clean(b.phone, 30);
  const email = clean(b.email, 120);
  const address = clean(b.address, 200);
  const company = clean(b.company, 100);
  const notes = String(b.notes ?? '').trim().slice(0, 1000);
  const service = SERVICES.includes(b.service) ? b.service : '';
  const size = SIZES.includes(b.size) ? b.size : '';
  const date = clean(b.date, 10);
  const time = clean(b.time, 5);

  const digits = phone.replace(/\D/g, '');
  const problems: string[] = [];
  if (!name) problems.push('your name');
  if (digits.length < 10) problems.push('a phone number we can reach you at');
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) problems.push('a valid email (or leave it blank)');
  if (!address) problems.push('the job address');
  if (!service) problems.push('the service you need');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) problems.push('a date and time');
  if (problems.length) return NextResponse.json({ error: `Please add ${problems.join(', ')}.` }, { status: 400 });

  const avail = await getAvailability(date.slice(0, 7));
  if (!avail[date]?.includes(time)) {
    return NextResponse.json({ error: 'That time is no longer available. Please pick another.', stale: true }, { status: 409 });
  }

  const [{ n }] = await q<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM bookings WHERE status = 'requested' AND (regexp_replace(phone, '\\D', '', 'g') = $1 OR ($2 <> '' AND lower(email) = lower($2)))`,
    [digits, email],
  );
  if (n >= 3) return NextResponse.json({ error: 'You already have pending requests with us. We will be in touch shortly, or call 404-740-9500.' }, { status: 429 });

  try {
    const rows = await q<{ id: number }>(
      `INSERT INTO bookings (token, service, size, booking_date, booking_time, name, company, phone, email, address, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [crypto.randomUUID().replace(/-/g, ''), service, size, date, time, name, company, phone, email, address, notes],
    );
    const ref = bookingRef(rows[0].id);
    // Ping the owners' phones after the customer gets their answer.
    after(() =>
      notifyAll({
        title: `New booking: ${service}${size ? ` (${size})` : ''}`,
        body: `${company || name} - ${fmtDate(date)} at ${fmtTime(time)}\n${address}`,
        url: '/admin/bookings',
        tag: ref,
      }),
    );
    return NextResponse.json({
      ok: true,
      ref,
      when: `${fmtDate(date)} at ${fmtTime(time)}`,
    });
  } catch (e: any) {
    if (e?.code === '23505' || /unique/i.test(String(e?.message))) {
      return NextResponse.json({ error: 'That time was just taken. Please pick another.', stale: true }, { status: 409 });
    }
    throw e;
  }
}
