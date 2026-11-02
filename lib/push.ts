// Phone notifications (Web Push) for the admin app.
// Keys are created on first use and kept in the settings table, so there is nothing
// to configure in Vercel. Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY to override.
import webpush from 'web-push';
import { q } from './db';

type Keys = { publicKey: string; privateKey: string };
const g = globalThis as any;

export async function vapidKeys(): Promise<Keys> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  if (g.__absVapid) return g.__absVapid;
  const rows = await q<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key IN ('vapid_public','vapid_private')");
  const got = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!got.vapid_public || !got.vapid_private) {
    const k = webpush.generateVAPIDKeys();
    // DO NOTHING keeps whichever keys were saved first if two requests race.
    await q("INSERT INTO settings (key, value) VALUES ('vapid_public',$1),('vapid_private',$2) ON CONFLICT (key) DO NOTHING", [k.publicKey, k.privateKey]);
    return vapidKeys();
  }
  g.__absVapid = { publicKey: got.vapid_public, privateKey: got.vapid_private };
  return g.__absVapid;
}

export type PushMessage = { title: string; body: string; url?: string; tag?: string };

// Sends to every signed-up device. Never throws: a failed notification must not break a booking.
export async function notifyAll(msg: PushMessage): Promise<{ sent: number; failed: number }> {
  let sent = 0, failed = 0;
  try {
    const { publicKey, privateKey } = await vapidKeys();
    const subject = process.env.VAPID_SUBJECT || 'mailto:abshaulinglogistics@gmail.com';
    const subs = await q<{ id: number; endpoint: string; p256dh: string; auth: string }>('SELECT id, endpoint, p256dh, auth FROM push_subscriptions');
    const payload = JSON.stringify({ url: '/admin', ...msg });
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            vapidDetails: { subject, publicKey, privateKey },
            TTL: 60 * 60 * 24,
            urgency: 'high',
            timeout: 8000,
          });
          sent++;
        } catch (e: any) {
          failed++;
          // 404/410: the phone turned notifications off or the app was removed. Forget it.
          if (e?.statusCode === 404 || e?.statusCode === 410) await q('DELETE FROM push_subscriptions WHERE id=$1', [s.id]);
          else console.error('push failed', e?.statusCode, e?.body || e?.message);
        }
      }),
    );
  } catch (e) {
    console.error('push error', e);
  }
  return { sent, failed };
}
