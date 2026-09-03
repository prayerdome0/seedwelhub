import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  { to: '/admin', label: 'Overview', icon: '📊', end: true },
  { to: '/admin/users', label: 'Users', icon: '👥' },
  { to: '/admin/businesses', label: 'Businesses', icon: '🏢' },
  { to: '/admin/products', label: 'Products', icon: '📦' },
  { to: '/admin/orders', label: 'Orders', icon: '🧾' },
  { to: '/admin/payments', label: 'Payments', icon: '💳' },
  { to: '/admin/reports', label: 'Reports', icon: '📄' },
  { to: '/admin/verification', label: 'Verification', icon: '✅' },
  { to: '/admin/security', label: 'Security', icon: '🔒' },
];

export default function AdminLayout() {
  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Admin</h1>
        <p className="page__subtitle">Manage the Seedwel Hub platform.</p>
      </div>

      <div className="admin-layout">
        <nav className="admin-nav">
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `admin-nav__link ${isActive ? 'active' : ''}`}
            >
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </NavLink>
          ))}
        </nav>

        <div className="admin-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
