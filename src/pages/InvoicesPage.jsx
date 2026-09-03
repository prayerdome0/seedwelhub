import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getInvoicesByCustomer, getInvoicesByOwner } from '../services/invoiceService';
import { normalizeInvoiceStatus } from '../documents/model';
import { formatCurrency, formatDate, sortByTimestamp } from '../utils/format';
import { INVOICE_STATUS_LABELS } from '../utils/constants';

// Invoices addressed to the user as a customer, plus invoices their business
// has issued.
export default function InvoicesPage() {
  const { user, isSeller } = useAuth();

  const asCustomer = useAsync(
    () => (user ? getInvoicesByCustomer(user.uid) : Promise.resolve([])),
    [user]
  );
  const asSeller = useAsync(
    () => (user && isSeller ? getInvoicesByOwner(user.uid) : Promise.resolve([])),
    [user, isSeller]
  );

  const loading = asCustomer.loading || asSeller.loading;
  const error = asCustomer.error || asSeller.error;

  const invoices = sortByTimestamp(
    [...(asCustomer.data || []), ...(asSeller.data || [])].filter(
      (invoice, index, all) => all.findIndex((i) => i.id === invoice.id) === index
    ),
    'createdAt',
    'desc'
  );

  const retry = () => {
    asCustomer.retry();
    asSeller.retry();
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Invoices</h1>
        <p className="page__subtitle">Invoices you've received and issued.</p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && invoices.length === 0 && (
        <EmptyState
          title="No invoices yet"
          message="Invoices sent to you by sellers will appear here."
          action={<Link to="/orders" className="btn btn--primary">View my orders</Link>}
        />
      )}

      {!loading && !error && invoices.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Business</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Status</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => {
                const status = normalizeInvoiceStatus(invoice.status);
                return (
                  <tr key={invoice.id}>
                    <td>
                      <Link to={`/invoice/${invoice.id}`} className="table__link">
                        {invoice.invoiceNumber}
                      </Link>
                    </td>
                    <td>{invoice.businessName || '—'}</td>
                    <td>{invoice.customerName || '—'}</td>
                    <td>{formatCurrency(invoice.total, invoice.currency)}</td>
                    <td>{formatCurrency(invoice.balance, invoice.currency)}</td>
                    <td>
                      <StatusBadge status={status} label={INVOICE_STATUS_LABELS[status]} />
                    </td>
                    <td>{invoice.dueDate ? formatDate(invoice.dueDate) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
