import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getQuotationsByBusiness } from '../services/quotationService';
import { formatCurrency, formatDate } from '../utils/format';

export default function QuotationsPage() {
  const { user, profile } = useAuth();
  const { data, loading, error, retry } = useAsync(
    () => (user ? getQuotationsByBusiness(profile?.businessId || profile?.uid || user.uid) : Promise.resolve([])),
    [user, profile]
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Quotations</h1>
        <p className="page__subtitle">Manage quotations for your business.</p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && (!data || data.length === 0) && (
        <EmptyState title="Nothing here yet" message="No quotations found." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Number</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id}>
                  <td><Link to={`/quotation/${q.id}`} className="table__link">{q.quotationNumber}</Link></td>
                  <td>{q.customerName || '—'}</td>
                  <td>{formatCurrency(q.total)}</td>
                  <td><StatusBadge status={q.status} /></td>
                  <td>{formatDate(q.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
