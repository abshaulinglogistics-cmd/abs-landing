'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: { href: string; label: string; also?: string[] }[] = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/payments', label: 'Payments', also: ['/admin/invoices'] },
  { href: '/admin/settings', label: 'Settings' },
];

export default function Nav({ pending = 0 }: { pending?: number }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map((i) => {
        const active = i.href === '/admin' ? path === '/admin' : [i.href, ...(i.also ?? [])].some((h) => path.startsWith(h));
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}>
            {i.label}
            {i.href === '/admin/bookings' && pending > 0 && <span className="badge warn" style={{ marginLeft: 8 }}>{pending}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
