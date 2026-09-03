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

messaging.onBackgroundMessage((payload) => {
  const { notification, data } = payload || {};
  const title = notification?.title || 'Seedwel Hub';
  const body = notification?.body || 'You have a new notification.';
  const tag = data?.url ? 'seedwel-notification' : 'seedwel-default';

  self.registration.showNotification(title, {
    body,
    icon: '/Reallogo.png',
    badge: '/Reallogo.png',
    data: { url: data?.url || '/' },
    tag,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
