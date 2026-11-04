/* Session staking minimal service worker: web push notifications + PWA install support. */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (error) {
    data = { title: 'Session', body: event.data.text() };
  }

  const title = data.title || 'Session';
  const options = {
    body: data.body || '',
    icon: '/images/icon-192.png',
    badge: '/images/icon-192.png',
    tag: data.tag,
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // The subscription must be renewed with our VAPID application server key; the
        // old subscription's options do not carry it, so fetch it from the app.
        const response = await fetch('/api/notifications/config');
        if (!response.ok) return;

        const { publicKey } = await response.json();
        if (!publicKey) return;

        const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
        const base64 = publicKey.replace(/-/g, '+').replace(/_/g, '/') + padding;
        const raw = atob(base64);
        const applicationServerKey = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) {
          applicationServerKey[i] = raw.charCodeAt(i);
        }

        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        await fetch('/api/notifications/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
            subscription: subscription.toJSON(),
          }),
        });
      } catch (error) {
        console.error('Failed to renew push subscription', error);
      }
    })()
  );
});
