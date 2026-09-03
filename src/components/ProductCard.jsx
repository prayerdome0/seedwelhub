import { Link } from 'react-router-dom';
import Image from './Image';
import StarRating from './StarRating';
import Badge from './Badge';
import { formatCurrency } from '../utils/format';

export default function ProductCard({ product, showBusiness = true }) {
  if (!product) return null;
  const image = product.image || product.images?.[0];
  const businessName = product.businessName || product.sellerName || product.business?.name;

  return (
    <Link to={`/product/${product.id}`} className="card product-card">
      <div className="product-card__media">
        {image ? (
          <Image src={image} alt={product.name} className="product-card__img" />
        ) : (
          <div className="product-card__img product-card__img--empty">No image</div>
        )}
      </div>
      <div className="product-card__body">
        <h3 className="product-card__title">{product.name || 'Unnamed product'}</h3>
        {product.category && <Badge tone="info" className="product-card__badge">{product.category}</Badge>}
        <div className="product-card__price">{formatCurrency(product.price, product.currency)}</div>
        {showBusiness && businessName && (
          <div className="product-card__seller">{businessName}</div>
        )}
        {product.location && <div className="product-card__location">📍 {product.location}</div>}
        <div className="product-card__meta">
          {product.rating !== undefined && <StarRating rating={product.rating} count={product.reviewCount} />}
          {product.availability && (
            <Badge tone={product.availability === 'available' ? 'success' : 'neutral'}>
              {product.availability}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
