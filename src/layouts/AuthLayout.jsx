import { Link, Outlet } from 'react-router-dom';
import { REAL_LOGO } from '../assets';

export default function AuthLayout() {
  return (
    <div className="auth-shell">
      <div className="auth-shell__brand">
        <Link to="/" className="auth-shell__brand-link">
          <img loading="lazy" decoding="async" src={REAL_LOGO} alt="Seedwel Hub" className="auth-shell__logo" />
          <span className="auth-shell__wordmark">Seedwel Hub</span>
        </Link>
        <p className="auth-shell__tagline">Buy. Sell. Manage. Grow.</p>
      </div>
      <div className="auth-shell__panel">
        <div className="auth-shell__panel-inner">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
