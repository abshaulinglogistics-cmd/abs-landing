import { notFound } from 'next/navigation';
import { getSettings, loadInvoices } from '@/lib/data';
import { lineTotal } from '@/lib/calc';
import { fmtDate, fmtQty, invNo, money, rctNo } from '@/lib/format';

export const metadata = { title: 'Invoice', robots: { index: false, follow: false } };

export default async function PublicInvoice({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv] = await loadInvoices({ token });
  if (!inv) notFound();
  const s = await getSettings();
  return (
    <>
      <div className="pub-head">
        <div className="brand"><b>ABS</b><span>Hauling &amp; Logistics</span></div>
        <div className="ttl"><b>INVOICE</b><span>{invNo(inv.number)}</span></div>
      </div>
      <div className="pub-body">
        {inv.state === 'paid' && <div className="paid-banner">PAID IN FULL</div>}
        {inv.state === 'void' && <div className="note err">This invoice has been voided.</div>}
        <div className="grid two">
          <div><div className="muted small">From</div><b>{s.business_name}</b><div>{s.phone}</div><div>{s.email}</div></div>
          <div><div className="muted small">Bill to</div><b>{inv.customer_name}</b>{inv.customer_contact && <div>{inv.customer_contact}</div>}{inv.customer_address && <div>{inv.customer_address}</div>}</div>
          <div><div className="muted small">Issued</div><b>{fmtDate(inv.issue_date)}</b></div>
          <div><div className="muted small">Due</div><b>{inv.due_date === inv.issue_date ? 'On receipt' : fmtDate(inv.due_date)}</b></div>
        </div>
        <div className="tbl-wrap"><table>
          <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead>
          <tbody>{inv.items.map((i, k) => (
            <tr key={k}><td>{i.description}</td><td className="right num nowrap">{fmtQty(i.qty)}{i.unit ? ` ${i.unit}` : ''}</td><td className="right num">{money(i.rate_cents)}</td><td className="right num"><b>{money(lineTotal(i))}</b></td></tr>
          ))}</tbody>
        </table></div>
        <div className="sum" style={{ maxWidth: 340, marginLeft: 'auto', width: '100%' }}>
          <div><span className="muted">Subtotal</span><span>{money(inv.t.subtotal)}</span></div>
          {inv.t.discount > 0 && <div className="good"><span>{inv.discount_label || 'Discount'}{inv.discount_type === 'percent' ? ` (${fmtQty(inv.discount_value)}%)` : ''}</span><span>- {money(inv.t.discount)}</span></div>}
          {inv.t.tax > 0 && <div><span className="muted">Tax</span><span>{money(inv.t.tax)}</span></div>}
          <div className="total"><span>Total</span><span>{money(inv.t.total)}</span></div>
          {inv.paid > 0 && <div><span className="muted">Paid</span><span>- {money(inv.paid)}</span></div>}
          <div className="total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}><span>Balance due</span><span>{money(Math.max(0, inv.balance))}</span></div>
        </div>
        {inv.payments.length > 0 && (
          <div><h3>Payments received</h3>
            <div className="rows" style={{ marginTop: 8 }}>{inv.payments.map((p) => (
              <div className="row" key={p.id} style={{ padding: '8px 0' }}>
                <div className="grow small">{fmtDate(p.paid_date)} - {p.method}</div>
                <div className="num small"><b>{money(p.amount_cents)}</b> <a href={`/r/${p.token}`}>{rctNo(p.receipt_no)}</a></div>
              </div>
            ))}</div>
          </div>
        )}
        {inv.notes && <div><h3>Notes</h3><div>{inv.notes}</div></div>}
        {inv.balance > 0 && inv.state !== 'void' && <div><h3>How to pay</h3><div>{s.payment_instructions}</div></div>}
        <div className="muted small">{s.invoice_footer}</div>
        <div className="actions"><a className="btn" href={`/api/pdf/invoice/${inv.token}?download=1`}>Download PDF</a></div>
      </div>
    </>
  );
}
