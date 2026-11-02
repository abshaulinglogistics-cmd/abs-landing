// ABS Admin service worker: shows phone notifications and opens the app when one is tapped.
// It does not cache pages, so the admin always shows live data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(d.title || 'ABS Admin', {
      body: d.body || '',
      icon: '/icons/abs-192.png',
      badge: '/icons/abs-192.png',
      tag: d.tag || undefined,
      data: { url: d.url || '/admin' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/admin', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin + '/admin') && 'focus' in w) {
          return w.focus().then((c) => (c && 'navigate' in c ? c.navigate(url) : c));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
