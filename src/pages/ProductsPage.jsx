import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getLatestProducts } from '../services/productService';
import SearchBar from '../components/SearchBar';

export default function ProductsPage() {
  const { data, loading, error, retry } = useAsync(() => getLatestProducts(48), []);

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Products</h1>
        <p className="page__subtitle">Browse all products available on Seedwel Hub.</p>
      </div>

      <div className="mb-24">
        <SearchBar variant="regular" placeholder="Search products…" />
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && (!data || data.length === 0) && (
        <EmptyState title="Nothing here yet" message="No products available yet." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="grid grid--products">
          {data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <p className="text-center text-muted mt-24">
        Looking for something specific? <Link to="/search">Try Search</Link>
      </p>
    </div>
  );
}
