import { q } from './db';
import { addDays, todayStr, TZ } from './format';

export const SERVICES = [
  'Junk Removal',
  'Trash Service',
  'Pickup & Delivery',
  'Demolition',
  'Movers (loading / unloading)',
  'Hauling',
  'Not sure, I need a quote',
];
export const SIZES = [
  'A few items',
  'Quarter load',
  'Half load',
  'Full load',
  'Not sure',
];

export const BOOKING_DEFAULTS = {
  book_days: '1,2,3,4,5,6', // 0 = Sunday ... 6 = Saturday
  book_start: '08:00',
  book_end: '16:00', // last start time
  book_slot_minutes: '60',
  book_hold_minutes: '120',
  book_notice_hours: '3',
  book_max_days: '45',
  book_blocked: '',
};
export type BookingSettings = typeof BOOKING_DEFAULTS;

export async function getBookingSettings(): Promise<BookingSettings> {
  const rows = await q<{ key: string; value: string }>(`SELECT key, value FROM settings WHERE key LIKE 'book\\_%'`);
  const out: any = { ...BOOKING_DEFAULTS };
  for (const r of rows) if (r.key in out) out[r.key] = r.value;
  return out;
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const fromMin = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function nowNY() {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
  const h = Number(p.find((x) => x.type === 'hour')!.value) % 24;
  const m = Number(p.find((x) => x.type === 'minute')!.value);
  return h * 60 + m;
}

const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay();

export function blockedSet(s: BookingSettings) {
  return new Set(
    s.book_blocked
      .split(/[\s,;]+/)
      .map((x) => x.trim())
      .filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)),
  );
}

// Available start times for every date in a month, keyed by YYYY-MM-DD.
export async function getAvailability(month: string): Promise<Record<string, string[]>> {
  const s = await getBookingSettings();
  const today = todayStr();
  const last = addDays(today, Math.max(1, Number(s.book_max_days) || 45));
  const first = `${month}-01`;
  const days: string[] = [];
  for (let d = first; d.startsWith(month); d = addDays(d, 1)) {
    if (d >= today && d <= last) days.push(d);
  }
  if (!days.length) return {};
  const lo = days[0], hi = days[days.length - 1];

  const [bk, jb] = await Promise.all([
    q<{ booking_date: string; booking_time: string }>(
      `SELECT booking_date, booking_time FROM bookings WHERE status IN ('requested','confirmed') AND booking_date >= $1 AND booking_date <= $2`,
      [lo, hi],
    ),
    q<{ job_date: string; start_time: string }>(
      `SELECT job_date, start_time FROM jobs WHERE status IN ('scheduled','in_progress') AND start_time <> '' AND job_date >= $1 AND job_date <= $2`,
      [lo, hi],
    ),
  ]);
  const hold = Math.max(15, Number(s.book_hold_minutes) || 120);
  const step = Math.max(15, Number(s.book_slot_minutes) || 60);
  const busy = new Map<string, number[]>();
  for (const b of bk) (busy.get(b.booking_date) ?? busy.set(b.booking_date, []).get(b.booking_date)!).push(toMin(b.booking_time));
  for (const j of jb) (busy.get(j.job_date) ?? busy.set(j.job_date, []).get(j.job_date)!).push(toMin(j.start_time));

  const open = new Set(s.book_days.split(',').map(Number));
  const blocked = blockedSet(s);
  const start = toMin(s.book_start), end = toMin(s.book_end);
  const earliestToday = nowNY() + (Number(s.book_notice_hours) || 0) * 60;
  const out: Record<string, string[]> = {};
  for (const d of days) {
    if (!open.has(dow(d)) || blocked.has(d)) continue;
    const taken = busy.get(d) ?? [];
    const times: string[] = [];
    for (let t = start; t <= end; t += step) {
      if (d === today && t < earliestToday) continue;
      // Overlap check: an existing item holds [x, x + hold); this slot holds [t, t + hold).
      if (taken.some((x) => t < x + hold && x < t + hold)) continue;
      times.push(fromMin(t));
    }
    if (times.length) out[d] = times;
  }
  return out;
}

export const bookingRef = (id: number) => `BK-${1000 + id}`;
