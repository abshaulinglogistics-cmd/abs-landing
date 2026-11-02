import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrigin, getSettings, loadInvoices } from '@/lib/data';
import { addPayment, deleteInvoice, deletePayment, setInvoiceStatus } from '@/lib/actions';
import { fmtDate, fmtQty, invNo, METHODS, money, rctNo, todayStr } from '@/lib/format';
import { lineTotal, partnerStd } from '@/lib/calc';
import { ConfirmButton, CopyButton } from '@/components/Client';
import { Flash, StateBadge } from '@/components/ui';

export const metadata = { title: 'Invoice' };

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [inv] = await loadInvoices({ id: Number(id) || 0 });
  if (!inv) notFound();
  const [origin, s] = await Promise.all([getOrigin(), getSettings()]);
  const link = `${origin}/i/${inv.token}`;
  const mail = `mailto:${inv.customer_email}?subject=${encodeURIComponent(`Invoice ${invNo(inv.number)} from ${s.business_name}`)}&body=${encodeURIComponent(`Hi ${inv.customer_contact || inv.customer_name},\n\nHere is your invoice for ${money(inv.t.total)}. You can view it and download the PDF here:\n${link}\n\nThank you,\n${s.owner_name}\n${s.business_name}\n${s.phone}`)}`;
  const justPaid = sp.receipt ? inv.payments.find((p) => String(p.receipt_no) === sp.receipt) : undefined;

  return (
    <>
      <div className="head">
        <div>
          <h1>{invNo(inv.number)}</h1>
          <div className="sub"><Link href={`/admin/customers/${inv.customer_id}`}>{inv.customer_name}</Link> <StateBadge state={inv.state} /></div>
        </div>
        <div className="actions">
          <a className="btn" href={`/api/pdf/invoice/${inv.token}`} target="_blank">Invoice PDF</a>
          <a className="btn ghost" href={mail}>Email</a>
          <CopyButton text={link} label="Copy customer link" />
          <Link className="btn ghost" href={`/admin/invoices/${inv.id}/edit`}>Edit</Link>
        </div>
      </div>
      <Flash sp={sp} />
      {justPaid && (
        <div className="note" role="status">
          Payment recorded. Receipt {rctNo(justPaid.receipt_no)} is ready:{' '}
          <a href={`/api/pdf/receipt/${justPaid.token}`} target="_blank"><b>open the PDF</b></a>
          <span className="actions" style={{ display: 'inline-flex', marginLeft: 10 }}><CopyButton text={`${origin}/r/${justPaid.token}`} label="Copy receipt link" /></span>
        </div>
      )}

      <div className="cols main-side">
        <div className="stack">
          <div className="card flush">
            <div className="card-head"><h2>Breakdown</h2><span className="muted small">Issued {fmtDate(inv.issue_date)} - Due {inv.due_date === inv.issue_date ? 'on receipt' : fmtDate(inv.due_date)}</span></div>
            <div className="tbl-wrap"><table className="stack-sm items">
              <thead><tr><th>Description</th><th className="right">Qty</th><th className="right">Rate</th><th className="right">Amount</th></tr></thead>
              <tbody>{inv.items.map((i, k) => (
                <tr key={k}><td className="c-main">{i.description}</td><td className="right num nowrap c-sub">{fmtQty(i.qty)}{i.unit ? ` ${i.unit}` : ''}<span className="sm-only"> x</span></td><td className="right num c-sub">{partnerStd(i) > 0 && <s className="muted small std-was">{money(partnerStd(i))}</s>}{money(i.rate_cents)}</td><td className="right num c-amt"><b>{money(lineTotal(i))}</b></td><td className="c-break" aria-hidden="true" /></tr>
              ))}</tbody>
            </table></div>
            <div className="sum" style={{ padding: 16, maxWidth: 360, marginLeft: 'auto' }}>
              {inv.t.partnerSavings > 0 && <>
                <div><span className="muted">Standard price</span><span>{money(inv.t.standard)}</span></div>
                <div className="good"><span>Preferred Partner savings</span><span>- {money(inv.t.partnerSavings)}</span></div>
              </>}
              <div><span className="muted">Subtotal</span><span>{money(inv.t.subtotal)}</span></div>
              {inv.t.discount > 0 && <div className="good"><span>{inv.discount_label || 'Discount'}{inv.discount_type === 'percent' ? ` (${fmtQty(inv.discount_value)}%)` : ''}</span><span>- {money(inv.t.discount)}</span></div>}
              {inv.t.tax > 0 && <div><span className="muted">Tax ({fmtQty(inv.tax_pct)}%)</span><span>{money(inv.t.tax)}</span></div>}
              <div className="total"><span>Total</span><span>{money(inv.t.total)}</span></div>
              <div><span className="muted">Paid</span><span>- {money(inv.paid)}</span></div>
              <div className="total" style={{ borderTop: 0, marginTop: 0, paddingTop: 0 }}><span>Balance due</span><span>{money(Math.max(0, inv.balance))}</span></div>
            </div>
            {inv.notes && <div style={{ padding: '0 16px 16px' }}><div className="muted small">Notes</div>{inv.notes}</div>}
          </div>

          <div className="card flush">
            <div className="card-head"><h2>Payments and receipts</h2></div>
            {inv.payments.length === 0 ? <div className="empty">No payments yet. Record one on the right.</div> : (
              <div className="rows">{inv.payments.map((p) => (
                <div className="row" key={p.id} style={{ flexWrap: 'wrap' }}>
                  <div className="grow">
                    <div className="t">{money(p.amount_cents)} <span className="badge">{p.method}</span></div>
                    <div className="muted small">{fmtDate(p.paid_date)}{p.reference ? ` - ${p.reference}` : ''}{p.note ? ` - ${p.note}` : ''} - {rctNo(p.receipt_no)}</div>
                  </div>
                  <div className="actions">
                    <a className="btn ghost sm" href={`/api/pdf/receipt/${p.token}`} target="_blank">Receipt PDF</a>
                    <CopyButton text={`${origin}/r/${p.token}`} label="Copy link" />
                    <ConfirmButton action={deletePayment.bind(null, p.id, inv.id)} label="Delete" confirmLabel="Confirm" />
                  </div>
                </div>
              ))}</div>
            )}
          </div>
        </div>

        <div className="stack">
          <form action={addPayment.bind(null, inv.id)} className="card stack" style={{ gap: 12 }}>
            <h2>Record a payment</h2>
            <label className="f">Amount $
              <input name="amount" inputMode="decimal" required defaultValue={inv.balance > 0 ? (inv.balance / 100).toFixed(2) : ''} />
            </label>
            <label className="f">How was it paid?
              <select name="method" defaultValue="Cash">{METHODS.map((m) => <option key={m}>{m}</option>)}</select>
            </label>
            <label className="f">Date paid
              <input type="date" name="paid_date" defaultValue={todayStr()} />
            </label>
            <label className="f">Reference (check #, Zelle confirmation)
              <input name="reference" />
            </label>
            <label className="f">Note
              <input name="note" />
            </label>
            <button className="btn" type="submit" disabled={inv.state === 'void'}>Record payment and make receipt</button>
          </form>
          <div className="card stack" style={{ gap: 10 }}>
            <h3>Customer link</h3>
            <p className="muted small" style={{ margin: 0 }}>Anyone with this link can view and download this invoice. No login needed.</p>
            <input readOnly value={link} aria-label="Customer link" />
            <div className="actions">
              {inv.state === 'void'
                ? <form action={setInvoiceStatus.bind(null, inv.id, 'open')}><button className="btn ghost sm">Restore invoice</button></form>
                : <ConfirmButton action={setInvoiceStatus.bind(null, inv.id, 'void')} label="Void invoice" />}
              <ConfirmButton action={deleteInvoice.bind(null, inv.id)} label="Delete invoice" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
