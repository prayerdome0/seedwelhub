import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Spinner from '../components/Spinner';
import AccountMenuDrawer from '../components/navigation/AccountMenuDrawer';
import { accountMenuFor } from '../navigation/menus';

// ---------------------------------------------------------------------------
// The Account hub.
//
// Rather than dumping profile, orders, receipts, invoices, payments and
// settings onto one long page, this screen is a clean launcher: an identity
// card, and the role-appropriate sections as tiles. The same drawer used in
// the header is available here through the menu button, so the account area
// keeps the drawer navigation model throughout.
// ---------------------------------------------------------------------------
export default function AccountPage() {
  const { user, profile, loading, isAdmin, isSeller, isVerifiedSeller } = useAuth();
  const { unreadCount } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="container page">
        <Spinner size="large" />
      </div>
    );
  }

  if (!user) return null;

  const viewer = { isAuthenticated: true, isSeller, isVerifiedSeller, isAdmin };
  const groups = accountMenuFor(viewer).filter((group) => group.items.length > 0);

  return (
    <div className="container page">
      <div className="account-head">
        <div className="account-head__identity">
          <Avatar src={profile?.photoURL} name={profile?.name || user.email} size="lg" />
          <div className="account-head__text">
            <h1 className="account-head__name">{profile?.name || 'My account'}</h1>
            <p className="account-head__mail">{user.email}</p>
            <div className="account-head__badges">
              <Badge tone={isSeller ? 'success' : 'neutral'}>{isSeller ? 'Seller' : 'Buyer'}</Badge>
              {isSeller && !isVerifiedSeller && <Badge tone="warning">Verification pending</Badge>}
              {isVerifiedSeller && !isAdmin && <Badge tone="success">Verified seller</Badge>}
              {isAdmin && <Badge tone="navy">Admin</Badge>}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn--outline account-head__menu"
          onClick={() => setMenuOpen(true)}
        >
          ☰ Account menu
        </button>
      </div>

      {groups.map((group) => (
        <section key={group.id} className="account-section">
          {group.label && <h2 className="account-section__title">{group.label}</h2>}
          <div className="account-grid">
            {group.items.map((item) => (
              <Link key={item.id} to={item.to} className="account-tile">
                <span className="account-tile__icon" aria-hidden="true">{item.icon}</span>
                <span className="account-tile__label">{item.label}</span>
                {item.badge === 'notifications' && unreadCount > 0 && (
                  <span className="account-tile__badge">{unreadCount}</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      ))}

      {isSeller && !isVerifiedSeller && (
        <div className="panel panel--muted mt-16">
          <h3 className="panel__title">Seller verification</h3>
          <p className="text-muted">
            Your Seller Dashboard unlocks once your business is verified. Verification protects
            buyers and gives your store a verified badge on the marketplace.
          </p>
          <Link to="/sell" className="btn btn--primary mt-16">Complete verification</Link>
        </div>
      )}

      <AccountMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
