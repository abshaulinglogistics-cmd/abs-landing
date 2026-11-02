import Link from 'next/link';
import { loadCustomers, loadJobs } from '@/lib/data';
import { q } from '@/lib/db';
import { addDays, fmtDate, fmtDow, fmtTime, mondayOf, todayStr } from '@/lib/format';
import { saveJob, setJobStatus } from '@/lib/actions';
import { Flash, JobBadge, JobFields } from '@/components/ui';

export const metadata = { title: 'Schedule' };

export default async function Schedule({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const today = todayStr();
  const start = /^\d{4}-\d{2}-\d{2}$/.test(sp.week ?? '') ? mondayOf(sp.week!) : mondayOf(today);
  const end = addDays(start, 6);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const [jobs, customers, needs, reqs] = await Promise.all([
    loadJobs('WHERE j.job_date >= $1 AND j.job_date <= $2', [start, end]),
    loadCustomers(),
    loadJobs(`WHERE j.status = 'done' AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.job_id = j.id AND i.status <> 'void')`, [], 'j.job_date DESC', 20),
    q<any>(`SELECT * FROM bookings WHERE status = 'requested' AND booking_date >= $1 AND booking_date <= $2 ORDER BY booking_time`, [start, end]),
  ]);
  const pickable = customers.filter((c) => c.status !== 'inactive').map((c) => ({ id: c.id, name: c.name, address: c.address }));
  const back = `/admin/schedule?week=${start}`;

  return (
    <>
      <div className="head">
        <div>
          <h1>Schedule</h1>
          <div className="sub">{fmtDate(start, false)} to {fmtDate(end)}</div>
        </div>
        <div className="actions">
          <Link className="btn ghost" href={`/admin/schedule?week=${addDays(start, -7)}`}>Previous</Link>
          <Link className="btn ghost" href="/admin/schedule">This week</Link>
          <Link className="btn ghost" href={`/admin/schedule?week=${addDays(start, 7)}`}>Next</Link>
        </div>
      </div>
      <Flash sp={sp} />

      <div className="week">
        {days.map((d) => {
          const js = jobs.filter((j) => j.job_date === d);
          return (
            <div key={d} className={`day ${d === today ? 'today' : ''}`}>
              <div className="d"><span>{fmtDow(d)} {fmtDate(d, false)}</span>{d === today && <span style={{ color: 'var(--accent)' }}>Today</span>}</div>
              {js.length === 0 && !reqs.some((r: any) => r.booking_date === d) && <span className="muted small">Open</span>}
              {reqs.filter((r: any) => r.booking_date === d).map((r: any) => (
                <Link key={`r${r.id}`} href="/admin/bookings" className="job" style={{ borderStyle: 'dashed', borderLeftColor: 'var(--warn)' }}>
                  <b>{fmtTime(r.booking_time)} Requested</b>
                  <span className="muted">{r.company || r.name}</span>
                </Link>
              ))}
              {js.map((j) => (
                <Link key={j.id} href={`/admin/schedule/${j.id}`} className={`job ${j.status}`}>
                  <b>{j.start_time ? fmtTime(j.start_time) + ' ' : ''}{j.title}</b>
                  <span className="muted">{j.customer_name}</span>
                  {j.invoice_number && <span className="badge green" style={{ marginTop: 4 }}>Invoiced</span>}
                </Link>
              ))}
            </div>
          );
        })}
      </div>

      <div className="cols even" style={{ marginTop: 18 }}>
        <details className="card" open={!!sp.error || !!sp.customer || jobs.length === 0}>
          <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 17 }}>Add a job</summary>
          <form action={saveJob.bind(null, null)} className="stack" style={{ marginTop: 14 }}>
            <JobFields customers={pickable} defaultDate={days.includes(today) ? today : start} defaultCustomer={Number(sp.customer) || undefined} back={back} />
            <div><button className="btn" type="submit">Add to schedule</button></div>
          </form>
          {pickable.length === 0 && <p className="muted small">Add a customer first. <Link href="/admin/customers/new">New customer</Link></p>}
        </details>

        <div className="card flush">
          <div className="card-head"><h2>Done, needs an invoice</h2></div>
          {needs.length === 0 ? <div className="empty">Completed jobs without an invoice show up here.</div> : (
            <div className="rows">
              {needs.map((j) => (
                <div className="row" key={j.id}>
                  <div className="grow"><div className="t">{j.title}</div><div className="muted small">{j.customer_name} - {fmtDate(j.job_date, false)}</div></div>
                  <Link className="btn sm" href={`/admin/invoices/new?job=${j.id}`}>Create invoice</Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {jobs.some((j) => j.status === 'scheduled' || j.status === 'in_progress') && (
        <div className="card flush" style={{ marginTop: 18 }}>
          <div className="card-head"><h2>This week, quick status</h2></div>
          <div className="tbl-wrap">
            <table>
              <tbody>
                {jobs.filter((j) => j.status === 'scheduled' || j.status === 'in_progress').map((j) => (
                  <tr key={j.id}>
                    <td><b>{j.title}</b><div className="sub">{j.customer_name}</div></td>
                    <td className="nowrap">{fmtDow(j.job_date)} {fmtDate(j.job_date, false)} {fmtTime(j.start_time)}</td>
                    <td><JobBadge status={j.status} /></td>
                    <td className="right nowrap">
                      {j.status === 'scheduled' && <form action={setJobStatus.bind(null, j.id, 'in_progress', back)} style={{ display: 'inline' }}><button className="btn ghost sm">Start</button></form>}{' '}
                      <form action={setJobStatus.bind(null, j.id, 'done', back)} style={{ display: 'inline' }}><button className="btn sm">Mark done</button></form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
