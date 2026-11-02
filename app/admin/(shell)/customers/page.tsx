import Link from 'next/link';
import { loadCustomers } from '@/lib/data';
import { fmtDate, money } from '@/lib/format';
import { CustomerTags } from '@/components/ui';

export const metadata = { title: 'Customers' };

const FILTERS: [string, string][] = [
  ['all', 'All'], ['corporate', 'Corporate'], ['repeat', 'Repeat'], ['follow', 'Needs follow-up'], ['prospect', 'Prospects'], ['residential', 'Residential'],
];

export default async function Customers({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = sp.f ?? 'all';
  const term = (sp.q ?? '').toLowerCase().trim();
  const all = await loadCustomers();
  let list = all.filter((c) => {
    if (f === 'corporate') return c.corporate && c.status !== 'prospect';
    if (f === 'repeat') return c.repeat;
    if (f === 'follow') return c.dormant;
    if (f === 'prospect') return c.status === 'prospect';
    if (f === 'residential') return !c.corporate;
    return true;
  });
  if (term) list = list.filter((c) => [c.name, c.contact_name, c.email, c.phone, c.type].join(' ').toLowerCase().includes(term));
  const count = (k: string) => all.filter((c) => (k === 'corporate' ? c.corporate && c.status !== 'prospect' : k === 'repeat' ? c.repeat : k === 'follow' ? c.dormant : k === 'prospect' ? c.status === 'prospect' : k === 'residential' ? !c.corporate : true)).length;

  return (
    <>
      <div className="head">
        <div><h1>Customers</h1><div className="sub">{all.length} total. Repeat and corporate accounts are where the growth is.</div></div>
        <Link className="btn" href="/admin/customers/new">Add customer</Link>
      </div>
      <form className="chips" action="/admin/customers">
        {FILTERS.map(([k, label]) => (
          <Link key={k} className="chip" href={`/admin/customers?f=${k}${term ? `&q=${encodeURIComponent(term)}` : ''}`} aria-current={f === k}>{label} ({count(k)})</Link>
        ))}
        <input type="hidden" name="f" value={f} />
        <input name="q" placeholder="Search name, contact, phone" defaultValue={sp.q ?? ''} style={{ maxWidth: 260, marginLeft: 'auto' }} aria-label="Search customers" />
      </form>
      <div className="card flush">
        {list.length === 0 ? (
          <div className="empty">{all.length === 0 ? <>No customers yet. <Link href="/admin/customers/new">Add the first one</Link>.</> : 'No customers match.'}</div>
        ) : (
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Customer</th><th>Contact</th><th className="right">Jobs</th><th className="right">Billed</th><th className="right">Owes</th><th>Last activity</th><th>Tags</th></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/admin/customers/${c.id}`}><b>{c.name}</b></Link><div className="sub">{c.type}</div></td>
                    <td>{c.contact_name || <span className="muted">-</span>}<div className="sub">{c.phone}</div></td>
                    <td className="right num">{c.jobsDone}</td>
                    <td className="right num">{money(c.billed)}</td>
                    <td className="right num" style={c.outstanding > 0 ? { color: 'var(--bad)', fontWeight: 700 } : undefined}>{money(c.outstanding)}</td>
                    <td className="nowrap">{c.lastActivity ? fmtDate(c.lastActivity, false) : <span className="muted">None yet</span>}{c.nextJob && <div className="sub">Next {fmtDate(c.nextJob, false)}</div>}</td>
                    <td><CustomerTags c={c} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
