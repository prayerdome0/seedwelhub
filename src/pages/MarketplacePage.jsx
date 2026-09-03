import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { marketplaceProducts } from '../services/productService';
import { BUSINESS_CATEGORIES } from '../utils/constants';

export default function MarketplacePage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [category, setCategory] = useState('');
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);

  const loadFirst = async (cat = category) => {
    setLoading(true);
    setError('');
    try {
      const res = await marketplaceProducts({ category: cat || undefined, pageSize: 12 });
      setItems(res.docs || []);
      setCursor(res.nextCursor);
      setDone(Boolean(res.done));
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };
  // Load on mount.
  useEffect(() => {
    loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCategory = (cat) => {
    const next = cat === category ? '' : cat;
    setCategory(next);
    loadFirst(next);
  };

  const handleLoadMore = async () => {
    if (loadMoreLoading || done) return;
    setLoadMoreLoading(true);
    try {
      const res = await marketplaceProducts({ category: category || undefined, cursor, pageSize: 12 });
      setItems((prev) => [...prev, ...(res.docs || [])]);
      setCursor(res.nextCursor);
      setDone(Boolean(res.done));
    } catch (err) {
      showToast(err.message || 'Could not load more products.', 'error');
    } finally {
      setLoadMoreLoading(false);
    }
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Marketplace</h1>
        <p className="page__subtitle">Discover products from businesses across Seedwel Hub.</p>
      </div>

      {/* Category filter */}
      <div className="chip-row mb-24">
        <button type="button" className={`chip ${!category ? 'active' : ''}`} onClick={() => handleCategory('')}>
          All
        </button>
        {BUSINESS_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`chip ${category === cat ? 'active' : ''}`}
            onClick={() => handleCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading && <Spinner size="large" />}

      {!loading && error && <ErrorState message={error} onRetry={() => loadFirst()} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          message="No products match this filter. Check back soon or browse a different category."
        />
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="grid grid--products">
            {items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {!done && (
            <div className="text-center mt-32">
              <button type="button" className="btn btn--secondary" onClick={handleLoadMore} disabled={loadMoreLoading}>
                {loadMoreLoading ? 'Loading…' : 'Load More'}
              </button>
            </div>
          )}
          {done && items.length > 12 && (
            <p className="text-center text-muted mt-24">You've reached the end of the marketplace.</p>
          )}
        </>
      )}

      {!user && !loading && (
        <p className="text-center text-muted mt-32">
          <Link to="/login">Log in</Link> to place orders.{" "}
          <Link to="/register">Create an account</Link> to start selling.
        </p>
      )}
    </div>
  );
}
