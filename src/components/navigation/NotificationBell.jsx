import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';
import { notificationIcon, notificationRoute } from '../../navigation/notificationRoutes';
import { relativeTime } from '../../utils/format';

// Header notification bell with a compact preview panel. Clicking an entry
// marks it read and navigates straight to the item it refers to.
export default function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const recent = notifications.slice(0, 6);

  const handleOpenItem = (notification) => {
    markRead(notification.id);
    setOpen(false);
    const route = notificationRoute(notification);
    if (route) navigate(route);
  };

  return (
    <div className="notif-bell" ref={wrapRef}>
      <button
        type="button"
        className="header-icon-btn"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="header-icon-btn__badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notif-pop" role="menu">
          <div className="notif-pop__head">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button type="button" className="notif-pop__mark" onClick={() => markAllRead()}>
                Mark all read
              </button>
            )}
          </div>

          {recent.length === 0 ? (
            <p className="notif-pop__empty">You're all caught up.</p>
          ) : (
            <ul className="notif-pop__list">
              {recent.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notif-pop__item ${notification.read ? '' : 'is-unread'}`}
                    onClick={() => handleOpenItem(notification)}
                  >
                    <span className="notif-pop__icon" aria-hidden="true">
                      {notificationIcon(notification)}
                    </span>
                    <span className="notif-pop__body">
                      <span className="notif-pop__title">{notification.title}</span>
                      <span className="notif-pop__msg">{notification.message}</span>
                      <span className="notif-pop__time">{relativeTime(notification.createdAt)}</span>
                    </span>
                    {!notification.read && <span className="notif-dot" />}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Link to="/notifications" className="notif-pop__all" onClick={() => setOpen(false)}>
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
