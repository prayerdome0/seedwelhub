import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getPaymentsByBuyer } from '../services/paymentService';
import { formatCurrency, relativeTime } from '../utils/format';

export default function PaymentsPage() {
  const { user } = useAuth();
  const { data, loading, error, retry } = useAsync(
    () => (user ? getPaymentsByBuyer(user.uid) : Promise.resolve([])),
    [user]
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Payments</h1>
        <p className="page__subtitle">Review your submitted and recorded payments.</p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && (!data || data.length === 0) && (
        <EmptyState title="Nothing here yet" message="No payments recorded yet." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Reference</th><th>Business</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/payment/${p.id}`} className="table__link">{p.reference}</Link></td>
                  <td>{p.businessName || '—'}</td>
                  <td>{formatCurrency(p.amount)}</td>
                  <td>{p.method || '—'}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>{relativeTime(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
