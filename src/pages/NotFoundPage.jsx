import { Link, useNavigate } from 'react-router-dom';
import { WATERMARK_LOGO } from '../assets';

export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="notfound">
      <div className="notfound__code">404</div>
      <img loading="lazy" decoding="async" src={WATERMARK_LOGO} alt="Xacheus" style={{ height: 44, marginBottom: 16 }} />
      <h1 className="notfound__title">Page Not Found</h1>
      <p className="notfound__msg">
        The page you're looking for doesn't exist or may have been moved.
      </p>
      <div className="notfound__actions">
        <Link to="/" className="btn btn--primary">Go Home</Link>
        <button type="button" className="btn btn--secondary" onClick={() => navigate(-1)}>Go Back</button>
      </div>
    </div>
  );
}
