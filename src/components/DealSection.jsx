import { Link } from 'react-router-dom';
import ProductCard from './ProductCard';
import Spinner from './Spinner';
import { EmptyState } from './PageState';

/**
 * One themed marketplace row — "🔥 Best Deals", "⚡ Flash Deals", and friends.
 *
 * Sections that have nothing to show render nothing at all (unless
 * `showEmpty`), so a young marketplace does not greet visitors with a column
 * of empty headings.
 */
export default function DealSection({
  icon,
  title,
  subtitle,
  products = [],
  loading = false,
  to = '/deals',
  linkLabel = 'See all →',
  showEmpty = false,
  emptyMessage = 'Nothing here just yet — check back soon.',
}) {
  if (!loading && !products.length && !showEmpty) return null;

  return (
    <section className="section">
      <div className="deal-section__header">
        <div>
          <h2 className="deal-section__title">
            <span className="deal-section__title-icon" aria-hidden="true">{icon}</span>
            {title}
          </h2>
          {subtitle && <p className="deal-section__sub">{subtitle}</p>}
        </div>
        {to && <Link to={to} className="section__link">{linkLabel}</Link>}
      </div>

      {loading && <Spinner size="sm" />}

      {!loading && products.length > 0 && (
        <div className="grid grid--products">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {!loading && !products.length && showEmpty && (
        <EmptyState title={title} message={emptyMessage} />
      )}
    </section>
  );
}
