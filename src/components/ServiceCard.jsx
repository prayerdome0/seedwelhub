import { Link } from 'react-router-dom';
import Image from './Image';
import Badge from './Badge';
import StarRating from './StarRating';
import { formatCurrency } from '../utils/format';

export default function ServiceCard({ service }) {
  if (!service) return null;
  const location = [service.city, service.region, service.country].filter(Boolean).join(', ');
  const rate = service.rate ?? service.price;

  return (
    <Link to={`/service/${service.id}`} className="card service-card">
      <div className="service-card__media">
        {service.image ? (
          <Image src={service.image} alt={service.name} className="service-card__img" />
        ) : (
          <div className="service-card__img service-card__img--empty">No image</div>
        )}
      </div>
      <div className="service-card__body">
        <h3 className="service-card__title">{service.name || 'Unnamed service'}</h3>
        {service.category && <Badge tone="info">{service.category}</Badge>}
        {service.businessName && <div className="service-card__provider">{service.businessName}</div>}
        {location && <div className="service-card__location">📍 {location}</div>}
        {rate !== undefined && rate !== null && (
          <div className="service-card__rate">
            {formatCurrency(rate)}
            {service.rateUnit ? <span className="service-card__unit"> / {service.rateUnit}</span> : null}
          </div>
        )}
        <div className="service-card__meta">
          {service.availability && (
            <Badge tone={service.availability === 'available' ? 'success' : 'neutral'}>
              {service.availability}
            </Badge>
          )}
          {service.rating !== undefined && <StarRating rating={service.rating} count={service.reviewCount} />}
        </div>
      </div>
    </Link>
  );
}
