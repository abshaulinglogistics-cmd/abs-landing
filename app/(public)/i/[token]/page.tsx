import { notFound } from 'next/navigation';
import { getSettings, loadInvoices } from '@/lib/data';
import { lineTotal, partnerStd } from '@/lib/calc';
import { fmtDate, fmtQty, invNo, money, rctNo } from '@/lib/format';
import { canPayByCard, cardFee } from '@/lib/square';

export const metadata = { title: 'Invoice', robots: { index: false, follow: false } };

export default async function PublicInvoice({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { token } = await params;
  const sp = await searchParams;
  const [inv] = await loadInvoices({ token });
  if (!inv) notFound();
  const s = await getSettings();
  const owes = inv.balance > 0 && inv.state !== 'void';
  const card = canPayByCard(inv, s);
  const fee = card ? cardFee(inv.balance, s) : 0;
  return (
    <>
      <div className="pub-head">
        <div className="brand"><b>ABS</b><span>Hauling &amp; Logistics</span></div>
        <div className="ttl"><b>INVOICE</b><span>{invNo(inv.number)}</span></div>
      </div>
      <div className="pub-body">
        {inv.state === 'paid' && <div className="paid-banner">PAID IN FULL</div>}
        {inv.state === 'void' && <div className="note err">This invoice has been voided.</div>}
        {sp.card === '1' && owes && <div className="note" role="status">Thank you! Your card payment is being confirmed. This page will show it as paid within a minute or two.</div>}
        {sp.card === '1' && !owes && inv.state !== 'void' && <div className="note" role="status">Thank you! Your card payment was received.</div>}
        {sp.card === 'error' && <div className="note err" role="alert">Card checkout is not available right now. Please pay with Zelle, or call {s.phone}.</div>}
        <div className="grid two">
          <div><div className="muted small">From</div><b>{s.business_name}</b><div>{s.phone}</div><div>{s.email}</div></div>
          <div><div className="muted small">Bill to</div><b>{inv.customer_name}</b>{inv.customer_contact && <div>{inv.customer_contact}</div>}{inv.customer_address && <div>{inv.customer_address}</div>}</div>
          <div><div className="muted small">Issued</div><b>{fmtDate(inv.issue_date)}</b></div>
          <div><div className="muted small">Due</div><b>{inv.due_date === inv.issue_date ? 'On receipt' : fmtDate(inv.due_date)}</b></div>
        </div>
        <div className="tbl-wrap"><table className="stack-sm items">
          <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead>
          <tbody>{inv.items.map((i, k) => (
            <tr key={k}><td className="c-main">{i.description}</td><td className="right num nowrap c-sub">{fmtQty(i.qty)}{i.unit ? ` ${i.unit}` : ''}<span className="sm-only"> x</span></td><td className="right num c-sub">{partnerStd(i) > 0 && <s className="muted small std-was">{money(partnerStd(i))}</s>}{money(i.rate_cents)}</td><td className="right num c-amt"><b>{money(lineTotal(i))}</b></td><td className="c-break" aria-hidden="true" /></tr>
          ))}</tbody>
        </table></div>
        <div className="sum" style={{ maxWidth: 340, marginLeft: 'auto', width: '100%' }}>
          {inv.t.partnerSavings > 0 && <>
            <div><span className="muted">Standard price</span><span>{money(inv.t.standard)}</span></div>
            <div className="good"><span>Preferred Partner savings</span><span>- {money(inv.t.partnerSavings)}</span></div>
          </>}
          <div><span className="muted">Subtotal</span><span>{money(inv.t.subtotal)}</span></div>
          {inv.t.discount > 0 && <div className="good"><span>{inv.discount_label || 'Discount'}{inv.discount_type === 'percent' ? ` (${fmtQty(inv.discount_value)}%)` : ''}</span><span>- {money(inv.t.discount)}</span></div>}
          {inv.t.tax > 0 && <div><span className="muted">Tax</span><span>{money(inv.t.tax)}</span></div>}
          <div className="total"><span>Total</span><span>{money(inv.t.total)}</span></div>
          {inv.paid > 0 && <div><span className="muted">Paid</span><span>- {money(inv.paid)}</span></div>}
          <div className="total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}><span>Balance due</span><span>{money(Math.max(0, inv.balance))}</span></div>
        </div>
        {inv.t.partnerSavings > 0 && (
          <div className="note" role="note">You saved <b>{money(inv.t.partnerSavings)}</b> on this invoice with Preferred Partner rates.</div>
        )}
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
        {owes && (
          <div className="stack" style={{ gap: 12 }}>
            <h3>How to pay</h3>
            <div className="paygrid">
              {s.zelle_to && (
                <div className="paybox">
                  <div className="pay-k">Zelle <span className="badge green">No fee</span></div>
                  <div className="pay-v">{money(inv.balance)}</div>
                  <div className="small">Send to <b>{s.zelle_to}</b>{s.zelle_name ? <> ({s.zelle_name})</> : null}. Put <b>{invNo(inv.number)}</b> in the memo.</div>
                </div>
              )}
              {card && (
                <form className="paybox" method="post" action={`/api/pay/${inv.token}`}>
                  <div className="pay-k">Card, Apple Pay or Google Pay</div>
                  <div className="pay-v">{money(inv.balance + fee)}</div>
                  <div className="small muted">{money(inv.balance)} + {money(fee)} card processing fee{s.zelle_to ? '. Pay with Zelle to skip the fee.' : '.'}</div>
                  <button className="btn" type="submit" style={{ marginTop: 4 }}>Pay {money(inv.balance + fee)} by card</button>
                  <div className="muted small">Secure checkout by Square.</div>
                </form>
              )}
            </div>
            {s.payment_instructions && <div className="small">{s.payment_instructions}</div>}
          </div>
        )}
        <div className="muted small">{s.invoice_footer}</div>
        <div className="actions"><a className="btn" href={`/api/pdf/invoice/${inv.token}?download=1`}>Download PDF</a></div>
      </div>
    </>
  );
}
