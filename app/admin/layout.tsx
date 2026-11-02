import '../globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: { default: 'ABS Admin Hub', template: '%s | ABS Admin Hub' },
  description: 'Schedule, invoices, receipts and customers for ABS Hauling & Logistics',
  robots: { index: false, follow: false },
  // Lets the admin be added to a phone's home screen and open full screen like an app.
  manifest: '/admin.webmanifest',
  applicationName: 'ABS Admin',
  appleWebApp: { capable: true, title: 'ABS Admin', statusBarStyle: 'black' },
  icons: { icon: [{ url: '/icons/favicon-32.png', sizes: '32x32' }, { url: '/icons/abs-192.png', sizes: '192x192' }], apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
  // Older iPhones only open full screen with the apple- prefixed tag.
  other: { 'apple-mobile-web-app-capable': 'yes' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#0d0f0d' };
export const dynamic = 'force-dynamic';

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
