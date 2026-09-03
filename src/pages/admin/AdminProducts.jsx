import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getTotalProducts } from '../../services/adminService';
import { formatCurrency, relativeTime } from '../../utils/format';

export default function AdminProducts() {
  const { data, loading, error, retry } = useAsync(() => getTotalProducts(), []);

  if (loading) return <Spinner size="large" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.length === 0) return <EmptyState title="No products yet" />;

  return (
    <div className="panel">
      <h2 className="panel__title">Products ({data.length})</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th>Business</th><th>Price</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td>{p.businessName || '—'}</td>
                <td>{formatCurrency(p.price)}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{relativeTime(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
