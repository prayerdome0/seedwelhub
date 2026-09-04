import { Link } from 'react-router-dom';
import Image from './Image';
import StarRating from './StarRating';
import Badge from './Badge';
import PromoPrice from './PromoPrice';
import PromoCountdown from './PromoCountdown';

/**
 * Compact marketplace product card.
 *
 * Deliberately tight: smaller title/price/meta type and a shorter image frame
 * so noticeably more products fit on one screen. The image sits in a fixed
 * 4:3 frame with `object-fit: contain` (see `.product-card__media`), which
 * keeps the whole photo inside all four corners — nothing is cropped or
 * allowed to overflow the rounded card.
 */
export default function ProductCard({ product, showBusiness = true }) {
  if (!product) return null;
  const image = product.image || product.images?.[0];
  const businessName = product.businessName || product.sellerName || product.business?.name;
  const onDeal = Number(product.oldPrice) > Number(product.price) && Number(product.savings) > 0;

  return (
    <Link to={`/product/${product.id}`} className="card product-card">
      <div className="product-card__media">
        {image ? (
          <Image src={image} alt={product.name} className="product-card__img" />
        ) : (
          <div className="product-card__img product-card__img--empty">No image</div>
        )}
        {onDeal && (
          <span className="product-card__deal-flag">−{product.discountPercent}%</span>
        )}
      </div>
      <div className="product-card__body">
        <h3 className="product-card__title">{product.name || 'Unnamed product'}</h3>
        <PromoPrice product={product} size="sm" />
        {showBusiness && businessName && (
          <div className="product-card__seller">{businessName}</div>
        )}
        {product.location && <div className="product-card__location">📍 {product.location}</div>}
        {product.promotion?.endAt && (
          <PromoCountdown endsAt={product.promotion.endAt} className="promo-countdown--card" />
        )}
        <div className="product-card__meta">
          {product.rating !== undefined && (
            <StarRating rating={product.rating} count={product.reviewCount} />
          )}
          {product.category && (
            <Badge tone="info" className="product-card__badge">{product.category}</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
