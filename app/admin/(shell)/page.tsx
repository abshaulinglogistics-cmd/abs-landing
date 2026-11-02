import Link from 'next/link';
import { loadCustomers, loadInvoices, loadJobs } from '@/lib/data';
import { addDays, diffDays, fmtDate, fmtTime, invNo, money, todayStr } from '@/lib/format';
import { JobBadge, StateBadge } from '@/components/ui';
import { q } from '@/lib/db';
import { bookingRef } from '@/lib/booking';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const today = todayStr();
  const month = today.slice(0, 7);
  const [invoices, customers, upcoming, needsInvoice] = await Promise.all([
    loadInvoices(),
    loadCustomers(),
    loadJobs(`WHERE j.job_date >= $1 AND j.job_date <= $2 AND j.status IN ('scheduled','in_progress')`, [today, addDays(today, 14)], 'j.job_date, j.start_time', 8),
    loadJobs(`WHERE j.status = 'done' AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.job_id = j.id AND i.status <> 'void')`, [], 'j.job_date DESC', 6),
  ]);
  const requests = await q<any>("SELECT * FROM bookings WHERE status = 'requested' ORDER BY booking_date, booking_time LIMIT 5");
  const live = invoices.filter((i) => i.state !== 'void');
  const unpaid = live.filter((i) => i.state !== 'paid');
  const outstanding = unpaid.reduce((a, i) => a + i.balance, 0);
  const overdue = live.filter((i) => i.state === 'overdue');
  const overdueAmt = overdue.reduce((a, i) => a + i.balance, 0);
  const payments = live.flatMap((i) => i.payments.map((p) => ({ ...p, inv: i })));
  const collected = payments.filter((p) => p.paid_date.startsWith(month)).reduce((a, p) => a + p.amount_cents, 0);
  const invoiced = live.filter((i) => i.issue_date.startsWith(month)).reduce((a, i) => a + i.t.total, 0);
  const recent = payments.sort((a, b) => (a.paid_date < b.paid_date ? 1 : a.id < b.id ? 1 : -1)).slice(0, 5);

  const active = customers.filter((c) => c.status !== 'prospect' && c.status !== 'inactive');
  const repeatN = active.filter((c) => c.repeat).length;
  const corpN = active.filter((c) => c.corporate && c.invoiceCount + c.jobsDone > 0).length;
  const follow = customers.filter((c) => c.dormant).sort((a, b) => (b.daysQuiet ?? 0) - (a.daysQuiet ?? 0)).slice(0, 5);
  const top = [...customers].sort((a, b) => b.paid - a.paid).filter((c) => c.paid > 0).slice(0, 5);

  return (
    <>
      <div className="head">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">{fmtDate(today)}</div>
        </div>
        <div className="actions">
          <Link className="btn" href="/admin/invoices/new">New invoice</Link>
          <Link className="btn ghost" href="/admin/schedule">Add a job</Link>
          <Link className="btn ghost" href="/admin/customers/new">Add customer</Link>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="card flush" style={{ marginBottom: 16, borderColor: 'var(--warn)' }}>
          <div className="card-head"><h2>New booking requests ({requests.length})</h2><Link href="/admin/bookings" className="small">Review</Link></div>
          <div className="rows">
            {requests.map((b: any) => (
              <Link key={b.id} href="/admin/bookings" className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                <div className="grow"><div className="t">{b.company || b.name} - {b.service}</div><div className="muted small">{b.address} - {bookingRef(b.id)}</div></div>
                <div className="right small nowrap"><div>{fmtDate(b.booking_date, false)}</div><div className="muted">{fmtTime(b.booking_time)}</div></div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="stats">
        <div className="stat good"><div className="k">Collected this month</div><div className="v">{money(collected)}</div><div className="n">{money(invoiced)} invoiced</div></div>
        <div className="stat"><div className="k">Outstanding</div><div className="v">{money(outstanding)}</div><div className="n">{unpaid.length} unpaid invoice{unpaid.length === 1 ? '' : 's'}</div></div>
        <div className={`stat ${overdue.length ? 'alert' : ''}`}><div className="k">Overdue</div><div className="v">{money(overdueAmt)}</div><div className="n">{overdue.length} invoice{overdue.length === 1 ? '' : 's'} past due</div></div>
        <div className="stat"><div className="k">Repeat customers</div><div className="v">{repeatN}</div><div className="n">{corpN} corporate account{corpN === 1 ? '' : 's'}</div></div>
      </div>

      <div className="cols even">
        <div className="card flush">
          <div className="card-head"><h2>Next 14 days</h2><Link href="/admin/schedule" className="small">Open schedule</Link></div>
          {upcoming.length === 0 ? <div className="empty">Nothing scheduled. <Link href="/admin/schedule">Add a job</Link></div> : (
            <div className="rows">
              {upcoming.map((j) => (
                <Link key={j.id} href={`/admin/schedule/${j.id}`} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="grow"><div className="t">{j.title}</div><div className="muted small">{j.customer_name}{j.address ? ` - ${j.address}` : ''}</div></div>
                  <div className="right small nowrap"><div>{j.job_date === today ? 'Today' : fmtDate(j.job_date, false)}</div><div className="muted">{fmtTime(j.start_time)}</div></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card flush">
          <div className="card-head"><h2>Done, not invoiced</h2></div>
          {needsInvoice.length === 0 ? <div className="empty">Every completed job has an invoice.</div> : (
            <div className="rows">
              {needsInvoice.map((j) => (
                <div key={j.id} className="row">
                  <div className="grow"><div className="t">{j.title}</div><div className="muted small">{j.customer_name} - {fmtDate(j.job_date, false)}</div></div>
                  <Link className="btn sm" href={`/admin/invoices/new?job=${j.id}`}>Invoice</Link>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card flush">
          <div className="card-head"><h2>Unpaid invoices</h2><Link href="/admin/invoices?state=unpaid" className="small">View all</Link></div>
          {unpaid.length === 0 ? <div className="empty">Nothing outstanding.</div> : (
            <div className="rows">
              {unpaid.slice(0, 6).map((i) => (
                <Link key={i.id} href={`/admin/invoices/${i.id}`} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="grow"><div className="t">{invNo(i.number)} - {i.customer_name}</div><div className="muted small">Due {i.due_date === i.issue_date ? 'on receipt' : fmtDate(i.due_date, false)}</div></div>
                  <div className="right"><div className="num t">{money(i.balance)}</div><StateBadge state={i.state} /></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card flush">
          <div className="card-head"><h2>Recent payments</h2></div>
          {recent.length === 0 ? <div className="empty">No payments recorded yet.</div> : (
            <div className="rows">
              {recent.map((p) => (
                <div key={p.id} className="row">
                  <div className="grow"><div className="t">{p.inv.customer_name}</div><div className="muted small">{fmtDate(p.paid_date, false)} - {p.method} - {invNo(p.inv.number)}</div></div>
                  <div className="right"><div className="num t">{money(p.amount_cents)}</div><a className="small" href={`/api/pdf/receipt/${p.token}`} target="_blank">Receipt</a></div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card flush">
          <div className="card-head"><h2>Time to follow up</h2></div>
          {follow.length === 0 ? <div className="empty">No repeat or corporate accounts have gone quiet.</div> : (
            <div className="rows">
              {follow.map((c) => (
                <Link key={c.id} href={`/admin/customers/${c.id}`} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="grow"><div className="t">{c.name}</div><div className="muted small">{c.type}</div></div>
                  <div className="right small muted nowrap">{c.daysQuiet} days quiet</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="card flush">
          <div className="card-head"><h2>Top customers by revenue</h2></div>
          {top.length === 0 ? <div className="empty">Revenue shows up here after the first payment.</div> : (
            <div className="rows">
              {top.map((c) => (
                <Link key={c.id} href={`/admin/customers/${c.id}`} className="row" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <div className="grow"><div className="t">{c.name}</div><div className="muted small">{c.jobsDone} job{c.jobsDone === 1 ? '' : 's'} - last {c.lastActivity ? fmtDate(c.lastActivity, false) : 'n/a'}</div></div>
                  <div className="num t">{money(c.paid)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
