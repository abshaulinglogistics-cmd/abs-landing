import Link from 'next/link';
import { loadInvoices } from '@/lib/data';
import { fmtDate, money } from '@/lib/format';
import { StateBadge } from '@/components/ui';

export const metadata = { title: 'Invoices' };

const FILTERS: [string, string][] = [['all', 'All'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['void', 'Void']];

export default async function Invoices({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = sp.state ?? 'all';
  const all = await loadInvoices();
  const match = (state: string, k: string) =>
    k === 'all' ? state !== 'void' : k === 'unpaid' ? ['open', 'partial', 'overdue'].includes(state) : state === k;
  const list = all.filter((i) => match(i.state, f));
  const total = list.reduce((a, i) => a + i.t.total, 0);
  const owed = list.reduce((a, i) => a + (i.state === 'void' ? 0 : Math.max(0, i.balance)), 0);
  return (
    <>
      <div className="head">
        <div><h1>Invoices</h1><div className="sub">{list.length} shown - {money(total)} billed - {money(owed)} still owed</div></div>
        <Link className="btn" href="/admin/invoices/new">New invoice</Link>
      </div>
      <div className="chips">
        {FILTERS.map(([k, label]) => (
          <Link key={k} className="chip" href={`/admin/invoices?state=${k}`} aria-current={f === k}>{label} ({all.filter((i) => match(i.state, k)).length})</Link>
        ))}
      </div>
      <div className="card flush">
        {list.length === 0 ? <div className="empty">No invoices here. <Link href="/admin/invoices/new">Create one</Link>.</div> : (
          <div className="tbl-wrap"><table>
            <thead><tr><th>Invoice</th><th>Customer</th><th>Issued</th><th>Due</th><th className="right">Total</th><th className="right">Paid</th><th className="right">Balance</th><th>Status</th></tr></thead>
            <tbody>{list.map((i) => (
              <tr key={i.id}>
                <td><Link href={`/admin/invoices/${i.id}`}><b>INV-{i.number}</b></Link></td>
                <td><Link href={`/admin/customers/${i.customer_id}`} style={{ color: 'inherit' }}>{i.customer_name}</Link></td>
                <td className="nowrap">{fmtDate(i.issue_date, false)}</td>
                <td className="nowrap">{i.due_date === i.issue_date ? 'On receipt' : fmtDate(i.due_date, false)}</td>
                <td className="right num">{money(i.t.total)}</td>
                <td className="right num">{money(i.paid)}</td>
                <td className="right num"><b>{money(Math.max(0, i.balance))}</b></td>
                <td><StateBadge state={i.state} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
