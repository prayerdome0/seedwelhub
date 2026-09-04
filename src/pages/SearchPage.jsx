import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import Spinner from '../components/Spinner';
import ProductCard from '../components/ProductCard';
import BusinessCard from '../components/BusinessCard';
import ServiceCard from '../components/ServiceCard';
import LocationBar from '../components/LocationBar';
import { EmptyState, ErrorState } from '../components/PageState';
import useDebounce from '../hooks/useDebounce';
import { searchProducts } from '../services/productService';
import { searchServices } from '../services/serviceService';
import { searchBusinesses } from '../services/businessService';
import { useMarketLocation } from '../contexts/LocationContext';
import { BUSINESS_CATEGORIES } from '../utils/constants';
import { friendlyError } from '../utils/firebaseErrors';
import { rankByLocation } from '../utils/location';

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'products', label: 'Products' },
  { id: 'services', label: 'Services' },
  { id: 'businesses', label: 'Businesses' },
];

/**
 * Renders one result kind (products/services/businesses). When a location is
 * set, results nearest to the user render first under "Near {label}" and the
 * rest follow under "Other locations" — search relevance is preserved inside
 * each group (stable ordering), nothing is hidden.
 */
function RankedResults({ ranked, items, gridClass, label, place, renderCard }) {
  const showNearSplit = Boolean(place && ranked && ranked.near.length > 0);
  if (!showNearSplit) {
    const ordered = place && ranked ? ranked.items : items;
    return <div className={gridClass}>{ordered.map((item) => renderCard(item))}</div>;
  }
  return (
    <>
      <div className={gridClass}>{ranked.near.map((item) => renderCard(item))}</div>
      {ranked.rest.length > 0 && (
        <>
          <p className="loc-group-title">
            Other locations <span className="count">({ranked.rest.length})</span>
          </p>
          <div className={gridClass}>{ranked.rest.map((item) => renderCard(item))}</div>
        </>
      )}
    </>
  );
}

