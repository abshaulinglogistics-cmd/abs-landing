'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Simple line icons (24px, stroke = currentColor)
const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V20h5v-6h4v6h5V9.5" />,
  bookings: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8.5 15l2.5 2.5 4.5-5" /></>,
  schedule: <><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4M7 13.5h2M11 13.5h2M15 13.5h2M7 17h2M11 17h2" /></>,
  customers: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.7.8 2.7 2.6 3 5.2" /></>,
  payments: <><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9v6M18 9v6" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
};
export function Icon({ name }: { name: string }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  );
}

// `phone: false` items are left out of the phone tab bar (Settings lives in the phone's top bar instead).
const ITEMS: { href: string; label: string; icon: string; also?: string[]; phone?: boolean }[] = [
  { href: '/admin', label: 'Dashboard', icon: 'home' },
  { href: '/admin/bookings', label: 'Bookings', icon: 'bookings' },
  { href: '/admin/schedule', label: 'Schedule', icon: 'schedule' },
  { href: '/admin/customers', label: 'Customers', icon: 'customers' },
  { href: '/admin/payments', label: 'Payments', icon: 'payments', also: ['/admin/invoices'] },
  { href: '/admin/settings', label: 'Settings', icon: 'settings', phone: false },
];

export default function Nav({ pending = 0 }: { pending?: number }) {
  const path = usePathname();
  return (
    <nav className="nav" aria-label="Main">
      {ITEMS.map((i) => {
        const active = i.href === '/admin' ? path === '/admin' : [i.href, ...(i.also ?? [])].some((h) => path.startsWith(h));
        return (
          <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined} className={i.phone === false ? 'wide-only' : undefined}>
            <span className="ico-wrap">
              <Icon name={i.icon} />
              {i.href === '/admin/bookings' && pending > 0 && <span className="dot" aria-label={`${pending} new`}>{pending}</span>}
            </span>
            <span className="lbl">{i.label === 'Dashboard' ? <><span className="wide-only">Dashboard</span><span className="phone-only">Home</span></> : i.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Settings + log out, shown in the top bar on phones.
export function PhoneTop({ showLogout, logout }: { showLogout: boolean; logout: () => Promise<void> }) {
  const path = usePathname();
  return (
    <div className="phone-top phone-only">
      <Link href="/admin/settings" aria-label="Settings" aria-current={path.startsWith('/admin/settings') ? 'page' : undefined}><Icon name="settings" /></Link>
      {showLogout && <form action={logout}><button className="linklike" type="submit">Log out</button></form>}
    </div>
  );
}
