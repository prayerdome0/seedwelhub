import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllRead,
  deleteNotification,
} from '../services/notificationService';
import { subscribe } from '../services/_base';
import { where } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { sortByTimestamp } from '../utils/format';
import { subscribeToForegroundMessages } from '../firebase/messaging';

const NotificationContext = createContext({
  notifications: [],
  unreadCount: 0,
  loading: true,
  refresh: () => {},
  markRead: () => {},
  markAllRead: () => {},
  remove: () => {},
});

const MAX_NOTIFICATIONS = 100;

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const apply = (items) => {
      if (!active) return;
      // Dismissed notifications are soft-deleted, so they are filtered out of
      // every list and out of the unread badge.
      setNotifications(
        sortByTimestamp((items || []).filter((n) => !n.deleted), 'createdAt', 'desc')
          .slice(0, MAX_NOTIFICATIONS)
      );
      setLoading(false);
    };

    const loadOnce = () =>
      getNotificationsForUser(user.uid, MAX_NOTIFICATIONS)
        .then(apply)
        .catch(() => apply([]));

    // Immediate read plus a realtime listener, so the bell/badge updates the
    // moment a notification is created (order, payment, message, admin action).
    loadOnce();
    const unsubscribe = subscribe(
      COLLECTIONS.NOTIFICATIONS,
      [where('recipientId', '==', user.uid)],
      {
        onData: apply,
        onError: () => loadOnce(),
      }
    );

    // If an FCM foreground push arrives while this screen is open, refresh the
    // in-app notification list right away.
    const unsubscribeFcm = subscribeToForegroundMessages(() => {
      if (active) loadOnce();
    });

    return () => {
      active = false;
      unsubscribe();
      if (typeof unsubscribeFcm === 'function') unsubscribeFcm();
    };
  }, [user, refreshKey]);

  const markRead = useCallback(
    async (id) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      await markNotificationRead(id).catch(() => {});
    },
    []
  );

  const markAll = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (user) await markAllRead(user.uid).catch(() => {});
  }, [user]);

  // Dismisses a single notification. The row disappears immediately; the
  // soft-delete write follows and failures never break the screen.
  const remove = useCallback(async (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteNotification(id).catch(() => {});
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refresh,
        markRead,
        markAllRead: markAll,
        remove,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider.');
  return context;
}
