import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import BusinessCard from '../components/BusinessCard';
import Spinner from '../components/Spinner';
import LocationBar from '../components/LocationBar';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getAllBusinesses } from '../services/businessService';
import { useMarketLocation } from '../contexts/LocationContext';
import SearchBar from '../components/SearchBar';
import { BUSINESS_CATEGORIES } from '../utils/constants';
import { rankByLocation } from '../utils/location';

export default function BusinessesPage() {
  const { data, loading, error, retry } = useAsync(() => getAllBusinesses(60), []);
  const businesses = data || [];
  const { place, label } = useMarketLocation();

  // Location-aware ranking: businesses nearest to the user first, others
  // afterwards — nothing is ever hidden.
  const ranked = useMemo(
    () => (place ? rankByLocation(businesses, place) : null),
    [businesses, place]
  );
  const nearCount = ranked ? ranked.near.length : 0;

  const renderGrid = (list) => (
    <div className="grid grid--businesses">
      {list.map((b) => (
        <BusinessCard key={b.id} business={b} />
      ))}
    </div>
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Businesses</h1>
        <p className="page__subtitle">Explore trusted businesses on Seedwel Hub.</p>
      </div>

      <div className="mb-24">
        <SearchBar variant="regular" placeholder="Search businesses…" />
      </div>

      <LocationBar noun="businesses" />

      <div className="chip-row mb-24">
        <Link to="/businesses" className="chip active">All</Link>
        {BUSINESS_CATEGORIES.map((cat) => (
          <Link key={cat} to={`/search?category=${encodeURIComponent(cat)}&type=businesses`} className="chip">
            {cat}
          </Link>
        ))}
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && businesses.length === 0 && (
        <EmptyState title="Nothing here yet" message="No businesses available yet." />
      )}
      {!loading && !error && businesses.length > 0 && (
        <>
          {place && nearCount === 0 && (
            <p className="loc-results-note">
              No businesses found near <strong>{label}</strong> yet — showing businesses from other
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
            renderGrid(businesses)
          )}
        </>
      )}
    </div>
  );
}
