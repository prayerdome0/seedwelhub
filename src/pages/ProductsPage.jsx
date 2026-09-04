import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import LocationBar from '../components/LocationBar';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getLatestProducts } from '../services/productService';
import { useMarketLocation } from '../contexts/LocationContext';
import SearchBar from '../components/SearchBar';
import { rankByLocation } from '../utils/location';

export default function ProductsPage() {
  const { data, loading, error, retry } = useAsync(() => getLatestProducts(48), []);
  const products = data || [];
  const { place, label } = useMarketLocation();

  // Location-aware ranking: products nearest to the user first; products from
  // other locations stay visible below. Ordering is stable within each tier.
  const ranked = useMemo(() => (place ? rankByLocation(products, place) : null), [products, place]);
  const nearCount = ranked ? ranked.near.length : 0;

  const renderGrid = (list) => (
    <div className="grid grid--products">
      {list.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Products</h1>
        <p className="page__subtitle">Browse all products available on Seedwel Hub.</p>
      </div>

      <div className="mb-24">
        <SearchBar variant="regular" placeholder="Search products…" />
      </div>

      <LocationBar noun="products" />

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && products.length === 0 && (
        <EmptyState title="Nothing here yet" message="No products available yet." />
      )}
      {!loading && !error && products.length > 0 && (
        <>
          {place && nearCount === 0 && (
            <p className="loc-results-note">
              No products found near <strong>{label}</strong> yet — showing products from other
              locations below.
            </p>
          )}

          {ranked && ranked.near.length > 0 ? (
            <>
              {renderGrid(ranked.near)}
              {ranked.rest.length > 0 && (
                <>
                  <p className="loc-group-title">
                    Other locations <span className="count">({ranked.rest.length})</span>
                  </p>
                  {renderGrid(ranked.rest)}
                </>
              )}
            </>
          ) : (
            renderGrid(products)
          )}
        </>
      )}

      <p className="text-center text-muted mt-24">
        Looking for something specific? <Link to="/search">Try Search</Link>
      </p>
    </div>
  );
}
