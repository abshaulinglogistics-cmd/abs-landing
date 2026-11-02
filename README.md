# ABS Hauling & Logistics: website, booking and admin hub

One Next.js project for Vercel:

| URL | What it is | Public? |
| --- | --- | --- |
| `/` | The landing page, moved over from Netlify. Markup is unchanged. The Calendly block is replaced by the built-in booking calendar. | Yes |
| `/book` | The same booking calendar on its own page (handy to text or put on Instagram). | Yes |
| `/admin` | Dashboard, Bookings, Schedule, Customers, Invoices, Settings. | **Password** |
| `/i/<token>`, `/r/<token>` | Customer-facing invoice and receipt links (and PDFs). Unguessable links. | Yes |

## Online booking
- Customers pick a day and time on a calendar, then give their name, phone, job address and what they need.
- Each request lands in **Admin > Bookings** (and on the dashboard). **Confirm and schedule** creates the job on the schedule and adds the customer, or matches an existing one by phone or email. **Decline** frees the time.
- Time is held the moment someone requests it, so two people cannot book the same slot. Jobs on the schedule that have a start time also block their slots.
- **Admin > Settings > Online booking** controls the days you work, first and last start time, how long to hold per booking, minimum notice, how far ahead people can book, and days off.
- There is no email or text alert yet. New requests show on the dashboard and as a badge on Bookings. Adding an alert is the natural next step (Resend for email, Twilio for text).

## Deploy on Vercel
1. Push this folder to a GitHub repo and import it in Vercel (framework: Next.js).
2. **Storage** tab: add a **Postgres** database (Neon) and connect it to the project. This adds `DATABASE_URL`.
3. **Settings > Environment Variables**: add `ADMIN_PASSWORD` (the login for `/admin`) and `AUTH_SECRET` (a long random string).
4. Deploy. Tables and the starting rate card are created on the first visit.
5. **Settings > Domains**: add the domain you want. Then point it away from Netlify when you are ready.

If `ADMIN_PASSWORD` is missing in production, `/admin` stays locked and the login page says so. It never opens by accident.

## Run locally
```
npm install
npm run dev
```
With no `DATABASE_URL` it uses a small local database in `.data/`. Locally, with no `ADMIN_PASSWORD`, `/admin` opens without a login.

## Where things are
- `lib/site-html.ts`, `app/(site)/landing.css`: the landing page, copied from the Netlify file
- `components/BookingWidget.tsx`: the calendar and booking form
- `lib/booking.ts`: availability rules (days, hours, holds, days off)
- `app/api/booking/*`: public booking endpoints (availability and create)
- `lib/calc.ts`: invoice math, used by the editor, pages and PDFs
- `lib/pdf.ts`: invoice and receipt PDF layout
- `lib/actions.ts`: everything in admin that saves data
- `lib/db.ts`: schema and the starting rate card
