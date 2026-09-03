import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { REAL_LOGO } from '../assets';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import SearchBar from '../components/SearchBar';
import Avatar from '../components/Avatar';
import { logout } from '../firebase/auth';

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/marketplace', label: 'Marketplace' },
  { to: '/services', label: 'Services' },
  { to: '/businesses', label: 'Businesses' },
  { to: '/sell', label: 'Sell' },
];

export default function Header() {
  const { user, profile, isAdmin } = useAuth();
  const { unreadCount } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const closeMenu = () => setMenuOpen(false);

  const handleLogout = async () => {
    await logout().catch(() => {});
    closeMenu();
    navigate('/');
  };

  return (
    <header className="site-header">
      <div className="site-header__inner container">
        <Link to="/" className="site-header__brand" onClick={closeMenu}>
          <img src={REAL_LOGO} alt="Seedwel Hub" className="site-header__logo" />
          <span className="site-header__wordmark">Seedwel Hub</span>
        </Link>

        <div className="site-header__search">
          <SearchBar variant="header" />
        </div>

        <button
          type="button"
          className={`site-header__toggle ${menuOpen ? 'is-open' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        <nav className={`site-nav ${menuOpen ? 'is-open' : ''}`}>
          {NAV_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} className="site-nav__link" onClick={closeMenu}>
              {link.label}
            </NavLink>
          ))}

          {user ? (
            <div className="site-nav__account">
              <Link to="/notifications" className="site-nav__icon-link" onClick={closeMenu} aria-label="Notifications">
                🔔
                {unreadCount > 0 && <span className="site-nav__badge">{unreadCount}</span>}
              </Link>
              <div className="profile-menu">
                <button type="button" className="profile-menu__trigger" onClick={() => navigate('/profile')}>
                  <Avatar src={profile?.photoURL} name={profile?.name || user.email} size="sm" />
                  <span className="profile-menu__name">{profile?.name || user.email}</span>
                </button>
                <div className="profile-menu__dropdown">
                  <Link to="/profile" className="dropdown-link" onClick={closeMenu}>My Profile</Link>
                  {isAdmin && <Link to="/admin" className="dropdown-link" onClick={closeMenu}>Admin</Link>}
                  <Link to="/settings" className="dropdown-link" onClick={closeMenu}>Settings</Link>
                  <button type="button" className="dropdown-link" onClick={handleLogout}>Log Out</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="site-nav__auth">
              <Link to="/login" className="btn btn--ghost" onClick={closeMenu}>Log In</Link>
              <Link to="/register" className="btn btn--primary" onClick={closeMenu}>Sign Up</Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
