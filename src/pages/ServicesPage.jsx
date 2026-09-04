import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ServiceCard from '../components/ServiceCard';
import Spinner from '../components/Spinner';
import LocationBar from '../components/LocationBar';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getLatestServices } from '../services/serviceService';
import { useMarketLocation } from '../contexts/LocationContext';
import SearchBar from '../components/SearchBar';
import { BUSINESS_CATEGORIES } from '../utils/constants';
import { rankByLocation } from '../utils/location';

export default function ServicesPage() {
  const { data, loading, error, retry } = useAsync(() => getLatestServices(48), []);
  const services = data || [];
  const { place, label } = useMarketLocation();

  // Location-aware ranking: providers nearest to the user first, others
  // afterwards — nothing is ever hidden.
  const ranked = useMemo(() => (place ? rankByLocation(services, place) : null), [services, place]);
  const nearCount = ranked ? ranked.near.length : 0;

  const renderGrid = (list) => (
    <div className="grid grid--services">
      {list.map((s) => (
        <ServiceCard key={s.id} service={s} />
      ))}
    </div>
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Services</h1>
        <p className="page__subtitle">Find professional services from providers on Seedwel Hub.</p>
      </div>

      <div className="mb-24">
        <SearchBar variant="regular" placeholder="Search services…" />
      </div>

      <LocationBar noun="services" />

      <div className="chip-row mb-24">
        {BUSINESS_CATEGORIES.slice(0, 8).map((cat) => (
          <Link key={cat} to={`/search?category=${encodeURIComponent(cat)}&type=services`} className="chip">
            {cat}
          </Link>
        ))}
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && services.length === 0 && (
        <EmptyState title="Nothing here yet" message="No services available yet." />
      )}
      {!loading && !error && services.length > 0 && (
        <>
          {place && nearCount === 0 && (
            <p className="loc-results-note">
              No services found near <strong>{label}</strong> yet — showing services from other
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
            renderGrid(services)
          )}
        </>
      )}
    </div>
  );
}
