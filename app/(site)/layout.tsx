import './landing.css';
import type { Metadata, Viewport } from 'next';

const DESCRIPTION =
  'Junk removal, demolition, hauling, moving support, and pickup & delivery serving South Fulton and the greater Atlanta Metro area — Union City, Fairburn, Palmetto, East Point, College Park & more. Call or text 404-740-9500.';

export const metadata: Metadata = {
  title: 'ABS Hauling & Logistics | Junk Removal, Demo & Hauling — South Fulton & Atlanta Metro',
  description: DESCRIPTION,
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function SiteRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
