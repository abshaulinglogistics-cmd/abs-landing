'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { fmtDate, fmtTime } from '@/lib/format';

type Avail = { today: string; maxDays: number; days: Record<string, string[]> };
const SERVICES = ['Junk Removal', 'Trash Service', 'Pickup & Delivery', 'Demolition', 'Movers (loading / unloading)', 'Hauling', 'Not sure, I need a quote'];
const SIZES = ['A few items', 'Quarter load', 'Half load', 'Full load', 'Not sure'];
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const pad = (n: number) => String(n).padStart(2, '0');
const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
const shiftMonth = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};

export default function BookingWidget() {
  const [month, setMonth] = useState<string | null>(null);
  const [today, setToday] = useState('');
  const [maxDays, setMaxDays] = useState(45);
  const [days, setDays] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [f, setF] = useState({ service: '', size: '', name: '', company: '', phone: '', email: '', address: '', notes: '', website: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<{ ref: string; when: string } | null>(null);

  const load = useCallback(async (m?: string) => {
    setLoading(true);
    setLoadErr(false);
    try {
      const r = await fetch(`/api/booking/availability${m ? `?month=${m}` : ''}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('bad');
      const j: Avail & { month: string } = await r.json();
      setMonth(j.month);
      setToday(j.today);
      setMaxDays(j.maxDays);
      setDays(j.days);
      // First visit: jump to the first month that has an open day.
      if (!m && Object.keys(j.days).length === 0) {
        const next = shiftMonth(j.month, 1);
        const r2 = await fetch(`/api/booking/availability?month=${next}`, { cache: 'no-store' });
        if (r2.ok) {
          const j2 = await r2.json();
          if (Object.keys(j2.days).length) { setMonth(j2.month); setDays(j2.days); }
        }
      }
    } catch {
      setLoadErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cells = useMemo(() => {
    if (!month) return [];
    const [y, mo] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay();
    const count = new Date(Date.UTC(y, mo, 0)).getUTCDate();
    return [...Array(first).fill(null), ...Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`)];
  }, [month]);

  const canPrev = !!month && !!today && month > today.slice(0, 7);
  const lastDay = useMemo(() => {
    if (!today) return '';
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + maxDays);
    return d.toISOString().slice(0, 10);
  }, [today, maxDays]);
  const canNext = !!month && !!lastDay && `${shiftMonth(month, 1)}-01` <= lastDay;

  function go(n: number) {
    if (!month) return;
    const m = shiftMonth(month, n);
    setDate(''); setTime('');
    load(m);
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const times = date ? days[date] ?? [] : [];
  const ready = !!date && !!time && f.name.trim() && f.phone.trim() && f.address.trim() && f.service;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setErr('');
    try {
      const r = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, date, time }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) {
        setDone({ ref: j.ref ?? '', when: j.when ?? `${fmtDate(date)} at ${fmtTime(time)}` });
      } else {
        setErr(j.error || 'Something went wrong. Please call or text 404-740-9500.');
        if (j.stale) { setTime(''); load(month ?? undefined); }
      }
    } catch {
      setErr('We could not send that. Check your connection, or call or text 404-740-9500.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="bk-done" role="status">
        <div className="tick" aria-hidden="true">✓</div>
        <h3 className="h-font">Request received</h3>
        <p><strong style={{ color: '#fff' }}>{done.when}</strong>{done.ref ? ` (${done.ref})` : ''}</p>
        <p>We&apos;ll confirm by call or text shortly. Need it sooner? Call or text <a href="tel:4047409500" style={{ color: 'var(--accent)', fontWeight: 700 }}>404-740-9500</a>.</p>
      </div>
    );
  }

  return (
    <form className="bk-grid" onSubmit={submit}>
      <div>
        <h3>1. Pick a day</h3>
        <div className="bk-cal-head">
          <button type="button" className="bk-nav" aria-label="Previous month" disabled={!canPrev || loading} onClick={() => go(-1)}>‹</button>
          <strong aria-live="polite">{month ? monthLabel(month) : 'Loading'}</strong>
          <button type="button" className="bk-nav" aria-label="Next month" disabled={!canNext || loading} onClick={() => go(1)}>›</button>
        </div>
        <div className="bk-dow" aria-hidden="true">{DOW.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="bk-days" role="grid" aria-label="Available days" style={{ opacity: loading ? 0.5 : 1 }}>
          {cells.map((c, i) =>
            c ? (
              <button
                key={c}
                type="button"
                className={`bk-day${days[c] ? ' open' : ''}${c === date ? ' sel' : ''}${c === today ? ' today' : ''}`}
                disabled={!days[c]}
                aria-pressed={c === date}
                aria-label={`${fmtDate(c)}${days[c] ? '' : ', unavailable'}`}
                onClick={() => { setDate(c); setTime(''); }}
              >
                {Number(c.slice(8))}
              </button>
            ) : (
              <span key={`p${i}`} className="bk-day pad" aria-hidden="true" />
            ),
          )}
        </div>
        {loadErr && <p className="bk-error" role="alert" style={{ marginTop: 12 }}>We could not load open times. Call or text 404-740-9500 and we&apos;ll set it up.</p>}
        {!loadErr && !loading && Object.keys(days).length === 0 && <p className="bk-hint">No open days this month. Try the next month, or call or text 404-740-9500.</p>}

        {date && (
          <>
            <h3 style={{ marginTop: 24 }}>2. Pick a time <span style={{ color: 'var(--muted2)', fontWeight: 500 }}>(Eastern)</span></h3>
            <div className="bk-times" role="group" aria-label="Available times">
              {times.map((t) => (
                <button key={t} type="button" className={`bk-time${t === time ? ' sel' : ''}`} aria-pressed={t === time} onClick={() => setTime(t)}>
                  {fmtTime(t)}
                </button>
              ))}
            </div>
          </>
        )}
        <p className="bk-hint">Times show when we can be at your location. We confirm every request by call or text.</p>
      </div>

      <div className="bk-form">
        <h3>3. Tell us about the job</h3>
        <div className={`bk-pick${date && time ? '' : ' none'}`}>
          {date && time ? <><strong>{fmtDate(date)}</strong> at <strong>{fmtTime(time)}</strong></> : 'Choose a day and time first'}
        </div>
        <label>What do you need?
          <select value={f.service} onChange={set('service')} required>
            <option value="">Choose a service</option>
            {SERVICES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>About how much? (optional)
          <select value={f.size} onChange={set('size')}>
            <option value="">Not sure</option>
            {SIZES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <div className="bk-two">
          <label>Your name
            <input value={f.name} onChange={set('name')} autoComplete="name" required maxLength={80} />
          </label>
          <label>Phone
            <input value={f.phone} onChange={set('phone')} type="tel" inputMode="tel" autoComplete="tel" required maxLength={30} placeholder="404-555-0123" />
          </label>
        </div>
        <div className="bk-two">
          <label>Business (optional)
            <input value={f.company} onChange={set('company')} autoComplete="organization" maxLength={100} />
          </label>
          <label>Email (optional)
            <input value={f.email} onChange={set('email')} type="email" autoComplete="email" maxLength={120} />
          </label>
        </div>
        <label>Job address
          <input value={f.address} onChange={set('address')} autoComplete="street-address" required maxLength={200} placeholder="Street, city" />
        </label>
        <label>Anything we should know? (optional)
          <textarea value={f.notes} onChange={set('notes')} maxLength={1000} placeholder="Stairs, gate code, what is being hauled, parking" />
        </label>
        <div className="bk-hp" aria-hidden="true">
          <label>Website<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label>
        </div>
        {err && <div className="bk-error" role="alert">{err}</div>}
        <button className="bk-submit" type="submit" disabled={!ready || busy}>{busy ? 'Sending...' : 'Request this time'}</button>
      </div>
    </form>
  );
}
