import BookingWidget from '@/components/BookingWidget';
import { FOOTER_HTML, NAV_HTML, TOP_HTML } from '@/lib/site-html';

// Everything except the booking section is the original Netlify markup, unchanged.
export default function Home() {
  return (
    <>
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: NAV_HTML + TOP_HTML }} />
      <section id="book" className="band">
        <div className="wrap book-inner band-inner">
          <div className="section-head">
            <div className="eyebrow">SCHEDULE DIRECTLY</div>
            <h2 className="h-font section-title">Book a Time</h2>
            <p style={{ margin: 0, fontSize: 15, color: 'var(--muted)' }}>Pick a slot that works for you — no phone tag required.</p>
          </div>
          <div className="book-card bk">
            <BookingWidget />
          </div>
        </div>
      </section>
      <div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: FOOTER_HTML }} />
    </>
  );
}
