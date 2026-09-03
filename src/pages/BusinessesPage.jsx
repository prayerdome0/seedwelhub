import { Link } from 'react-router-dom';
import BusinessCard from '../components/BusinessCard';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getAllBusinesses } from '../services/businessService';
import SearchBar from '../components/SearchBar';
import { BUSINESS_CATEGORIES } from '../utils/constants';

export default function BusinessesPage() {
  const { data, loading, error, retry } = useAsync(() => getAllBusinesses(60), []);
  const businesses = data || [];

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Businesses</h1>
        <p className="page__subtitle">Explore trusted businesses on Xacheus.</p>
      </div>

      <div className="mb-24">
        <SearchBar variant="regular" placeholder="Search businesses…" />
      </div>

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
        <div className="grid grid--businesses">
          {businesses.map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </div>
      )}
    </div>
  );
}
