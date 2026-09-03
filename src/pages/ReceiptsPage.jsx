import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getReceiptsByCustomer, getReceiptsByOwner } from '../services/receiptService';
import { formatCurrency, formatDate, sortByTimestamp } from '../utils/format';

// Receipts the signed-in user is party to — the ones issued to them as a
// buyer, plus (for sellers) the ones their business issued.
export default function ReceiptsPage() {
  const { user, isSeller } = useAuth();

  const asBuyer = useAsync(
    () => (user ? getReceiptsByCustomer(user.uid) : Promise.resolve([])),
    [user]
  );
  const asSeller = useAsync(
    () => (user && isSeller ? getReceiptsByOwner(user.uid) : Promise.resolve([])),
    [user, isSeller]
  );

  const loading = asBuyer.loading || asSeller.loading;
  const error = asBuyer.error || asSeller.error;

  const receipts = sortByTimestamp(
    [...(asBuyer.data || []), ...(asSeller.data || [])].filter(
      (receipt, index, all) => all.findIndex((r) => r.id === receipt.id) === index
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
        <h1 className="page__title">Receipts</h1>
        <p className="page__subtitle">
          Proof of every confirmed payment. Open a receipt to download the PDF.
        </p>
      </div>

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && receipts.length === 0 && (
        <EmptyState
          title="No receipts yet"
          message="Receipts are generated automatically once a payment is confirmed."
          action={<Link to="/orders" className="btn btn--primary">View my orders</Link>}
        />
      )}

      {!loading && !error && receipts.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Business</th>
                <th>Customer</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id}>
                  <td>
                    <Link to={`/receipt/${receipt.id}`} className="table__link">
                      {receipt.receiptNumber}
                    </Link>
                  </td>
                  <td>{receipt.businessName || '—'}</td>
                  <td>{receipt.customerName || '—'}</td>
                  <td>{formatCurrency(receipt.amount, receipt.currency)}</td>
                  <td>{receipt.paymentMethod || '—'}</td>
                  <td><StatusBadge status={receipt.status} /></td>
                  <td>{formatDate(receipt.paidAt || receipt.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
