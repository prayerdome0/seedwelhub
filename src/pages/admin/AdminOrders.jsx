import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getTotalOrders } from '../../services/adminService';
import { formatCurrency, relativeTime } from '../../utils/format';

export default function AdminOrders() {
  const { data, loading, error, retry } = useAsync(() => getTotalOrders(), []);

  if (loading) return <Spinner size="large" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.length === 0) return <EmptyState title="No orders yet" />;

  return (
    <div className="panel">
      <h2 className="panel__title">Orders ({data.length})</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Order</th><th>Business</th><th>Buyer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {data.map((o) => (
              <tr key={o.id}>
                <td>{o.orderNumber}</td>
                <td>{o.businessName || '—'}</td>
                <td>{o.buyerName || '—'}</td>
                <td>{formatCurrency(o.total)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td>{relativeTime(o.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
