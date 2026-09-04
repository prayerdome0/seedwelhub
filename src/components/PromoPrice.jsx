import { formatCurrency } from '../utils/format';

/**
 * The "Was / Now / Save" price block.
 *
 * A single component so the promotional price is presented identically on
 * cards, the product detail page and the deals sections — and so the crossed
 * out "Was" figure can never appear without a real saving behind it.
 */
export default function PromoPrice({ product, size = 'md' }) {
  if (!product) return null;
  const currency = product.currency;
  const hasDeal = Number(product.oldPrice) > Number(product.price) && Number(product.savings) > 0;

  if (!hasDeal) {
    return <div className={`promo-price promo-price--${size}`}>
      <span className="promo-price__now">{formatCurrency(product.price, currency)}</span>
    </div>;
  }

  return (
    <div className={`promo-price promo-price--${size} is-deal`}>
      <div className="promo-price__row">
        <span className="promo-price__now">{formatCurrency(product.price, currency)}</span>
        <span className="promo-price__was">
          <span className="sr-only">Was </span>
          {formatCurrency(product.oldPrice, currency)}
        </span>
      </div>
      <div className="promo-price__save">
        Save {formatCurrency(product.savings, currency)}
        <span className="promo-price__pct">−{product.discountPercent}%</span>
      </div>
    </div>
  );
}
