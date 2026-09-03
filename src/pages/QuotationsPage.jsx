import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getQuotationsByCustomer, getQuotationsByOwner } from '../services/quotationService';
import { formatCurrency, formatDate, sortByTimestamp } from '../utils/format';
import { QUOTATION_STATUS_LABELS } from '../utils/constants';

// Quotations the user is party to: requests they sent as a buyer, and requests
// addressed to them as a seller.
export default function QuotationsPage() {
  const { user, isSeller } = useAuth();

  const asBuyer = useAsync(
    () => (user ? getQuotationsByCustomer(user.uid) : Promise.resolve([])),
    [user]
  );
  const asSeller = useAsync(
    () => (user && isSeller ? getQuotationsByOwner(user.uid) : Promise.resolve([])),
    [user, isSeller]
  );

  const loading = asBuyer.loading || asSeller.loading;
  const error = asBuyer.error || asSeller.error;

  const quotations = sortByTimestamp(
    [...(asBuyer.data || []), ...(asSeller.data || [])].filter(
      (q, index, all) => all.findIndex((item) => item.id === q.id) === index
    ),
    'createdAt',
    'desc'
  );

  const retry = () => {
    asBuyer.retry();
    asSeller.retry();
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Quotations</h1>
        <p className="page__subtitle">Quotation requests you've sent and received.</p>
        <div className="mt-8">
          <Link to="/marketplace" className="btn btn--primary btn--sm">
            Request a quotation
          </Link>
        </div>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && quotations.length === 0 && (
        <EmptyState
          title="No quotations yet"
          message="Request a quotation from any product, service or business page."
          action={<Link to="/marketplace" className="btn btn--primary">Browse Marketplace</Link>}
        />
      )}

      {!loading && !error && quotations.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Business</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {quotations.map((quotation) => (
                <tr key={quotation.id}>
                  <td>
                    <Link to={`/quotation/${quotation.id}`} className="table__link">
                      {quotation.quotationNumber}
                    </Link>
                  </td>
                  <td>{quotation.businessName || '—'}</td>
                  <td>{quotation.customerName || '—'}</td>
                  <td>
                    {quotation.total
                      ? formatCurrency(quotation.total, quotation.currency)
                      : '—'}
                  </td>
                  <td>
                    <StatusBadge
                      status={quotation.status}
                      label={QUOTATION_STATUS_LABELS[quotation.status] || quotation.status}
                    />
                  </td>
                  <td>{formatDate(quotation.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
