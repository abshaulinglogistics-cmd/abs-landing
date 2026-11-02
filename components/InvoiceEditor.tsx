'use client';
import { useMemo, useState } from 'react';
import { totals } from '@/lib/calc';
import { money, TERMS } from '@/lib/format';

type Cust = { id: number; name: string; partner_rate: boolean; default_discount_pct: number };
type Svc = { id: number; name: string; unit: string; kind: string; std_cents: number; partner_cents: number };
type Line = { key: string; serviceId?: number; description: string; qty: string; unit: string; rate: string; kind: string; edited?: boolean };
type Initial = {
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
  customers, services, initial, action, cancelHref, hasPayments,
}: {
  customers: Cust[];
  services: Svc[];
  initial: Initial;
  action: (f: FormData) => Promise<void>;
  cancelHref: string;
  hasPayments?: boolean;
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
  const cust = customers.find((c) => c.id === customerId);
  const [partner, setPartner] = useState(!!cust?.partner_rate);

  const svcPrice = (s: Svc, p: boolean) => (p && s.partner_cents > 0 ? s.partner_cents : s.std_cents);

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
  function repriceAll(p: boolean) {
    setLines((ls) =>
      ls.map((l) => {
        const s = services.find((x) => x.id === l.serviceId);
        return s && !l.edited ? { ...l, rate: dollars(svcPrice(s, p)) } : l;
      }),
    );
  }
  function addService(id: number) {
    const s = services.find((x) => x.id === id);
    if (!s) return;
    setLines((ls) => [
      ...ls,
      { key: key(), serviceId: s.id, description: s.name, qty: '1', unit: s.unit, rate: dollars(svcPrice(s, partner)), kind: s.kind },
    ]);
  }
  const patch = (k: string, p: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...p } : l)));

  const items = lines.map((l) => ({
    description: l.description, qty: parseFloat(l.qty) || 0, unit: l.unit, rate_cents: cents(l.rate), kind: l.kind,
  }));
  const dv = dType === 'percent' ? parseFloat(dValue) || 0 : cents(dValue);
  const t = useMemo(() => totals(items, { type: dType, value: dv }, parseFloat(tax) || 0), [JSON.stringify(items), dType, dv, tax]); // eslint-disable-line

  const payload = JSON.stringify({
    customer_id: customerId, job_id: initial.job_id || null, issue_date: issue, terms_days: terms, items,
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
                <div className="amt num">{money(t.lines[lines.indexOf(l)] ?? 0)}</div>
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
          </div>
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
