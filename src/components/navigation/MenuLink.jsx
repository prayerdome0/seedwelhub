import { NavLink } from 'react-router-dom';
import { useNotifications } from '../../contexts/NotificationContext';

// A single row inside a drawer menu. Supports an optional live badge (used by
// the Notifications entry) and matches query-string routes like
// `/seller?tab=orders` so the seller sub-entries highlight correctly.
export default function MenuLink({ item, onNavigate }) {
  const { unreadCount } = useNotifications();
  const badgeValue = item.badge === 'notifications' ? unreadCount : 0;
  const [pathname, search] = item.to.split('?');

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) => {
        // For `?tab=` links, NavLink ignores the query string, so match it
        // manually against the live location.
        const active = search
          ? typeof window !== 'undefined' &&
            window.location.pathname === pathname &&
            window.location.search.includes(search)
          : isActive;
        return `menu-link ${active ? 'is-active' : ''}`;
      }}
    >
      <span className="menu-link__icon" aria-hidden="true">{item.icon}</span>
      <span className="menu-link__label">{item.label}</span>
      {badgeValue > 0 && (
        <span className="menu-link__badge">{badgeValue > 99 ? '99+' : badgeValue}</span>
      )}
    </NavLink>
  );
}
