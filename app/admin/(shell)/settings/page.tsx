import { getSettings, loadServices } from '@/lib/data';
import { getBookingSettings } from '@/lib/booking';
import { removePushDevice, saveBookingSettings, saveService, saveSettings } from '@/lib/actions';
import PushSetup from '@/components/PushSetup';
import { q } from '@/lib/db';
import { fmtDate } from '@/lib/format';
import { TERMS } from '@/lib/format';
import { Flash } from '@/components/ui';

export const metadata = { title: 'Settings' };

const dollars = (c: number) => (c / 100).toFixed(2);

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [s, services, bk, devices] = await Promise.all([
    getSettings(), loadServices(), getBookingSettings(),
    q<{ id: number; device: string; created_at: string }>("SELECT id, device, to_char(created_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS created_at FROM push_subscriptions ORDER BY id"),
  ]);
  const openDays = new Set(bk.book_days.split(',').map(Number));
  const DAYNAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return (
    <>
      <div className="head"><div><h1>Settings</h1><div className="sub">Business details on invoices and receipts, and the rate card used to build invoices.</div></div></div>
      <Flash sp={sp} />
      <div className="card stack" id="notify" style={{ maxWidth: 860, marginBottom: 18 }}>
        <h2>Phone notifications</h2>
        <p className="muted small" style={{ margin: 0 }}>Get a notification on your phone the moment someone books on the website. Turn it on once on each phone (Anthony and Jadon each do their own).</p>
        <PushSetup />
        {devices.length > 0 && (
          <div>
            <div className="muted small" style={{ fontWeight: 600, marginBottom: 6 }}>Devices getting notifications</div>
            <div className="rows">{devices.map((d) => (
              <div className="row" key={d.id} style={{ padding: '8px 0' }}>
                <div className="grow small">{d.device || 'Device'} <span className="muted">- added {fmtDate(d.created_at)}</span></div>
                <form action={removePushDevice.bind(null, d.id)}><button className="btn ghost sm" type="submit">Remove</button></form>
              </div>
            ))}</div>
          </div>
        )}
      </div>

      <form action={saveSettings} className="card stack" style={{ maxWidth: 860 }}>
        <h2>Business</h2>
        <div className="grid two">
          <label className="f">Business name<input name="business_name" defaultValue={s.business_name} /></label>
          <label className="f">Owner<input name="owner_name" defaultValue={s.owner_name} /></label>
          <label className="f">Phone<input name="phone" defaultValue={s.phone} /></label>
          <label className="f">Email<input name="email" defaultValue={s.email} /></label>
          <label className="f">Address<input name="address" defaultValue={s.address} /></label>
          <label className="f">Website<input name="website" defaultValue={s.website} /></label>
          <label className="f span-all">Tagline (printed at the bottom of every PDF)<input name="tagline" defaultValue={s.tagline} /></label>
          <label className="f span-all">How to pay (shown on unpaid invoices)<textarea name="payment_instructions" defaultValue={s.payment_instructions} placeholder="e.g. Zelle to 404-740-9500, or cash on site" /></label>
          <label className="f span-all">Invoice footer<textarea name="invoice_footer" defaultValue={s.invoice_footer} /></label>
          <label className="f">Default payment terms
            <select name="default_terms_days" defaultValue={s.default_terms_days}>{TERMS.map((t) => <option key={t.days} value={t.days}>{t.label}</option>)}</select>
          </label>
          <label className="f">Default sales tax %<input name="default_tax_pct" inputMode="decimal" defaultValue={s.default_tax_pct} /></label>
          <label className="f">Start invoice numbers at (INV-)<input name="invoice_start_no" inputMode="numeric" defaultValue={s.invoice_start_no} /></label>
          <label className="f">Start receipt numbers at (RCT-)<input name="receipt_start_no" inputMode="numeric" defaultValue={s.receipt_start_no} /></label>
          <p className="muted small span-all" style={{ margin: 0 }}>New invoices and receipts count up from these numbers, or from the last one used if that is higher. To change the number on an invoice you already made, open it and choose Edit.</p>
        </div>
        <div><button className="btn" type="submit">Save settings</button></div>
      </form>


      <form action={saveBookingSettings} className="card stack" id="booking" style={{ marginTop: 18, maxWidth: 860 }}>
        <h2>Online booking</h2>
        <p className="muted small" style={{ margin: 0 }}>Controls which days and times show up on the website calendar. Scheduled jobs with a start time and booking requests hold their time so nobody can double book you.</p>
        <div>
          <div className="muted small" style={{ fontWeight: 600, marginBottom: 6 }}>Days you take bookings</div>
          <div className="actions" style={{ gap: 14 }}>
            {DAYNAMES.map((d, i) => (
              <label key={d} className="f check"><input type="checkbox" name={`day_${i}`} defaultChecked={openDays.has(i)} />{d}</label>
            ))}
          </div>
        </div>
        <div className="grid">
          <label className="f">First start time<input type="time" name="book_start" defaultValue={bk.book_start} /></label>
          <label className="f">Last start time<input type="time" name="book_end" defaultValue={bk.book_end} /></label>
          <label className="f">Time between start options (min)<input name="book_slot_minutes" inputMode="numeric" defaultValue={bk.book_slot_minutes} /></label>
          <label className="f">Time to hold per booking (min)<input name="book_hold_minutes" inputMode="numeric" defaultValue={bk.book_hold_minutes} /></label>
          <label className="f">Minimum notice (hours)<input name="book_notice_hours" inputMode="numeric" defaultValue={bk.book_notice_hours} /></label>
          <label className="f">How far ahead (days)<input name="book_max_days" inputMode="numeric" defaultValue={bk.book_max_days} /></label>
        </div>
        <label className="f">Days off (dates like 2026-11-26, separated by commas or new lines)
          <textarea name="book_blocked" defaultValue={bk.book_blocked} placeholder="2026-11-26, 2026-12-25" />
        </label>
        <div><button className="btn" type="submit">Save booking settings</button></div>
      </form>

      <div className="card flush" id="rates" style={{ marginTop: 18, maxWidth: 1100 }}>
        <div className="card-head"><h2>Rate card</h2><span className="muted small">Standard and Preferred Partner prices pre-fill invoice lines. You can still change any price on an invoice.</span></div>
        <div className="stack" style={{ gap: 0 }}>
          {services.map((v) => (
            <form key={v.id} action={saveService.bind(null, v.id)} className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <label className="f" style={{ flex: '2 1 220px' }}>Name<input name="name" defaultValue={v.name} /></label>
              <label className="f" style={{ flex: '3 1 260px' }}>Description<input name="description" defaultValue={v.description} /></label>
              <label className="f" style={{ flex: '0 1 80px' }}>Unit<input name="unit" defaultValue={v.unit} /></label>
              <label className="f" style={{ flex: '0 1 96px' }}>Standard $<input name="std" inputMode="decimal" defaultValue={dollars(v.std_cents)} /></label>
              <label className="f" style={{ flex: '0 1 96px' }}>Partner $<input name="partner" inputMode="decimal" defaultValue={dollars(v.partner_cents)} /></label>
              <label className="f" style={{ flex: '0 1 130px' }}>Type
                <select name="kind" defaultValue={v.kind}><option value="service">Service</option><option value="disposal">Disposal (no discount)</option></select>
              </label>
              <label className="f check"><input type="checkbox" name="active" defaultChecked={v.active} />Active</label>
              <div className="actions"><button className="btn sm" type="submit">Save</button></div>
            </form>
          ))}
        </div>
        <div className="card-head" style={{ borderTop: '1px solid var(--line)', borderBottom: 0 }}><h3>Add a rate</h3></div>
        <form action={saveService.bind(null, null)} className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label className="f" style={{ flex: '2 1 220px' }}>Name<input name="name" required /></label>
          <label className="f" style={{ flex: '3 1 260px' }}>Description<input name="description" /></label>
          <label className="f" style={{ flex: '0 1 80px' }}>Unit<input name="unit" defaultValue="each" /></label>
          <label className="f" style={{ flex: '0 1 96px' }}>Standard $<input name="std" inputMode="decimal" defaultValue="0.00" /></label>
          <label className="f" style={{ flex: '0 1 96px' }}>Partner $<input name="partner" inputMode="decimal" defaultValue="0.00" /></label>
          <input type="hidden" name="kind" value="service" /><input type="hidden" name="active" value="on" />
          <div className="actions"><button className="btn sm" type="submit">Add</button></div>
        </form>
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>Rate card starts from the ABS proposal rates. Ranges in the proposal are entered at the midpoint.</p>
    </>
  );
}
