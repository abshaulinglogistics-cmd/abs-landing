import { dayRate, getSettings, loadCustomers, loadJobs, loadServices } from '@/lib/data';
import { saveInvoice } from '@/lib/actions';
import { fmtDate, todayStr } from '@/lib/format';
import InvoiceEditor from '@/components/InvoiceEditor';
import { Flash } from '@/components/ui';

export const metadata = { title: 'New invoice' };

export default async function NewInvoice({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [customers, services, settings] = await Promise.all([loadCustomers(), loadServices(true), getSettings()]);
  let customerId: number | '' = Number(sp.customer) || '';
  let jobId: number | '' = '';
  let notes = '';
  if (sp.job) {
    const [j] = await loadJobs('WHERE j.id = $1', [Number(sp.job) || 0]);
    if (j) {
      jobId = j.id;
      customerId = j.customer_id;
      notes = [j.title, fmtDate(j.job_date), j.address].filter(Boolean).join(' | ');
    }
  }
  const c = customers.find((x) => x.id === customerId);
  return (
    <>
      <div className="head"><h1>New invoice</h1></div>
      <Flash sp={sp} />
      <InvoiceEditor
        customers={customers.filter((x) => x.status !== 'inactive' || x.id === customerId).map((x) => ({ id: x.id, name: x.name, partner_rate: x.partner_rate, default_discount_pct: x.default_discount_pct }))}
        services={services}
        dayRate={dayRate(settings)}
        action={saveInvoice.bind(null, null)}
        cancelHref="/admin/invoices"
        initial={{
          customer_id: customerId,
          job_id: jobId,
          issue_date: todayStr(),
          terms_days: c?.corporate && c.partner_rate ? 15 : Number(settings.default_terms_days) || 0,
          discount_type: c && c.default_discount_pct > 0 ? 'percent' : 'none',
          discount_value: c && c.default_discount_pct > 0 ? String(c.default_discount_pct) : '',
          discount_label: c && c.default_discount_pct > 0 ? 'Recurring account discount' : '',
          tax_pct: settings.default_tax_pct,
          notes,
          lines: [],
        }}
      />
    </>
  );
}
