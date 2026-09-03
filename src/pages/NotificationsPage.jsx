import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import { relativeTime } from '../utils/format';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'messages', label: 'Messages' },
  { id: 'orders', label: 'Orders' },
  { id: 'payments', label: 'Payments' },
  { id: 'business', label: 'Business' },
  { id: 'security', label: 'Security' },
];

function relatedRoute(n) {
  const related = n.related || {};
  if (related.orderId) return `/order/${related.orderId}`;
  if (related.paymentId) return `/payment/${related.paymentId}`;
  if (related.businessId) return `/business/${related.businessId}`;
  if (related.conversationId) return `/messages/${related.conversationId}`;
  if (related.groupId) return `/group/${related.groupId}`;
  if (related.productId) return `/product/${related.productId}`;
  return null;
}

export default function NotificationsPage() {
  const { user } = useAuth();
  const { notifications, loading, markRead } = useNotifications();
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  if (!user) {
    return (
      <div className="container page">
        <EmptyState title="Sign in to view notifications" message="Please log in to see your notifications." />
      </div>
    );
  }

  const handleClick = (n) => {
    markRead(n.id);
    const route = relatedRoute(n);
    return route;
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Notifications</h1>
        <p className="page__subtitle">Updates on messages, orders, payments and security.</p>
      </div>

      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={`tabs__tab ${filter === f.id ? 'active' : ''}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading && <Spinner size="large" />}

      {!loading && notifications.length === 0 && (
        <EmptyState title="Nothing here yet" message="You're all caught up." />
      )}

      {!loading && notifications.length > 0 && filtered.length === 0 && (
        <EmptyState title="Nothing here yet" message={`No ${filter} notifications.`} />
      )}

      {!loading && filtered.length > 0 && (
        <div className="panel">
          {filtered.map((n) => {
            const route = relatedRoute(n);
            const content = (
              <>
                <div className="notif-item__icon">{n.type === 'security' ? '🔒' : n.type === 'payments' ? '💳' : n.type === 'orders' ? '📦' : n.type === 'business' ? '🏢' : n.type === 'messages' ? '💬' : '🔔'}</div>
                <div className="notif-item__body">
                  <div className="notif-item__title">{n.title}</div>
                  <div className="notif-item__msg">{n.message}</div>
                  <div className="notif-item__time">{relativeTime(n.createdAt)}</div>
                </div>
                {!n.read && <span className="notif-dot" />}
              </>
            );
            return (
              <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`} onClick={() => handleClick(n)}>
                {route ? (
                  <Link to={route} style={{ display: 'contents', width: '100%' }} onClick={() => markRead(n.id)}>{content}</Link>
                ) : (
                  content
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
