import Link from 'next/link';

// Tabs shown at the top of the Payments section: payment tracking, and the invoices that sit under it.
export default function MoneyTabs({ current }: { current: 'payments' | 'invoices' }) {
  return (
    <div className="tabs" role="tablist" aria-label="Payments section">
      <Link href="/admin/payments" role="tab" aria-selected={current === 'payments'} aria-current={current === 'payments' ? 'page' : undefined}>Payments</Link>
      <Link href="/admin/invoices" role="tab" aria-selected={current === 'invoices'} aria-current={current === 'invoices' ? 'page' : undefined}>Invoices</Link>
    </div>
  );
}
