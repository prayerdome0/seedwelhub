import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app } from './config';

// The public VAPID key is configured client-side. The corresponding private key
// must live server-side (in the Firebase project settings) and is never placed
// in React source, public/, GitHub, HTML or browser storage.
export const VAPID_PUBLIC_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_PUBLIC_KEY || '';

// Cache the messaging instance (only created when the browser supports it).
let messagingInstance = null;

let messagingSupportedPromise = null;

export function messagingSupported() {
  if (!messagingSupportedPromise) {
    messagingSupportedPromise = isSupported().catch(() => false);
  }
  return messagingSupportedPromise;
}

export async function getMessagingInstance() {
  const supported = await messagingSupported();
  if (!supported) return null;
  if (!messagingInstance) {
    messagingInstance = getMessaging(app);
  }
  return messagingInstance;
}

// Registers the service worker, requests permission and retrieves the FCM token.
export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { ok: false, reason: 'unsupported' };
  }
  const permission = await Notification.requestPermission();
  return { ok: permission === 'granted', permission };
}

export async function getFirebaseMessagingToken() {
  const messaging = await getMessagingInstance();
  if (!messaging) return { ok: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, reason: 'no-vapid-key' };

  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    }
    const currentToken = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
    });
    if (currentToken) {
      return { ok: true, token: currentToken };
    }
    return { ok: false, reason: 'no-token' };
  } catch (error) {
    // The app must never break because push messaging is unavailable.
    console.warn('FCM token error:', error.message || error);
    return { ok: false, reason: 'error' };
  }
}

export function subscribeToForegroundMessages(handler) {
  const messaging = getMessagingInstance();
  // Resolve lazily; onMessage needs a ready instance.
  messaging
    .then((instance) => {
      if (!instance) return () => {};
      return onMessage(instance, handler);
    })
    .catch(() => {});
  return () => {};
}

export function friendlyNotificationError() {
  return 'Notifications are not available in your browser.';
}
