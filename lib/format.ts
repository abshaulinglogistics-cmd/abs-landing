export const TZ = 'America/New_York';

export function money(cents: number) {
  const n = (cents || 0) / 100;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function toCents(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? '').replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function todayStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

function parts(d: string) {
  const [y, m, day] = d.split('-').map(Number);
  return { y, m, day };
}

export function addDays(d: string, n: number) {
  const { y, m, day } = parts(d);
  const dt = new Date(Date.UTC(y, m - 1, day + n));
  return dt.toISOString().slice(0, 10);
}

export function diffDays(a: string, b: string) {
  const A = parts(a), B = parts(b);
  return Math.round((Date.UTC(A.y, A.m - 1, A.day) - Date.UTC(B.y, B.m - 1, B.day)) / 864e5);
}

export function mondayOf(d: string) {
  const { y, m, day } = parts(d);
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay(); // 0 = Sun
  return addDays(d, dow === 0 ? -6 : 1 - dow);
}

export function fmtDate(d?: string | null, withYear = true) {
  if (!d) return '';
  const { y, m, day } = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: withYear ? 'numeric' : undefined,
    timeZone: 'UTC',
  });
}

export function fmtDow(d: string) {
  const { y, m, day } = parts(d);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

export function fmtTime(t?: string | null) {
  if (!t) return '';
  const [h, mi] = t.split(':').map(Number);
  if (Number.isNaN(h)) return t;
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(mi || 0).padStart(2, '0')} ${ap}`;
}

export function fmtQty(q: number) {
  return Number.isInteger(q) ? String(q) : String(Math.round(q * 100) / 100);
}

export const invNo = (n: number) => `INV-${n}`;
export const rctNo = (n: number) => `RCT-${n}`;

export const METHODS = ['Cash', 'Zelle', 'Cash App', 'Venmo', 'Check', 'Card', 'Bank transfer', 'Other'];
export const CUSTOMER_TYPES = [
  'Property Manager',
  'Contractor / GC',
  'Real Estate / Realtor',
  'Moving / Storage',
  'Estate / Cleanout',
  'Corporate / Business',
  'Residential',
  'Other',
];
export const TERMS = [
  { days: 0, label: 'Due on receipt' },
  { days: 7, label: 'Net 7' },
  { days: 15, label: 'Net 15' },
  { days: 30, label: 'Net 30' },
];
