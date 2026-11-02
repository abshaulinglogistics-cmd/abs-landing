import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadCustomers, loadInvoices, loadJobs } from '@/lib/data';
import { deleteCustomer, saveCustomer } from '@/lib/actions';
import { fmtDate, invNo, money } from '@/lib/format';
import { ConfirmButton } from '@/components/Client';
import { CustomerFields, CustomerTags, Flash, JobBadge, StateBadge } from '@/components/ui';

export const metadata = { title: 'Customer' };

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const cid = Number(id) || 0;
  const [c] = await loadCustomers(cid);
  if (!c) notFound();
  const [invoices, jobs] = await Promise.all([
    loadInvoices({ customerId: cid }),
    loadJobs('WHERE j.customer_id = $1', [cid], 'j.job_date DESC', 50),
  ]);
  return (
    <>
      <div className="head">
        <div>
          <h1>{c.name}</h1>
          <div className="sub"><CustomerTags c={c} /></div>
        </div>
        <div className="actions">
          <Link className="btn" href={`/admin/invoices/new?customer=${c.id}`}>New invoice</Link>
          <Link className="btn ghost" href={`/admin/schedule?customer=${c.id}`}>Schedule a job</Link>
        </div>
      </div>
      <Flash sp={sp} />
      <div className="stats">
        <div className="stat good"><div className="k">Lifetime billed</div><div className="v">{money(c.billed)}</div><div className="n">{c.invoiceCount} invoice{c.invoiceCount === 1 ? '' : 's'}</div></div>
        <div className="stat"><div className="k">Paid</div><div className="v">{money(c.paid)}</div></div>
        <div className={`stat ${c.outstanding > 0 ? 'alert' : ''}`}><div className="k">Owes</div><div className="v">{money(c.outstanding)}</div></div>
        <div className="stat"><div className="k">Jobs completed</div><div className="v">{c.jobsDone}</div><div className="n">{c.lastActivity ? `Last ${fmtDate(c.lastActivity, false)}` : 'No activity yet'}</div></div>
      </div>
      <div className="cols main-side">
        <div className="stack">
          <div className="card flush">
            <div className="card-head"><h2>Invoices</h2></div>
            {invoices.length === 0 ? <div className="empty">No invoices yet.</div> : (
              <div className="tbl-wrap"><table>
                <thead><tr><th>Invoice</th><th>Issued</th><th className="right">Total</th><th className="right">Balance</th><th>Status</th></tr></thead>
                <tbody>{invoices.map((i) => (
                  <tr key={i.id}><td><Link href={`/admin/invoices/${i.id}`}>{invNo(i.number)}</Link></td><td>{fmtDate(i.issue_date, false)}</td><td className="right num">{money(i.t.total)}</td><td className="right num">{money(Math.max(0, i.balance))}</td><td><StateBadge state={i.state} /></td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
          <div className="card flush">
            <div className="card-head"><h2>Jobs</h2></div>
            {jobs.length === 0 ? <div className="empty">No jobs yet.</div> : (
              <div className="rows">{jobs.map((j) => (
                <Link key={j.id} href={`/admin/schedule/${j.id}`} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="grow"><div className="t">{j.title}</div><div className="muted small">{fmtDate(j.job_date)}{j.address ? ` - ${j.address}` : ''}</div></div>
                  <JobBadge status={j.status} />
                </Link>
              ))}</div>
            )}
          </div>
        </div>
        <form action={saveCustomer.bind(null, c.id)} className="card stack">
          <h2>Details</h2>
          <CustomerFields c={c} />
          <div className="actions">
            <button className="btn" type="submit">Save</button>
            <span style={{ marginLeft: 'auto' }}><ConfirmButton action={deleteCustomer.bind(null, c.id)} label="Delete" /></span>
          </div>
        </form>
      </div>
    </>
  );
}
