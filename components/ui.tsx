import type { Customer, InvoiceState } from '@/lib/data';
import { CUSTOMER_TYPES } from '@/lib/format';

export const STATE_LABEL: Record<InvoiceState, string> = {
  paid: 'Paid', partial: 'Partial', open: 'Unpaid', overdue: 'Overdue', void: 'Void',
};
const STATE_CLASS: Record<InvoiceState, string> = {
  paid: 'green', partial: 'info', open: '', overdue: 'bad', void: '',
};
export function StateBadge({ state }: { state: InvoiceState }) {
  return <span className={`badge ${STATE_CLASS[state]}`}>{STATE_LABEL[state]}</span>;
}

export function JobBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    scheduled: ['Scheduled', 'info'], in_progress: ['In progress', 'warn'], done: ['Done', 'green'], cancelled: ['Cancelled', 'bad'],
  };
  const [label, cls] = map[status] ?? [status, ''];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export function CustomerTags({ c }: { c: Customer }) {
  return (
    <span className="badges">
      {c.status === 'prospect' && <span className="badge info">Prospect</span>}
      {c.status === 'inactive' && <span className="badge">Inactive</span>}
      {c.corporate && <span className="badge">Corporate</span>}
      {c.repeat && <span className="badge green">Repeat</span>}
      {c.partner_rate && <span className="badge green">Partner rate</span>}
      {c.dormant && <span className="badge warn">Follow up</span>}
    </span>
  );
}

export function Flash({ sp }: { sp: Record<string, string | undefined> }) {
  const msgs: Record<string, string> = {
    name: 'A name is required.',
    job: 'Pick a customer, enter a title and choose a date.',
    amount: 'Enter a payment amount greater than zero.',
    'has-records': 'This customer has jobs or invoices, so it cannot be deleted. Mark it inactive instead.',
    'has-payments': 'This invoice has payments. Delete the payments first, or void the invoice.',
    service: 'A rate card entry needs a name.',
    number: 'Another invoice already uses that number. Pick a different one.',
    '1': 'Add a customer and at least one line item.',
  };
  if (sp.error) return <div className="note err" role="alert">{msgs[sp.error] ?? 'Something did not save. Check the form and try again.'}</div>;
  if (sp.saved) return <div className="note" role="status">Saved.</div>;
  return null;
}

export function CustomerFields({ c }: { c?: Partial<Customer> }) {
  return (
    <div className="grid two">
      <label className="f span-all">Business or customer name
        <input name="name" required defaultValue={c?.name ?? ''} />
      </label>
      <label className="f">Type
        <select name="type" defaultValue={c?.type ?? 'Corporate / Business'}>
          {CUSTOMER_TYPES.map((t) => <option key={t}>{t}</option>)}
        </select>
      </label>
      <label className="f">Status
        <select name="status" defaultValue={c?.status ?? 'active'}>
          <option value="prospect">Prospect (not a customer yet)</option>
          <option value="active">Active customer</option>
          <option value="inactive">Inactive</option>
        </select>
      </label>
      <label className="f">Contact person
        <input name="contact_name" defaultValue={c?.contact_name ?? ''} />
      </label>
      <label className="f">Phone
        <input name="phone" type="tel" defaultValue={c?.phone ?? ''} />
      </label>
      <label className="f">Email
        <input name="email" type="email" defaultValue={c?.email ?? ''} />
      </label>
      <label className="f">Address
        <input name="address" defaultValue={c?.address ?? ''} />
      </label>
      <label className="f check span-all">
        <input type="checkbox" name="partner_rate" defaultChecked={!!c?.partner_rate} />
        Preferred Partner rates (signed agreement or recurring volume)
      </label>
      <label className="f">Standing discount %
        <input name="default_discount_pct" inputMode="decimal" defaultValue={c?.default_discount_pct ?? 0} />
      </label>
      <label className="f span-all">Notes
        <textarea name="notes" defaultValue={c?.notes ?? ''} placeholder="Gate codes, who approves invoices, preferred days, anything useful for the next visit" />
      </label>
    </div>
  );
}

export function JobFields({ customers, job, defaultDate, defaultCustomer, back }: {
  customers: { id: number; name: string; address: string }[];
  job?: { customer_id: number; title: string; job_date: string; start_time: string; address: string; status: string; notes: string };
  defaultDate?: string;
  defaultCustomer?: number;
  back: string;
}) {
  return (
    <div className="grid two">
      <input type="hidden" name="back" value={back} />
      <label className="f">Customer
        <select name="customer_id" required defaultValue={job?.customer_id ?? defaultCustomer ?? ''}>
          <option value="">Choose a customer</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="f">Job
        <input name="title" required defaultValue={job?.title ?? ''} placeholder="e.g. 2BR cleanout, deck demo, move-out haul" />
      </label>
      <label className="f">Date
        <input type="date" name="job_date" required defaultValue={job?.job_date ?? defaultDate ?? ''} />
      </label>
      <label className="f">Start time
        <input type="time" name="start_time" defaultValue={job?.start_time ?? ''} />
      </label>
      <label className="f span-all">Job address
        <input name="address" defaultValue={job?.address ?? ''} />
      </label>
      <label className="f">Status
        <select name="status" defaultValue={job?.status ?? 'scheduled'}>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="f span-all">Notes
        <textarea name="notes" defaultValue={job?.notes ?? ''} />
      </label>
    </div>
  );
}

