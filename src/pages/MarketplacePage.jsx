import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import LocationBar from '../components/LocationBar';
import { EmptyState, ErrorState } from '../components/PageState';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useMarketLocation } from '../contexts/LocationContext';
import { marketplaceProducts } from '../services/productService';
import { BUSINESS_CATEGORIES } from '../utils/constants';
import { PROXIMITY_OPTIONS, proximityOption, rankGroups } from '../utils/location';

export default function MarketplacePage() {
  const { user, isSeller, businessesLoading } = useAuth();
  const { showToast } = useToast();
  const { place, label } = useMarketLocation();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursor, setCursor] = useState(null);
  const [done, setDone] = useState(false);
  const [category, setCategory] = useState('');
  // "Distance" filter. Translated into the coarse proximity tiers the data can
  // support (see utils/location.js) — never a fake precise km figure.
  const [band, setBand] = useState('any');
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

  // Distance-aware grouping. When the user has a location we split the loaded
  // listings into ordered proximity bands ("Near you" → "Other locations") and
  // narrow the set to the chosen radius. Without a location there is nothing to
  // rank against, so listings render as one flat grid (nearest-first has no
  // meaning yet) and we gently prompt the user to set one.
  const proximity = useMemo(
    () => (place ? rankGroups(items, place, band) : null),
    [items, place, band]
  );
  const showGroups = Boolean(place && proximity && proximity.groups.length);
  const hasNearby = proximity
    ? proximity.groups.some((g) => g.tier <= 1)
    : false;
  const activeOption = proximity ? proximity.option : proximityOption(band);

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
        <h1 className="page__title">Marketplace</h1>
        <p className="page__subtitle">Discover products from businesses across Seedwel Hub.</p>
      </div>

      {/* Every account can both buy and sell — surface Start Selling clearly for
          signed-in buyers who are not sellers yet. */}
      {user && !isSeller && !businessesLoading && (
        <div className="sell-cta" role="region" aria-label="Start selling">
          <div className="sell-cta__icon" aria-hidden="true">🚀</div>
          <div className="sell-cta__body">
            <strong>You can sell here too.</strong>
            <span>Your Seedwel account works for buying and selling — set up a store in a few minutes.</span>
          </div>
          <Link to="/sell" className="btn btn--primary btn--sm sell-cta__action">Start Selling</Link>
        </div>
      )}

      {/* Location-aware marketplace controls */}
      <LocationBar noun="products" />

      {/* Distance filter */}
      <div className="mkt-controls">
        <label className="mkt-controls__label" htmlFor="proximity-select">
          <span className="mkt-controls__label-text">Distance</span>
          <select
            id="proximity-select"
            className="form__select form__select--sm mkt-controls__select"
            value={band}
            onChange={(event) => setBand(event.target.value)}
          >
            {PROXIMITY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
        </label>
        {place && (
          <span className="mkt-controls__hint">
            {activeOption.id === 'any'
              ? `Nearest first — showing listings from all locations near ${label} and beyond.`
              : `${activeOption.helper}.`}
          </span>
        )}
        {!place && (
          <span className="mkt-controls__hint">
            {band === 'any'
              ? 'Set your location below to surface nearby listings first.'
              : 'Choose a location below so the distance filter can show matching listings.'}
          </span>
        )}
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
          {/* No items remain after the distance filter is applied. */}
          {place && proximity && proximity.groups.length === 0 && band !== 'any' && (
            <EmptyState
              title={`No products ${activeOption.label.toLowerCase()}`}
              message={`Nothing within this distance of ${label}. Try a wider radius or “Anywhere (nearest first)”.`}
            />
          )}

          {showGroups && (
            <>
              {proximity.hidden > 0 && (
                <p className="loc-results-note">
                  Showing {proximity.groups.reduce((sum, g) => sum + g.items.length, 0)} of {items.length}
                  {' '}products within “{activeOption.label}” — {proximity.hidden} from further away are hidden by the filter.
                </p>
              )}
              {!hasNearby && (
                <p className="loc-results-note">
                  No products found near <strong>{label}</strong> yet — listings below are from other locations.
                </p>
              )}
              {proximity.groups.map((group) => (
                <div key={group.tier}>
                  <p className="loc-group-title">
                    {group.label} <span className="count">({group.items.length})</span>
                  </p>
                  {renderGrid(group.items)}
                </div>
              ))}
            </>
          )}

          {/* No location set yet (or nothing ranked): flat list + gentle prompt. */}
          {!showGroups && (
            <>
              {!place && band !== 'any' && (
                <p className="loc-results-note">
                  Showing all products for now — set your location to filter by distance.
                </p>
              )}
              {renderGrid(items)}
            </>
          )}

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
          <Link to="/register">Create a free account</Link>, then <Link to="/sell">Start Selling</Link> — one
          account for buying and selling.
        </p>
      )}
    </div>
  );
}
