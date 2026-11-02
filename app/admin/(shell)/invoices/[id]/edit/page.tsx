import { notFound } from 'next/navigation';
import { getSettings, loadCustomers, loadInvoices, loadServices } from '@/lib/data';
import { saveInvoice } from '@/lib/actions';
import { diffDays, invNo } from '@/lib/format';
import InvoiceEditor from '@/components/InvoiceEditor';
import { Flash } from '@/components/ui';

export const metadata = { title: 'Edit invoice' };

export default async function EditInvoice({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const [inv] = await loadInvoices({ id: Number(id) || 0 });
  if (!inv) notFound();
  const [customers, services] = await Promise.all([loadCustomers(), loadServices(true)]);
  const known = new Set(services.map((s) => s.name));
  return (
    <>
      <div className="head"><h1>Edit {invNo(inv.number)}</h1></div>
      <Flash sp={sp} />
      <InvoiceEditor
        customers={customers.map((x) => ({ id: x.id, name: x.name, partner_rate: x.partner_rate, default_discount_pct: x.default_discount_pct }))}
        services={services}
        action={saveInvoice.bind(null, inv.id)}
        cancelHref={`/admin/invoices/${inv.id}`}
        hasPayments={inv.payments.length > 0}
        initial={{
          customer_id: inv.customer_id,
          job_id: inv.job_id ?? '',
          issue_date: inv.issue_date,
          terms_days: Math.max(0, diffDays(inv.due_date, inv.issue_date)),
          discount_type: inv.discount_type,
          discount_value: inv.discount_type === 'flat' ? (inv.discount_value / 100).toFixed(2) : inv.discount_value ? String(inv.discount_value) : '',
          discount_label: inv.discount_label ?? '',
          tax_pct: String(inv.tax_pct ?? 0),
          notes: inv.notes ?? '',
          lines: inv.items.map((i) => ({
            description: i.description, qty: String(i.qty), unit: i.unit, rate: (i.rate_cents / 100).toFixed(2), kind: i.kind, edited: true,
            serviceId: known.has(i.description) ? services.find((s) => s.name === i.description)?.id : undefined,
          })),
        }}
      />
    </>
  );
}
