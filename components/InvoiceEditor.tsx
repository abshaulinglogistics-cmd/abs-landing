'use client';
import { useMemo, useState } from 'react';
import { totals } from '@/lib/calc';
import { money, TERMS } from '@/lib/format';

type Cust = { id: number; name: string; partner_rate: boolean; default_discount_pct: number };
type Svc = { id: number; name: string; unit: string; kind: string; std_cents: number; partner_cents: number };
type Line = { key: string; serviceId?: number; description: string; qty: string; unit: string; rate: string; std?: number; kind: string; edited?: boolean; day?: 'day' | 'extra' };
type DayRate = { std: number; partner: number; loads: number; extraStd: number; extraPartner: number }; // cents
type DayRow = { key: string; date: string; loads: string };
type Initial = {
  number?: number; // set when editing
  customer_id: number | '';
  job_id: number | '';
  issue_date: string;
  terms_days: number;
  discount_type: string;
  discount_value: string; // percent, or dollars for flat
  discount_label: string;
  tax_pct: string;
  notes: string;
  lines: Omit<Line, 'key'>[];
};

let seq = 0;
const key = () => `l${++seq}`;
const cents = (v: string) => {
  const n = parseFloat(String(v).replace(/[$,\s]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const dollars = (c: number) => (c / 100).toFixed(2);

export default function InvoiceEditor({
  customers, services, dayRate: dr, initial, action, cancelHref, hasPayments,
}: {
  customers: Cust[];
  services: Svc[];
  initial: Initial;
  action: (f: FormData) => Promise<void>;
  cancelHref: string;
  hasPayments?: boolean;
  dayRate: DayRate;
}) {
  const [customerId, setCustomerId] = useState<number | ''>(initial.customer_id);
  const [issue, setIssue] = useState(initial.issue_date);
  const [terms, setTerms] = useState(initial.terms_days);
  const [lines, setLines] = useState<Line[]>(initial.lines.map((l) => ({ ...l, key: key() })));
  const [dType, setDType] = useState(initial.discount_type);
  const [dValue, setDValue] = useState(initial.discount_value);
  const [dLabel, setDLabel] = useState(initial.discount_label);
  const [tax, setTax] = useState(initial.tax_pct);
  const [notes, setNotes] = useState(initial.notes);
  const [num, setNum] = useState(initial.number ? String(initial.number) : '');
  const cust = customers.find((c) => c.id === customerId);
  const [partner, setPartner] = useState(!!cust?.partner_rate);

  const svcPrice = (s: Svc, p: boolean) => (p && s.partner_cents > 0 ? s.partner_cents : s.std_cents);
  // Standard price to show next to a partner-priced line (0 when the line isn't partner-priced).
  const svcStd = (s: Svc, p: boolean) => (p && s.partner_cents > 0 && s.std_cents > s.partner_cents ? s.std_cents : 0);

  function pickCustomer(id: number | '') {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    if (!c) return;
    setPartner(c.partner_rate);
    repriceAll(c.partner_rate);
    if (dType === 'none' && c.default_discount_pct > 0) {
      setDType('percent');
      setDValue(String(c.default_discount_pct));
      if (!dLabel) setDLabel('Recurring account discount');
    }
  }
  // Day rate pricing (partner price only when set and lower than standard)
  const pick = (std: number, par: number, p: boolean) => (p && par > 0 ? par : std);
  const was = (std: number, par: number, p: boolean) => (p && par > 0 && std > par ? std : 0);
  const dayPrice = (kind: 'day' | 'extra', p: boolean) =>
    kind === 'day' ? { rate: pick(dr.std, dr.partner, p), std: was(dr.std, dr.partner, p) } : { rate: pick(dr.extraStd, dr.extraPartner, p), std: was(dr.extraStd, dr.extraPartner, p) };
  const [dayOpen, setDayOpen] = useState(false);
  const [days, setDays] = useState<DayRow[]>([]);
  function openDays() {
    setDays([{ key: key(), date: issue, loads: String(dr.loads || 1) }]);
    setDayOpen(true);
  }
  const fmtDay = (d: string) => {
    const [y, m, dd] = d.split('-').map(Number);
    return y ? new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : d;
  };
  const dayRows = days.filter((d) => d.date && d.loads.trim() !== '').map((d) => ({ ...d, n: Math.max(0, parseInt(d.loads) || 0) }));
  const dayTotal = dayRows.reduce((a, d) => a + dayPrice('day', partner).rate + Math.max(0, d.n - dr.loads) * dayPrice('extra', partner).rate, 0);
  function addDayLines() {
    const add: Line[] = [];
    for (const d of [...dayRows].sort((a, b) => (a.date < b.date ? -1 : 1))) {
      const extra = Math.max(0, d.n - dr.loads);
      const dp = dayPrice('day', partner), ep = dayPrice('extra', partner);
      add.push({ key: key(), day: 'day', description: `Day rate - ${fmtDay(d.date)}: ${d.n} load${d.n === 1 ? '' : 's'} completed (${dr.loads} included)`, qty: '1', unit: 'day', rate: dollars(dp.rate), std: dp.std, kind: 'service' });
      if (extra > 0) add.push({ key: key(), day: 'extra', description: `Extra loads - ${fmtDay(d.date)} (${extra} over ${dr.loads})`, qty: String(extra), unit: 'load', rate: dollars(ep.rate), std: ep.std, kind: 'service' });
    }
    if (!add.length) return;
    setLines((ls) => [...ls, ...add]);
    setDayOpen(false);
  }

  function repriceAll(p: boolean) {
    setLines((ls) =>
      ls.map((l) => {
        if (l.day) {
          const dp = dayPrice(l.day, p);
          return l.edited ? { ...l, std: dp.std } : { ...l, rate: dollars(dp.rate), std: dp.std };
        }
        const s = services.find((x) => x.id === l.serviceId);
        if (!s) return l;
        return l.edited ? { ...l, std: svcStd(s, p) } : { ...l, rate: dollars(svcPrice(s, p)), std: svcStd(s, p) };
      }),
    );
  }
  function addService(id: number) {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    setLines((ls) => [
      ...ls,
      { key: key(), serviceId: s.id, description: s.name, qty: '1', unit: s.unit, rate: dollars(svcPrice(s, partner)), std: svcStd(s, partner), kind: s.kind },
    ]);
  }
  const patch = (k: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));

  const items = lines.map((l) => ({
    description: l.description, qty: parseFloat(l.qty) || 0, unit: l.unit, rate_cents: cents(l.rate), std_cents: l.std || 0, kind: l.kind,
  }));
  const dv = dType === 'percent' ? parseFloat(dValue) || 0 : cents(dValue);
  const t = useMemo(() => totals(items, { type: dType, value: dv }, parseFloat(tax) || 0), [JSON.stringify(items), dType, dv, tax]); // eslint-disable-line

  const payload = JSON.stringify({
    number: initial.number ? parseInt(num) || initial.number : undefined, customer_id: customerId, job_id: initial.job_id || null, issue_date: issue, terms_days: terms, items,
    discount_type: dType, discount_value: dv, discount_label: dLabel, tax_pct: parseFloat(tax) || 0, notes,
  });
  const canSave = !!customerId && items.some((i) => i.description && i.qty);

  return (
    <form action={action} className="cols main-side">
      <input type="hidden" name="payload" value={payload} />
      <div className="stack">
        <div className="card">
          <h2>Line items</h2>
          <div className="lines" style={{ marginTop: 12 }}>
            {lines.length === 0 && <div className="empty">Add a load or service from the rate card to start the invoice.</div>}
            {lines.map((l) => (
              <div className="line" key={l.key}>
                <label className="f desc">
                  <span className="lab">Description</span>
                  <input aria-label="Description" value={l.description} onChange={(e) => patch(l.key, { description: e.target.value })} placeholder="Description" />
                </label>
                <label className="f">
                  <span className="lab">Qty{l.unit ? ` (${l.unit})` : ''}</span>
                  <input aria-label="Quantity" inputMode="decimal" value={l.qty} onChange={(e) => patch(l.key, { qty: e.target.value })} />
                </label>
                <label className="f">
                  <span className="lab">Rate $</span>
                  <input aria-label="Rate" inputMode="decimal" value={l.rate} onChange={(e) => patch(l.key, { rate: e.target.value, edited: true })} />
                </label>
                <div className="amt num">
                  {money(t.lines[lines.indexOf(l)] ?? 0)}
                  {!!l.std && l.std > cents(l.rate) && (
                    <div className="good small" style={{ fontWeight: 500 }}>Std {money(l.std)}, saves {money(Math.round((parseFloat(l.qty) || 0) * (l.std - cents(l.rate))))}</div>
                  )}
                </div>
                <button type="button" className="btn ghost x" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                  &times;
                </button>
              </div>
            ))}
          </div>
          <div className="actions" style={{ marginTop: 14 }}>
            <select
              aria-label="Add from rate card"
              value=""
              onChange={(e) => e.target.value && addService(Number(e.target.value))}
              style={{ maxWidth: 320 }}
            >
              <option value="">+ Add from rate card</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.kind === 'disposal' ? '' : ` (${money(svcPrice(s, partner))}/${s.unit})`}
                </option>
              ))}
            </select>
            <button type="button" className="btn ghost" onClick={() => setLines((ls) => [...ls, { key: key(), description: '', qty: '1', unit: '', rate: '0.00', kind: 'service' }])}>
              + Custom line
            </button>
            <button type="button" className="btn ghost" onClick={() => setLines((ls) => [...ls, { key: key(), description: 'Dump / landfill fee (at cost)', qty: '1', unit: '', rate: '0.00', kind: 'disposal' }])}>
              + Dump fee
            </button>
            <button type="button" className="btn ghost" onClick={() => (dayOpen ? setDayOpen(false) : openDays())} aria-expanded={dayOpen}>
              + Day rate
            </button>
          </div>
          {dayOpen && (
            <div className="daybox">
              <div className="muted small">
                {money(dayPrice('day', partner).rate)} per day{partner && dayPrice('day', partner).std ? ' (partner)' : ''}, includes {dr.loads} load{dr.loads === 1 ? '' : 's'}. Each extra load {money(dayPrice('extra', partner).rate)}.
              </div>
              {days.map((d, i) => {
                const n = Math.max(0, parseInt(d.loads) || 0);
                const extra = Math.max(0, n - dr.loads);
                return (
                  <div className="dayrow" key={d.key}>
                    <label className="f">Day {i + 1}<input type="date" value={d.date} onChange={(e) => setDays((ds) => ds.map((x) => (x.key === d.key ? { ...x, date: e.target.value } : x)))} /></label>
                    <label className="f">Loads completed<input inputMode="numeric" value={d.loads} onChange={(e) => setDays((ds) => ds.map((x) => (x.key === d.key ? { ...x, loads: e.target.value.replace(/\D/g, '') } : x)))} /></label>
                    <div className="num small dayamt">
                      <b>{money(dayPrice('day', partner).rate + extra * dayPrice('extra', partner).rate)}</b>
                      <div className="muted">{extra > 0 ? `${extra} extra load${extra === 1 ? '' : 's'}` : `within ${dr.loads} included`}</div>
                    </div>
                    <button type="button" className="btn ghost x" aria-label="Remove day" onClick={() => setDays((ds) => ds.filter((x) => x.key !== d.key))} disabled={days.length === 1}>&times;</button>
                  </div>
                );
              })}
              <div className="actions">
                <button type="button" className="btn ghost sm" onClick={() => setDays((ds) => {
                  const last = ds[ds.length - 1]?.date || issue;
                  const [y, m, dd] = last.split('-').map(Number);
                  const next = new Date(Date.UTC(y, m - 1, dd + 1)).toISOString().slice(0, 10);
                  return [...ds, { key: key(), date: next, loads: String(dr.loads || 1) }];
                })}>+ Another day</button>
                <span className="grow" />
                <span className="num"><span className="muted small">{dayRows.length} day{dayRows.length === 1 ? '' : 's'}:</span> <b>{money(dayTotal)}</b></span>
                <button type="button" className="btn sm" onClick={addDayLines} disabled={!dayRows.length}>Add to invoice</button>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Notes to customer</h2>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Job address, what was hauled, anything the customer should know" />
        </div>
      </div>

      <div className="stack sticky">
        <div className="card">
          <div className="stack" style={{ gap: 12 }}>
            <label className="f">
              Customer
              <select value={customerId} onChange={(e) => pickCustomer(e.target.value ? Number(e.target.value) : '')} required>
                <option value="">Choose a customer</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {initial.number !== undefined && (
              <label className="f">
                Invoice number
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><b>INV-</b><input inputMode="numeric" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, ''))} /></div>
              </label>
            )}
            <label className="f check">
              <input type="checkbox" checked={partner} onChange={(e) => { setPartner(e.target.checked); repriceAll(e.target.checked); }} />
              Use Preferred Partner rates
            </label>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="f">
                Issue date
                <input type="date" value={issue} onChange={(e) => setIssue(e.target.value)} />
              </label>
              <label className="f">
                Terms
                <select value={terms} onChange={(e) => setTerms(Number(e.target.value))}>
                  {TERMS.map((x) => <option key={x.days} value={x.days}>{x.label}</option>)}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Discount</h2>
          <div className="stack" style={{ gap: 10, marginTop: 12 }}>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <label className="f">
                Type
                <select value={dType} onChange={(e) => setDType(e.target.value)}>
                  <option value="none">None</option>
                  <option value="percent">Percent off</option>
                  <option value="flat">Dollar amount off</option>
                </select>
              </label>
              {dType !== 'none' && (
                <label className="f">
                  {dType === 'percent' ? 'Percent' : 'Amount $'}
                  <input inputMode="decimal" value={dValue} onChange={(e) => setDValue(e.target.value)} />
                </label>
              )}
            </div>
            {dType !== 'none' && (
              <label className="f">
                Shown on invoice as
                <input value={dLabel} onChange={(e) => setDLabel(e.target.value)} placeholder="e.g. Recurring account discount" />
              </label>
            )}
            <p className="muted small" style={{ margin: 0 }}>Discounts apply to services only. Dump fees pass through at cost.</p>
            <label className="f">
              Sales tax %
              <input inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="card">
          <div className="sum">
            {t.partnerSavings > 0 && <>
              <div><span className="muted">Standard price</span><span>{money(t.standard)}</span></div>
              <div className="good"><span>Preferred Partner savings</span><span>- {money(t.partnerSavings)}</span></div>
            </>}
            <div><span className="muted">Subtotal</span><span>{money(t.subtotal)}</span></div>
            {t.discount > 0 && <div className="good"><span>{dLabel || 'Discount'}{dType === 'percent' ? ` (${dValue}%)` : ''}</span><span>- {money(t.discount)}</span></div>}
            {t.tax > 0 && <div><span className="muted">Tax</span><span>{money(t.tax)}</span></div>}
            <div className="total"><span>Total</span><span>{money(t.total)}</span></div>
          </div>
          {hasPayments && <p className="muted small">This invoice has payments recorded. Changing the total changes the balance.</p>}
          <div className="actions" style={{ marginTop: 14 }}>
            <button className="btn" type="submit" disabled={!canSave} style={canSave ? undefined : { opacity: 0.5 }}>Save invoice</button>
            <a className="btn ghost" href={cancelHref}>Cancel</a>
          </div>
        </div>
      </div>
    </form>
  );
}
