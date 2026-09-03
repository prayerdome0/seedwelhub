import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getOrdersByBuyer } from '../services/orderService';
import { formatCurrency, relativeTime } from '../utils/format';

export default function OrdersPage() {
  const { user } = useAuth();
  const { data, loading, error, retry } = useAsync(
    () => (user ? getOrdersByBuyer(user.uid) : Promise.resolve([])),
    [user]
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">My Orders</h1>
        <p className="page__subtitle">Track and manage your purchases.</p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && (!data || data.length === 0) && (
        <EmptyState
          title="Nothing here yet"
          message="You haven't placed any orders yet."
          action={<Link to="/marketplace" className="btn btn--primary">Browse Marketplace</Link>}
        />
      )}
      {!loading && !error && data && data.length > 0 && (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Business</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.map((o) => (
                  <tr key={o.id}>
                    <td><Link to={`/order/${o.id}`} className="table__link">{o.orderNumber}</Link></td>
                    <td>{o.businessName || '—'}</td>
                    <td>{formatCurrency(o.total, o.currency)}</td>
                    <td><StatusBadge status={o.paymentStatus} /></td>
                    <td><StatusBadge status={o.status} /></td>
                    <td>{relativeTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-muted mt-16">Showing {data.length} order(s).</p>
        </>
      )}
    </div>
  );
}
