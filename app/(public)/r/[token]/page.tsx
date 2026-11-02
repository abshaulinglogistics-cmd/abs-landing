import { notFound } from 'next/navigation';
import { getSettings, loadInvoices } from '@/lib/data';
import { q } from '@/lib/db';
import { lineTotal } from '@/lib/calc';
import { fmtDate, fmtQty, invNo, money, rctNo } from '@/lib/format';

export const metadata = { title: 'Receipt', robots: { index: false, follow: false } };

export default async function PublicReceipt({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [row] = await q<{ invoice_id: number }>('SELECT invoice_id FROM payments WHERE token = $1', [token]);
  if (!row) notFound();
  const [inv] = await loadInvoices({ id: row.invoice_id });
  const pay = inv?.payments.find((p) => p.token === token);
  if (!inv || !pay) notFound();
  const s = await getSettings();
  const upTo = inv.payments.filter((x) => x.paid_date < pay.paid_date || (x.paid_date === pay.paid_date && x.id <= pay.id));
  const paidThrough = upTo.reduce((a, x) => a + x.amount_cents, 0);
  const bal = inv.t.total - paidThrough;
  return (
    <>
      <div className="pub-head">
        <div className="brand"><b>ABS</b><span>Hauling &amp; Logistics</span></div>
        <div className="ttl"><b>RECEIPT</b><span>{rctNo(pay.receipt_no)}</span></div>
      </div>
      <div className="pub-body">
        <div className="amount-box"><div className="muted small">AMOUNT RECEIVED</div><div className="v">{money(pay.amount_cents)}</div><div className="muted">{pay.method} on {fmtDate(pay.paid_date)}{pay.reference ? ` - ${pay.reference}` : ''}</div></div>
        <div className="grid two">
          <div><div className="muted small">Received from</div><b>{inv.customer_name}</b>{inv.customer_contact && <div>{inv.customer_contact}</div>}</div>
          <div><div className="muted small">Received by</div><b>{s.business_name}</b><div>{s.phone}</div></div>
        </div>
        <div><h3>Applied to {invNo(inv.number)}</h3>
          <div className="tbl-wrap" style={{ marginTop: 8 }}><table>
            <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Amount</th></tr></thead>
            <tbody>{inv.items.map((i, k) => (
              <tr key={k}><td>{i.description}</td><td className="right num nowrap">{fmtQty(i.qty)}{i.unit ? ` ${i.unit}` : ''}</td><td className="right num">{money(lineTotal(i))}</td></tr>
            ))}</tbody>
          </table></div>
        </div>
        <div className="sum" style={{ maxWidth: 340, marginLeft: 'auto', width: '100%' }}>
          {inv.t.discount > 0 && <div className="good"><span>{inv.discount_label || 'Discount'}</span><span>- {money(inv.t.discount)}</span></div>}
          <div><span className="muted">Invoice total</span><span>{money(inv.t.total)}</span></div>
          <div><span className="muted">Paid to date</span><span>{money(paidThrough)}</span></div>
          <div className="total"><span>{bal <= 0 ? 'Paid in full' : 'Balance remaining'}</span><span>{money(Math.max(0, bal))}</span></div>
        </div>
        {pay.note && <div className="muted">{pay.note}</div>}
        <div className="muted small">Thank you for your business. {s.tagline}.</div>
        <div className="actions"><a className="btn" href={`/api/pdf/receipt/${pay.token}?download=1`}>Download PDF receipt</a></div>
      </div>
    </>
  );
}
