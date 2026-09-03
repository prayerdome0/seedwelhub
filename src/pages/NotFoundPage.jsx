import { Link, useLocation, useNavigate } from 'react-router-dom';
import { WATERMARK_LOGO } from '../assets';

// ---------------------------------------------------------------------------
// Branded Seedwel Hub 404.
//
// Users must never see a raw host-level "404: NOT_FOUND". Unknown routes are
// caught by the router (see App.jsx "*") and rendered here, inside the normal
// app shell, with clear ways back into the product.
// ---------------------------------------------------------------------------
export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();

  // Only offer "Go Back" when there is somewhere to go back to; otherwise the
  // button would dead-end outside the app.
  const canGoBack =
    typeof window !== 'undefined' && window.history.length > 1;

  return (
    <div className="notfound">
      <img
        loading="lazy"
        decoding="async"
        src={WATERMARK_LOGO}
        alt="Seedwel Hub"
        className="notfound__logo"
      />

      <svg
        className="notfound__art"
        viewBox="0 0 220 130"
        role="img"
        aria-label="Page not found illustration"
      >
        <circle cx="110" cy="66" r="52" fill="var(--green, #1f8a4c)" opacity="0.08" />
        <circle
          cx="98"
          cy="58"
          r="30"
          fill="none"
          stroke="var(--green, #1f8a4c)"
          strokeWidth="6"
        />
        <line
          x1="120"
          y1="80"
          x2="146"
          y2="106"
          stroke="var(--green, #1f8a4c)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M88 52 l10 10 M98 52 l-10 10"
          stroke="var(--green, #1f8a4c)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M104 52 l10 10 M114 52 l-10 10"
          stroke="var(--green, #1f8a4c)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      <div className="notfound__code">404</div>
      <h1 className="notfound__title">Page Not Found</h1>
      <p className="notfound__msg">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It may have
        been moved, deleted, or the link may be incorrect.
      </p>

      {location?.pathname && location.pathname !== '/' && (
        <p className="notfound__path" title={location.pathname}>
          {location.pathname}
        </p>
      )}

      <div className="notfound__actions">
        <Link to="/" className="btn btn--primary">Go Home</Link>
        {canGoBack && (
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => navigate(-1)}
          >
            Go Back
          </button>
        )}
      </div>
      <div className="notfound__actions notfound__actions--secondary">
        <Link to="/marketplace" className="btn btn--outline">Browse Marketplace</Link>
      </div>

      <nav className="notfound__links" aria-label="Popular destinations">
        <Link to="/products">Products</Link>
        <Link to="/services">Services</Link>
        <Link to="/messages">Messages</Link>
        <Link to="/orders">Orders</Link>
        <Link to="/account">Account</Link>
      </nav>
    </div>
  );
}
