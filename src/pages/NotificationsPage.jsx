import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import Spinner from '../components/Spinner';
import Button from '../components/Button';
import { EmptyState } from '../components/PageState';
import { notificationRoute, notificationIcon } from '../navigation/notificationRoutes';
import { relativeTime } from '../utils/format';
import { NOTIFICATION_TYPES } from '../utils/constants';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: NOTIFICATION_TYPES.ORDERS, label: 'Orders' },
  { id: NOTIFICATION_TYPES.PAYMENTS, label: 'Payments' },
  { id: NOTIFICATION_TYPES.INVOICES, label: 'Invoices' },
  { id: NOTIFICATION_TYPES.QUOTATIONS, label: 'Quotations' },
  { id: NOTIFICATION_TYPES.RECEIPTS, label: 'Receipts' },
  { id: NOTIFICATION_TYPES.MESSAGES, label: 'Messages' },
  { id: NOTIFICATION_TYPES.BUSINESS, label: 'Business' },
  { id: NOTIFICATION_TYPES.SECURITY, label: 'Security' },
];

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, loading, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  // Only show filters that actually have notifications, so the tab strip stays
  // short instead of overflowing with empty categories.
  const activeFilters = useMemo(() => {
    const present = new Set(notifications.map((n) => n.type));
    return FILTERS.filter((f) => f.id === 'all' || present.has(f.id));
  }, [notifications]);

  if (!user) {
    return (
      <div className="container page">
        <EmptyState
          title="Sign in to view notifications"
          message="Please log in to see your notifications."
          action={<Link to="/login" className="btn btn--primary">Log In</Link>}
        />
      </div>
    );
  }

  // Clicking a notification marks it read and jumps straight to the item.
  const handleOpen = (notification) => {
    markRead(notification.id);
    const route = notificationRoute(notification);
    if (route) navigate(route);
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Notifications</h1>
        <p className="page__subtitle">
          Messages, orders, payments, invoices, quotations, account and security updates.
          {unreadCount > 0 && <> · <strong>{unreadCount} unread</strong></>}
        </p>
        <div className="mt-8 notif-toolbar">
          {!loading && unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => markAllRead()}>
              Mark all as read
            </Button>
          )}
          <Link to="/settings?tab=notifications" className="btn btn--outline btn--sm">
            Notification preferences
          </Link>
        </div>
      </div>

      {activeFilters.length > 1 && (
        <div className="tabs">
          {activeFilters.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`tabs__tab ${filter === f.id ? 'active' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {loading && <Spinner size="large" />}

      {!loading && notifications.length === 0 && (
        <EmptyState title="Nothing here yet" message="You're all caught up." />
      )}

      {!loading && notifications.length > 0 && filtered.length === 0 && (
        <EmptyState title="Nothing here yet" message="No notifications in this category." />
      )}

      {!loading && filtered.length > 0 && (
        <div className="panel">
          {filtered.map((notification) => {
            const route = notificationRoute(notification);
            return (
              <div key={notification.id} className="notif-row">
                <button
                  type="button"
                  className={`notif-item ${notification.read ? '' : 'unread'} ${route ? 'is-clickable' : ''}`}
                  onClick={() => handleOpen(notification)}
                >
                  <div className="notif-item__icon">{notificationIcon(notification)}</div>
                  <div className="notif-item__body">
                    <div className="notif-item__title">{notification.title}</div>
                    <div className="notif-item__msg">{notification.message}</div>
                    <div className="notif-item__time">{relativeTime(notification.createdAt)}</div>
                  </div>
                  {!notification.read && <span className="notif-dot" />}
                </button>
                <div className="notif-row__actions">
                  {!notification.read && (
                    <button
                      type="button"
                      className="notif-row__action"
                      onClick={() => markRead(notification.id)}
                      title="Mark as read"
                      aria-label="Mark as read"
                    >
                      ✓
                    </button>
                  )}
                  <button
                    type="button"
                    className="notif-row__action notif-row__action--danger"
                    onClick={() => remove(notification.id)}
                    title="Delete notification"
                    aria-label="Delete notification"
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
