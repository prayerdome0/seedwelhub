import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { REAL_LOGO } from '../assets';
import { useAuth } from '../contexts/AuthContext';
import SearchBar from '../components/SearchBar';
import Avatar from '../components/Avatar';
import MainMenuDrawer from '../components/navigation/MainMenuDrawer';
import AccountMenuDrawer from '../components/navigation/AccountMenuDrawer';
import NotificationBell from '../components/navigation/NotificationBell';
import { APP_NAME } from '../utils/constants';

// ---------------------------------------------------------------------------
// The application header, identical on every screen:
//
//     ☰ Menu  |  Seedwel Hub  |  🔔 Notifications  |  Account
//
// All navigation now lives in the drawers, which keeps the bar itself clean
// and consistent at every breakpoint. The desktop search stays in the header
// because it is a primary marketplace action, not navigation.
// ---------------------------------------------------------------------------
export default function Header() {
  const { user, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <header className="site-header">
        <div className="site-header__inner container">
          <button
            type="button"
            className="header-icon-btn header-icon-btn--menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open main menu"
            aria-expanded={menuOpen}
          >
            <span className="header-burger" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>

          <Link to="/" className="site-header__brand">
            <img
              src={REAL_LOGO}
              alt=""
              className="site-header__logo"
              width="36"
              height="36"
              decoding="async"
            />
            <span className="site-header__wordmark">{APP_NAME}</span>
          </Link>

          <div className="site-header__search">
            <SearchBar variant="header" />
          </div>

          <div className="site-header__actions">
            {user ? (
              <>
                <NotificationBell />
                <button
                  type="button"
                  className="header-account-btn"
                  onClick={() => setAccountOpen(true)}
                  aria-label="Open account menu"
                  aria-expanded={accountOpen}
                >
                  <Avatar
                    src={profile?.photoURL}
                    name={profile?.name || user.email}
                    size="sm"
                  />
                  <span className="header-account-btn__label">Account</span>
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--ghost btn--sm header-auth-btn">Log In</Link>
                <Link to="/register" className="btn btn--primary btn--sm">Sign Up</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <MainMenuDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
      <AccountMenuDrawer open={accountOpen} onClose={() => setAccountOpen(false)} />
    </>
  );
}
