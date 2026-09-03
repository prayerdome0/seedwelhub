import { Link } from 'react-router-dom';
import ServiceCard from '../components/ServiceCard';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getLatestServices } from '../services/serviceService';
import SearchBar from '../components/SearchBar';
import { BUSINESS_CATEGORIES } from '../utils/constants';

export default function ServicesPage() {
  const { data, loading, error, retry } = useAsync(() => getLatestServices(48), []);

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Services</h1>
        <p className="page__subtitle">Find professional services from providers on Seedwel Hub.</p>
      </div>

      <div className="mb-24">
        <SearchBar variant="regular" placeholder="Search services…" />
      </div>

      <div className="chip-row mb-24">
        {BUSINESS_CATEGORIES.slice(0, 8).map((cat) => (
          <Link key={cat} to={`/search?category=${encodeURIComponent(cat)}&type=services`} className="chip">
            {cat}
          </Link>
        ))}
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && (!data || data.length === 0) && (
        <EmptyState title="Nothing here yet" message="No services available yet." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="grid grid--services">
          {data.map((s) => (
            <ServiceCard key={s.id} service={s} />
          ))}
        </div>
      )}
    </div>
  );
}
