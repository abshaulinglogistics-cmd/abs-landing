import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadCustomers, loadJobs } from '@/lib/data';
import { deleteJob, saveJob, setJobStatus } from '@/lib/actions';
import { fmtDate, invNo } from '@/lib/format';
import { ConfirmButton } from '@/components/Client';
import { Flash, JobBadge, JobFields } from '@/components/ui';

export const metadata = { title: 'Job' };

export default async function JobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [job] = await loadJobs('WHERE j.id = $1', [Number(id) || 0]);
  if (!job) notFound();
  const customers = (await loadCustomers()).map((c) => ({ id: c.id, name: c.name, address: c.address }));
  const back = `/admin/schedule?week=${job.job_date}`;
  return (
    <>
      <div className="head">
        <div>
          <h1>{job.title}</h1>
          <div className="sub"><Link href={`/admin/customers/${job.customer_id}`}>{job.customer_name}</Link> - {fmtDate(job.job_date)} <JobBadge status={job.status} /></div>
        </div>
        <div className="actions">
          {job.status !== 'done' && <form action={setJobStatus.bind(null, job.id, 'done', `/admin/schedule/${job.id}`)}><button className="btn">Mark done</button></form>}
          {job.invoice_id
            ? <Link className="btn ghost" href={`/admin/invoices/${job.invoice_id}`}>View {invNo(job.invoice_number!)}</Link>
            : <Link className="btn ghost" href={`/admin/invoices/new?job=${job.id}`}>Create invoice</Link>}
        </div>
      </div>
      <Flash sp={sp} />
      <form action={saveJob.bind(null, job.id)} className="card stack" style={{ maxWidth: 760 }}>
        <JobFields customers={customers} job={job} back={back} />
        <div className="actions">
          <button className="btn" type="submit">Save changes</button>
          <Link className="btn ghost" href={back}>Back to schedule</Link>
          <span style={{ marginLeft: 'auto' }}><ConfirmButton action={deleteJob.bind(null, job.id)} label="Delete job" /></span>
        </div>
      </form>
    </>
  );
}
