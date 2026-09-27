/* Firebase Cloud Messaging service worker.
 *
 * The private FCM/VAPID server key is NEVER present in this file or anywhere in
 * the client bundle. This worker only handles incoming push events and
 * notification clicks using the message payload.
 */
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

// Public configuration used by the client to subscribe to the project. None of
// these values are secret.
firebase.initializeApp({
  apiKey: 'AIzaSyDLqKqyR5yEDTZHAF0uxVf7bo1gPF9z89E',
  authDomain: 'phiko-trading.firebaseapp.com',
  projectId: 'phiko-trading',
  storageBucket: 'phiko-trading.firebasestorage.app',
  messagingSenderId: '502225836758',
  appId: '1:502225836758:web:6ef2df26362622b359c777',
});

const messaging = firebase.messaging();

// Only allow same-origin relative paths (or absolute URLs on this origin).
// Prevents a crafted push payload from opening an external site on click.
function safeNotificationUrl(raw) {
  const fallback = '/';
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    // Absolute URL — must match this origin.
    if (/^https?:\/\//i.test(raw)) {
      const target = new URL(raw);
      if (target.origin === self.location.origin) {
        return target.pathname + target.search + target.hash;
      }
      return fallback;
    }
    // Protocol-relative or backslash tricks → reject.
    if (raw.startsWith('//') || raw.includes('\\')) return fallback;
    // Relative path only.
    if (raw.startsWith('/')) return raw;
    return fallback;
  } catch {
    return fallback;
  }
}

messaging.onBackgroundMessage((payload) => {
  const { notification, data } = payload || {};
  const title = notification?.title || 'Seedwel Hub';
  const body = notification?.body || 'You have a new notification.';
  const url = safeNotificationUrl(data?.url);
  const tag = data?.url ? 'seedwel-notification' : 'seedwel-default';

  self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url },
    tag,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = safeNotificationUrl(event.notification?.data?.url);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (typeof client.navigate === 'function') {
            return client.navigate(url).then((c) => (c && c.focus ? c.focus() : client.focus()));
          }
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