export default function SearchPage() {
  const [params] = useSearchParams();
  const initialQuery = params.get('q') || '';
  const initialType = params.get('type') || 'all';
  const initialCategory = params.get('category') || '';

  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 400);
  const [type, setType] = useState(initialType);
  const [category, setCategory] = useState(initialCategory);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState({ products: [], services: [], businesses: [] });
  const { place, label } = useMarketLocation();

  const activeFilters = useMemo(
    () => Boolean(debouncedQuery || category),
    [debouncedQuery, category]
  );

  const runSearch = async (q, categoryFilter) => {
    if (!q && !categoryFilter) {
      setResults({ products: [], services: [], businesses: [] });
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [products, services, businesses] = await Promise.all([
        searchProducts(q).then((items) =>
          categoryFilter ? items.filter((i) => i.category === categoryFilter) : items
        ),
        searchServices(q).then((items) =>
          categoryFilter ? items.filter((i) => i.category === categoryFilter) : items
        ),
        searchBusinesses(q).then((items) =>
          categoryFilter ? items.filter((i) => i.category === categoryFilter) : items
        ),
      ]);
      setResults({ products, services, businesses });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runSearch(debouncedQuery.trim(), category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery, category]);

  useEffect(() => {
    if (initialType) setType(initialType);
  }, [initialType]);

  // Location-aware ranking per result kind (applies to whatever the current
  // search + category filters returned — filters are never bypassed).
  const rankedProducts = useMemo(
    () => (place ? rankByLocation(results.products, place) : null),
    [results.products, place]
  );
  const rankedServices = useMemo(
    () => (place ? rankByLocation(results.services, place) : null),
    [results.services, place]
  );
  const rankedBusinesses = useMemo(
    () => (place ? rankByLocation(results.businesses, place) : null),
    [results.businesses, place]
  );
  const total =
    results.products.length + results.services.length + results.businesses.length;

  // Near-miss counter for whichever kind(s) the active tab actually shows, so
  // the "nothing near you" note only appears for visible sections.
  const nearTotal =
    ((type === 'all' || type === 'products') && results.products.length > 0
      ? rankedProducts?.near.length || 0
      : 0) +
    ((type === 'all' || type === 'services') && results.services.length > 0
      ? rankedServices?.near.length || 0
      : 0) +
    ((type === 'all' || type === 'businesses') && results.businesses.length > 0
      ? rankedBusinesses?.near.length || 0
      : 0);

  const visible = (type === 'all') ||
    (type === 'products' && results.products.length > 0) ||
    (type === 'services' && results.services.length > 0) ||
    (type === 'businesses' && results.businesses.length > 0);

  const showTypeTabs = total > 0 || query || category;

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Search Seedwel Hub</h1>
        <p className="page__subtitle">Find products, services and businesses.</p>
      </div>

      <div className="mb-24">
        <SearchBar variant="large" placeholder="Search products, services, businesses…" defaultValue={query} />
      </div>

      <LocationBar noun="results" />

      {/* Filters */}
      <div className="stack mb-24">
        <div className="chip-row">
          {TYPES.map((t) => (
            <button key={t.id} type="button" className={`chip ${type === t.id ? 'active' : ''}`} onClick={() => setType(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="chip-row">
          <button type="button" className={`chip ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>
            All categories
          </button>
          {BUSINESS_CATEGORIES.map((cat) => (
            <button key={cat} type="button" className={`chip ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* States */}
      {loading && <Spinner size="large" label="Searching…" />}

      {!loading && error && <ErrorState message={error} onRetry={() => runSearch(debouncedQuery.trim(), category)} />}

      {!loading && !error && !activeFilters && (
        <EmptyState title="Start searching" message="Type a query or pick a category to find results." />
      )}

      {!loading && !error && activeFilters && activeFilters && total === 0 && (
        <EmptyState
          title="No results found"
          message="We couldn't find anything matching your search. Try different keywords or filters."
        />
      )}

      {!loading && !error && total > 0 && (
        <>
          {showTypeTabs && (
            <p className="text-muted mb-16">
              {type === 'all'
                ? `${total} result${total === 1 ? '' : 's'}`
                : `${(type === 'products' ? results.products.length : type === 'services' ? results.services.length : results.businesses.length)} result(s)`}
            </p>
          )}

          {place && total > 0 && nearTotal === 0 && (
            <p className="loc-results-note">
              No results near <strong>{label}</strong> — showing results from other locations below.
            </p>
          )}

          {(type === 'all' || type === 'products') && results.products.length > 0 && (
            <section className="section">
              {type === 'all' && <h2 className="section__title">Products</h2>}
              <RankedResults
                ranked={rankedProducts}
                items={results.products}
                gridClass="grid grid--products"
                place={place}
                label={label}
                renderCard={(p) => <ProductCard key={p.id} product={p} />}
              />
            </section>
          )}

          {(type === 'all' || type === 'services') && results.services.length > 0 && (
            <section className="section">
              {type === 'all' && <h2 className="section__title">Services</h2>}
              <RankedResults
                ranked={rankedServices}
                items={results.services}
                gridClass="grid grid--services"
                place={place}
                label={label}
                renderCard={(s) => <ServiceCard key={s.id} service={s} />}
              />
            </section>
          )}

          {(type === 'all' || type === 'businesses') && results.businesses.length > 0 && (
            <section className="section">
              {type === 'all' && <h2 className="section__title">Businesses</h2>}
              <RankedResults
                ranked={rankedBusinesses}
                items={results.businesses}
                gridClass="grid grid--businesses"
                place={place}
                label={label}
                renderCard={(b) => <BusinessCard key={b.id} business={b} />}
              />
            </section>
          )}

          {!visible && (
            <EmptyState title="Nothing here yet" message="No results for this filter." />
          )}
        </>
      )}
    </div>
  );
}
