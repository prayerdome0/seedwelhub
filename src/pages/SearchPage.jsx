import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import Spinner from '../components/Spinner';
import ProductCard from '../components/ProductCard';
import BusinessCard from '../components/BusinessCard';
import ServiceCard from '../components/ServiceCard';
import { EmptyState, ErrorState } from '../components/PageState';
import useDebounce from '../hooks/useDebounce';
import { searchProducts } from '../services/productService';
import { searchServices } from '../services/serviceService';
import { searchBusinesses } from '../services/businessService';
import { BUSINESS_CATEGORIES } from '../utils/constants';
import { friendlyError } from '../utils/firebaseErrors';

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'products', label: 'Products' },
  { id: 'services', label: 'Services' },
  { id: 'businesses', label: 'Businesses' },
];

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

  const total =
    results.products.length + results.services.length + results.businesses.length;

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

          {(type === 'all' || type === 'products') && results.products.length > 0 && (
            <section className="section">
              {type === 'all' && <h2 className="section__title">Products</h2>}
              <div className="grid grid--products">
                {results.products.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            </section>
          )}

          {(type === 'all' || type === 'services') && results.services.length > 0 && (
            <section className="section">
              {type === 'all' && <h2 className="section__title">Services</h2>}
              <div className="grid grid--services">
                {results.services.map((s) => <ServiceCard key={s.id} service={s} />)}
              </div>
            </section>
          )}

          {(type === 'all' || type === 'businesses') && results.businesses.length > 0 && (
            <section className="section">
              {type === 'all' && <h2 className="section__title">Businesses</h2>}
              <div className="grid grid--businesses">
                {results.businesses.map((b) => <BusinessCard key={b.id} business={b} />)}
              </div>
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
