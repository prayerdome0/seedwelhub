import { Link } from 'react-router-dom';
import Image from './Image';
import StarRating from './StarRating';
import Badge from './Badge';

export default function BusinessCard({ business }) {
  if (!business) return null;
  const location = [business.city, business.region, business.country]
    .filter(Boolean)
    .join(', ');

  return (
    <Link to={`/business/${business.id}`} className="card business-card">
      <div className="business-card__media">
        {business.logo ? (
          <Image src={business.logo} alt={business.name} className="business-card__logo" />
        ) : (
          <div className="business-card__logo business-card__logo--empty">{business.name?.[0] || 'B'}</div>
        )}
        {business.isVerified && <Badge tone="success" className="business-card__verified">✓ Verified</Badge>}
      </div>
      <div className="business-card__body">
        <h3 className="business-card__title">{business.name || 'Unnamed business'}</h3>
        {business.category && <Badge tone="info">{business.category}</Badge>}
        {location && <div className="business-card__location">📍 {location}</div>}
        {business.description && (
          <p className="business-card__desc">{business.description}</p>
        )}
        <div className="business-card__meta">
          {business.rating !== undefined && (
            <StarRating rating={business.rating} count={business.reviewCount} />
          )}
        </div>
      </div>
    </Link>
  );
}
