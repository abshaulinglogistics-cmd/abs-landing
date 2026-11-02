import '../globals.css';
import type { Viewport } from 'next';

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export const dynamic = 'force-dynamic';

export default function PublicRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="pub">{children}</div>
      </body>
    </html>
  );
}
