'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/schedule', label: 'Schedule' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/invoices', label: 'Invoices' },
  { href: '/admin/settings', label: 'Settings' },
];

export default function Nav({ pending = 0 }: { pending?: number }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map((i) => {
        const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
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
