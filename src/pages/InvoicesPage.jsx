import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getInvoicesByBusiness } from '../services/invoiceService';
import { formatCurrency, formatDate } from '../utils/format';

export default function InvoicesPage() {
  const { user, profile } = useAuth();
  const { data, loading, error, retry } = useAsync(
    () => (user ? getInvoicesByBusiness(profile?.businessId || profile?.uid || user.uid) : Promise.resolve([])),
    [user, profile]
  );

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Invoices</h1>
        <p className="page__subtitle">Manage invoices for your business.</p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && (!data || data.length === 0) && (
        <EmptyState title="Nothing here yet" message="No invoices found." />
      )}
      {!loading && !error && data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Number</th><th>Customer</th><th>Total</th><th>Balance</th><th>Status</th><th>Date</th></tr>
            </thead>
            <tbody>
              {data.map((inv) => (
                <tr key={inv.id}>
                  <td><Link to={`/invoice/${inv.id}`} className="table__link">{inv.invoiceNumber}</Link></td>
                  <td>{inv.customerName || '—'}</td>
                  <td>{formatCurrency(inv.total)}</td>
                  <td>{formatCurrency(inv.balance)}</td>
                  <td><StatusBadge status={inv.status} /></td>
                  <td>{formatDate(inv.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
