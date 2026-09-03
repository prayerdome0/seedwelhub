import { Link } from 'react-router-dom';
import { REAL_LOGO } from '../assets';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container site-footer__inner">
        <div className="site-footer__brand">
          <img src={REAL_LOGO} alt="Seedwel Hub" className="site-footer__logo" />
          <div>
            <p className="site-footer__name">Seedwel Hub</p>
            <p className="site-footer__tagline">Buy. Sell. Manage. Grow.</p>
          </div>
        </div>

        <div className="site-footer__links">
          <div className="site-footer__col">
            <h4>Discover</h4>
            <Link to="/marketplace">Marketplace</Link>
            <Link to="/services">Services</Link>
            <Link to="/businesses">Businesses</Link>
            <Link to="/search">Search</Link>
          </div>
          <div className="site-footer__col">
            <h4>Account</h4>
            <Link to="/profile">Profile</Link>
            <Link to="/orders">Orders</Link>
            <Link to="/notifications">Notifications</Link>
            <Link to="/settings">Settings</Link>
          </div>
          <div className="site-footer__col">
            <h4>Company</h4>
            <span>Seedwel Investment Limited</span>
            <span>Phiko Trading</span>
          </div>
        </div>
      </div>
      <div className="site-footer__bottom">
        <div className="container">
          © {new Date().getFullYear()} Seedwel Investment Limited. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
