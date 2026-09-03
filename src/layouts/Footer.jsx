import { Link } from 'react-router-dom';
import { REAL_LOGO } from '../assets';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <img loading="lazy" decoding="async" src={REAL_LOGO} alt="Xacheus" className="site-footer__logo" />
          <div>
            <p className="site-footer__name">Xacheus</p>
            <p className="site-footer__tagline">Connect. Share. Discover.</p>
          </div>
        </div>

        <div className="site-footer__links">
          <div className="site-footer__col">
            <h4>Discover</h4>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/services">Services</Link>
            <Link to="/businesses">Businesses</Link>
            <Link to="/groups">Groups</Link>
            <Link to="/search">Search</Link>
          </div>
          <div className="site-footer__col">
            <h4>Account</h4>
            <Link to="/messages">Messages</Link>
            <Link to="/profile">Profile</Link>
            <Link to="/notifications">Notifications</Link>
            <Link to="/settings">Settings</Link>
          </div>
          <div className="site-footer__col">
            <h4>Social</h4>
            <Link to="/about">About</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/help">Help</Link>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container">
          © {new Date().getFullYear()} Xacheus. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
