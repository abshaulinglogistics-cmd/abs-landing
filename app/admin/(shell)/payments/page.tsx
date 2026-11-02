import Link from 'next/link';
import { loadInvoices, loadPayments, periodRange, PERIODS } from '@/lib/data';
import { fmtDate, invNo, METHODS, money, rctNo } from '@/lib/format';
import MoneyTabs from '@/components/MoneyTabs';

export const metadata = { title: 'Payments' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function Payments({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const period = PERIODS.some((p) => p[0] === sp.period) ? sp.period! : 'month';
  const method = sp.method && METHODS.includes(sp.method) ? sp.method : '';
  const r = periodRange(period);
  const [inPeriod, invoices] = await Promise.all([loadPayments(r.from, r.to), loadInvoices()]);
  const list = method ? inPeriod.filter((p) => p.method === method) : inPeriod;

  const collected = list.reduce((a, p) => a + p.amount_cents, 0);
  const live = invoices.filter((i) => i.state !== 'void');
  const unpaid = live.filter((i) => i.balance > 0);
  const outstanding = unpaid.reduce((a, i) => a + i.balance, 0);
  const overdue = live.filter((i) => i.state === 'overdue');
  const overdueAmt = overdue.reduce((a, i) => a + i.balance, 0);
  const billed = live.filter((i) => (!r.from || i.issue_date >= r.from) && (!r.to || i.issue_date <= r.to)).reduce((a, i) => a + i.t.total, 0);

  const byMethod = Object.entries(
    inPeriod.reduce<Record<string, { n: number; c: number }>>((acc, p) => {
      (acc[p.method] ??= { n: 0, c: 0 }).n++;
      acc[p.method].c += p.amount_cents;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].c - a[1].c);
  const methodTotal = byMethod.reduce((a, [, v]) => a + v.c, 0);

  const byMonth = Object.entries(
    list.reduce<Record<string, number>>((acc, p) => {
      const k = p.paid_date.slice(0, 7);
      acc[k] = (acc[k] ?? 0) + p.amount_cents;
      return acc;
    }, {}),
  ).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  const maxMonth = Math.max(1, ...byMonth.map(([, c]) => c));

  const qs = (o: Record<string, string>) => {
    const u = new URLSearchParams({ period, ...(method ? { method } : {}), ...o });
    for (const [k, v] of [...u.entries()]) if (!v) u.delete(k);
    return `?${u}`;
  };

  return (
    <>
      <MoneyTabs current="payments" />
      <div className="head">
        <div><h1>Payments</h1><div className="sub">Money received, by period and by how it was paid.</div></div>
        <div className="actions">
          <a className="btn ghost" href={`/admin/payments/export${qs({})}`}>Download CSV</a>
          <Link className="btn" href="/admin/invoices?state=unpaid">Record a payment</Link>
        </div>
      </div>

      <div className="chips">
        {PERIODS.map(([k, label]) => (
          <Link key={k} className="chip" href={qs({ period: k })} aria-current={period === k}>{label}</Link>
        ))}
      </div>

      <div className="stats">
        <div className="stat good"><div className="k">Collected</div><div className="v">{money(collected)}</div><div className="n">{r.label}{method ? ` - ${method}` : ''} - {list.length} payment{list.length === 1 ? '' : 's'}</div></div>
        <div className="stat"><div className="k">Billed</div><div className="v">{money(billed)}</div><div className="n">Invoices issued {r.label.toLowerCase()}</div></div>
        <div className="stat"><div className="k">Still owed</div><div className="v">{money(outstanding)}</div><div className="n">{unpaid.length} unpaid invoice{unpaid.length === 1 ? '' : 's'}</div></div>
        <div className={`stat${overdueAmt > 0 ? ' alert' : ''}`}><div className="k">Overdue</div><div className="v">{money(overdueAmt)}</div><div className="n"><Link href="/admin/invoices?state=overdue">{overdue.length} past due</Link></div></div>
      </div>

      <div className="cols main-side">
        <div className="card flush">
          <div className="card-head">
            <h2>{method ? `${method} payments` : 'All payments'}</h2>
            {method && <Link className="small" href={qs({ method: '' })}>Show all methods</Link>}
          </div>
          {list.length === 0 ? <div className="empty">No payments {r.label.toLowerCase()}. Payments show up here when you record them on an invoice.</div> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th className="right">Amount</th><th>Receipt</th></tr></thead>
              <tbody>{list.map((p) => (
                <tr key={p.id}>
                  <td className="nowrap">{fmtDate(p.paid_date, period === 'all' || period.includes('year') ? true : false)}</td>
                  <td><Link href={`/admin/customers/${p.customer_id}`} style={{ color: 'inherit' }}>{p.customer_name}</Link>{(p.reference || p.note) && <div className="muted small">{[p.reference, p.note].filter(Boolean).join(' - ')}</div>}</td>
                  <td className="nowrap"><Link href={`/admin/invoices/${p.invoice_id}`}>{invNo(p.invoice_number)}</Link></td>
                  <td>{p.method}</td>
                  <td className="right num"><b>{money(p.amount_cents)}</b></td>
                  <td className="nowrap"><a href={`/api/pdf/receipt/${p.token}`} target="_blank">{rctNo(p.receipt_no)}</a></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>

        <div className="stack">
          <div className="card flush">
            <div className="card-head"><h2>By method</h2><span className="muted small">{r.label}</span></div>
            {byMethod.length === 0 ? <div className="empty">Nothing yet.</div> : (
              <div className="rows">{byMethod.map(([m, v]) => (
                <Link key={m} href={qs({ method: method === m ? '' : m })} className="row" aria-current={method === m ? 'true' : undefined} style={{ color: 'inherit', textDecoration: 'none', ...(method === m ? { background: 'var(--surface-2)' } : {}) }}>
                  <div className="grow">
                    <div className="t">{m} <span className="muted small">({v.n})</span></div>
                    <div className="bar" style={{ marginTop: 6 }}><span style={{ width: `${Math.round((v.c / Math.max(1, methodTotal)) * 100)}%` }} /></div>
                  </div>
                  <div className="right num nowrap"><b>{money(v.c)}</b><div className="muted small">{Math.round((v.c / Math.max(1, methodTotal)) * 100)}%</div></div>
                </Link>
              ))}</div>
            )}
          </div>

          {byMonth.length > 1 && (
            <div className="card flush">
              <div className="card-head"><h2>By month</h2></div>
              <div className="rows">{byMonth.map(([k, c]) => (
                <div key={k} className="row">
                  <div className="grow">
                    <div className="t">{MONTHS[Number(k.slice(5, 7)) - 1]} {k.slice(0, 4)}</div>
                    <div className="bar" style={{ marginTop: 6 }}><span style={{ width: `${Math.round((c / maxMonth) * 100)}%` }} /></div>
                  </div>
                  <div className="right num nowrap"><b>{money(c)}</b></div>
                </div>
              ))}</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
