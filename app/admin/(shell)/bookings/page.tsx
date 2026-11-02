import Link from 'next/link';
import { q } from '@/lib/db';
import { bookingRef } from '@/lib/booking';
import { cancelBooking, confirmBooking, declineBooking } from '@/lib/actions';
import { addDays, fmtDate, fmtTime, todayStr } from '@/lib/format';
import { ConfirmButton } from '@/components/Client';

export const metadata = { title: 'Bookings' };

type B = {
  id: number; status: string; service: string; size: string; booking_date: string; booking_time: string;
  name: string; company: string; phone: string; email: string; address: string; notes: string; job_id: number | null; customer_id: number | null;
};

function Card({ b, children }: { b: B; children: React.ReactNode }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 18 }}>{fmtDate(b.booking_date)} at {fmtTime(b.booking_time)}</h2>
          <div className="muted small">{b.service}{b.size ? ` - ${b.size}` : ''} - {bookingRef(b.id)}</div>
        </div>
        <div className="actions">{children}</div>
      </div>
      <div className="grid two small">
        <div><b>{b.company || b.name}</b>{b.company && <div>{b.name}</div>}<div><a href={`tel:${b.phone}`}>{b.phone}</a>{b.email && <> - <a href={`mailto:${b.email}`}>{b.email}</a></>}</div></div>
        <div><div className="muted">Job address</div>{b.address}</div>
      </div>
      {b.notes && <div className="small" style={{ whiteSpace: 'pre-wrap' }}><span className="muted">Notes: </span>{b.notes}</div>}
    </div>
  );
}

export default async function Bookings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const today = todayStr();
  const all = await q<B>(`SELECT * FROM bookings ORDER BY booking_date, booking_time`);
  const pending = all.filter((b) => b.status === 'requested');
  const upcoming = all.filter((b) => b.status === 'confirmed' && b.booking_date >= today);
  const past = all.filter((b) => !pending.includes(b) && !upcoming.includes(b)).reverse().slice(0, 25);
  return (
    <>
      <div className="head">
        <div><h1>Bookings</h1><div className="sub">Requests from the website calendar. Confirming one adds it to the schedule and the customer list.</div></div>
        <Link className="btn ghost" href="/admin/settings#booking">Availability settings</Link>
      </div>
      {sp.confirmed && <div className="note" role="status">Confirmed and added to the schedule. <Link href={`/admin/schedule/${sp.confirmed}`}>Open the job</Link></div>}

      <h2 style={{ margin: '4px 0 12px' }}>Needs a response ({pending.length})</h2>
      <div className="stack">
        {pending.length === 0 && <div className="card empty">No new requests. They show up here the moment someone books.</div>}
        {pending.map((b) => (
          <Card key={b.id} b={b}>
            <form action={confirmBooking.bind(null, b.id)}><button className="btn sm" type="submit">Confirm and schedule</button></form>
            <a className="btn ghost sm" href={`sms:${b.phone}`}>Text</a>
            <ConfirmButton action={declineBooking.bind(null, b.id)} label="Decline" confirmLabel="Confirm decline" />
          </Card>
        ))}
      </div>

      <h2 style={{ margin: '28px 0 12px' }}>Confirmed ({upcoming.length})</h2>
      <div className="stack">
        {upcoming.length === 0 && <div className="card empty">No upcoming confirmed bookings.</div>}
        {upcoming.map((b) => (
          <Card key={b.id} b={b}>
            {b.job_id && <Link className="btn ghost sm" href={`/admin/schedule/${b.job_id}`}>Open job</Link>}
            <ConfirmButton action={cancelBooking.bind(null, b.id)} label="Cancel" confirmLabel="Confirm cancel" />
          </Card>
        ))}
      </div>

      {past.length > 0 && (
        <>
          <h2 style={{ margin: '28px 0 12px' }}>Earlier</h2>
          <div className="card flush"><div className="tbl-wrap"><table>
            <tbody>{past.map((b) => (
              <tr key={b.id}><td className="nowrap">{fmtDate(b.booking_date, false)} {fmtTime(b.booking_time)}</td><td>{b.company || b.name}<div className="sub">{b.service}</div></td><td><span className="badge">{b.status}</span></td></tr>
            ))}</tbody>
          </table></div></div>
        </>
      )}
    </>
  );
}
