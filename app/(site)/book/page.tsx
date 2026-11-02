import type { Metadata } from 'next';
import BookingWidget from '@/components/BookingWidget';
import { FOOTER_HTML, NAV_HTML } from '@/lib/site-html';

export const metadata: Metadata = {
  title: 'Book a Time | ABS Hauling & Logistics',
  description: 'Pick a day and time for junk removal, demolition, hauling, moving support or pickup & delivery in South Fulton and the Atlanta Metro.',
};

export default function BookPage() {
  const nav = NAV_HTML.replaceAll('href="#', 'href="/#');
  const footer = FOOTER_HTML.replaceAll('href="#', 'href="/#');
  return (
    <>
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: nav }} />
      <section className="band" style={{ borderTop: 0 }}>
        <div className="wrap bk-page">
          <div className="section-head">
            <div className="eyebrow">SCHEDULE DIRECTLY</div>
            <h1 className="h-font section-title" style={{ fontSize: 44 }}>Book a Time</h1>
            <p style={{ margin: '10px 0 0', fontSize: 15, color: 'var(--muted)' }}>Pick a slot that works for you — no phone tag required.</p>
          </div>
          <div className="book-card bk">
            <BookingWidget />
          </div>
        </div>
      </section>
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: footer }} />
    </>
  );
}
