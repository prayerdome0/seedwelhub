import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getReceiptsByBusiness } from '../services/receiptService';
import { formatCurrency, formatDate } from '../utils/format';

export default function ReceiptsPage() {
  const { user, profile } = useAuth();
  const { data, loading, error, retry } = useAsync(
    () => (user ? getReceiptsByBusiness(profile?.businessId || profile?.uid || user.uid) : Promise.resolve([])),
    [user, profile]
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Receipts</h1>
        <p className="page__subtitle">Manage receipts for your business.</p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && (!data || data.length === 0) && (
        <EmptyState title="Nothing here yet" message="No receipts found." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Number</th><th>Customer</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/receipt/${r.id}`} className="table__link">{r.receiptNumber}</Link></td>
                  <td>{r.customerName || '—'}</td>
                  <td>{formatCurrency(r.amount)}</td>
                  <td>{r.paymentMethod || '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td>{formatDate(r.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
