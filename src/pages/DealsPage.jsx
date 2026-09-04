import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import PromoCountdown from '../components/PromoCountdown';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getLatestProducts } from '../services/productService';
import {
  getActivePromotions,
  decorateProductsWithPromotions,
} from '../services/promotionService';
import { DISCOUNT_TIERS } from '../utils/promotions';

const DAY_MS = 24 * 60 * 60 * 1000;

const FILTERS = [
  { id: 'all', label: '🔥 All deals' },
  { id: 'flash', label: '⚡ Ending soon' },
  ...DISCOUNT_TIERS.slice(0, 5).map((tier) => ({ id: `pct-${tier}`, label: `${tier}%+ off` })),
];

/**
 * The full deals catalogue — everything currently on promotion, filterable by
 * discount depth and urgency.
 */
export default function DealsPage() {
  const products = useAsync(
    () => getLatestProducts(100).then(decorateProductsWithPromotions),
    []
  );
  const promotions = useAsync(() => getActivePromotions(50), []);
  const [filter, setFilter] = useState('all');

  const deals = useMemo(() => {
    const discounted = (products.data || []).filter((p) => p.promotion);
    if (filter === 'flash') {
      return discounted
        .filter((p) => p.promotion.endsInMs > 0 && p.promotion.endsInMs <= DAY_MS)
        .sort((a, b) => a.promotion.endsInMs - b.promotion.endsInMs);
    }
    if (filter.startsWith('pct-')) {
      const min = Number(filter.slice(4));
      return discounted
        .filter((p) => (p.discountPercent || 0) >= min)
        .sort((a, b) => b.discountPercent - a.discountPercent);
    }
    return [...discounted].sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
  }, [products.data, filter]);

  const campaigns = promotions.data || [];

  return (
    <div className="container page">
      <div className="section__header">
        <div>
          <h1 className="section__title">🔥 Deals on Seedwel Hub</h1>
          <p className="text-muted">
            Every live promotion from our sellers. Prices return to normal when the timer ends.
          </p>
        </div>
        <Link to="/marketplace" className="section__link">Browse marketplace →</Link>
      </div>

      <div className="chip-row mt-16">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`chip ${filter === f.id ? 'active' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {campaigns.length > 0 && (
        <section className="section">
          <h2 className="deal-section__title">
            <span className="deal-section__title-icon" aria-hidden="true">📢</span>
            Seller promotions
          </h2>
          <div className="grid grid--cards mt-16">
            {campaigns.map((promo) => (
              <div key={promo.id} className="promo-card">
                {promo.image && (
                  <div className="promo-card__media">
                    <img src={promo.image} alt="" loading="lazy" decoding="async" />
                    <span className="promo-card__flag">−{promo.discountPercent}%</span>
                  </div>
                )}
                <div className="promo-card__body">
                  <h3 className="promo-card__title">{promo.title}</h3>
                  {promo.businessName && (
                    <div className="promo-card__seller">{promo.businessName}</div>
                  )}
                  {promo.description && <p className="promo-card__desc">{promo.description}</p>}
                  <PromoCountdown endsAt={promo.endAt} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <h2 className="deal-section__title">
          <span className="deal-section__title-icon" aria-hidden="true">🏷️</span>
          Discounted products
        </h2>

        {products.loading && <Spinner size="sm" />}
        {products.error && <ErrorState message={products.error} onRetry={products.retry} />}
        {!products.loading && !products.error && deals.length === 0 && (
          <EmptyState
            title="No deals right now"
            message="There are no active promotions matching this filter. Check back soon — sellers add deals all the time."
          />
        )}
        {!products.loading && deals.length > 0 && (
          <div className="grid grid--products mt-16">
            {deals.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
