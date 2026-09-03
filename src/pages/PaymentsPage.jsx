import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Spinner from '../components/Spinner';
import Badge from '../components/Badge';
import { EmptyState, ErrorState } from '../components/PageState';
import StatusBadge from '../components/StatusBadge';
import useAsync from '../hooks/useAsync';
import { getPaymentsByBuyer, getPaymentsByOwner } from '../services/paymentService';
import { getProofsByBuyer } from '../services/paymentProofService';
import { formatCurrency, relativeTime, sortByTimestamp } from '../utils/format';
import { PAYMENT_STATUS } from '../utils/constants';

// Payments a user is involved in. A seller is also a buyer, so the page shows
// both sides behind a filter rather than hiding the money they have received.
export default function PaymentsPage() {
  const { user, isSeller } = useAuth();
  const [view, setView] = useState('sent');

  const sent = useAsync(
    () => (user ? getPaymentsByBuyer(user.uid) : Promise.resolve([])),
    [user?.uid]
  );
  const received = useAsync(
    () => (user && isSeller ? getPaymentsByOwner(user.uid) : Promise.resolve([])),
    [user?.uid, isSeller]
  );
  const proofs = useAsync(
    () => (user ? getProofsByBuyer(user.uid) : Promise.resolve([])),
    [user?.uid]
  );

  const rows = useMemo(() => {
    const list = view === 'received' ? received.data : sent.data;
    return sortByTimestamp(list || [], 'createdAt');
  }, [view, sent.data, received.data]);

  const awaiting = useMemo(
    () =>
      (proofs.data || []).filter(
        (proof) => proof.status === 'submitted' || proof.status === 'under_review'
      ),
    [proofs.data]
  );

  const loading = sent.loading || received.loading;
  const error = sent.error || received.error;
  const retry = () => {
    sent.retry();
    received.retry();
    proofs.retry();
  };

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Payments</h1>
        <p className="page__subtitle">
          Every payment you have made or received, with its verification status.
        </p>
      </div>

      {awaiting.length > 0 && (
        <div className="panel panel--info">
          <h2 className="panel__title">
            ⏳ Awaiting seller confirmation
            <Badge tone="warning" className="ml-8">{awaiting.length}</Badge>
          </h2>
          <p className="text-muted mb-16">
            You have submitted proof of payment for these orders. A payment is only
            marked as paid once the seller has verified it — uploading a screenshot
            alone never completes an order.
          </p>
          <ul className="plain-list">
            {awaiting.map((proof) => (
              <li key={proof.id} className="awaiting-row">
                <span>
                  {proof.orderId ? (
                    <Link to={`/order/${proof.orderId}`} className="table__link">
                      {proof.orderNumber || 'Order'}
                    </Link>
                  ) : (
                    'Order'
                  )}
                  {' — '}
                  {formatCurrency(proof.amount, proof.currency)}
                </span>
                <StatusBadge status={proof.status} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {isSeller && (
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'sent'}
            className={`tabs__tab ${view === 'sent' ? 'active' : ''}`}
            onClick={() => setView('sent')}
          >
            Payments made ({sent.data?.length || 0})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'received'}
            className={`tabs__tab ${view === 'received' ? 'active' : ''}`}
            onClick={() => setView('received')}
          >
            Payments received ({received.data?.length || 0})
          </button>
        </div>
      )}

      {loading && <Spinner size="large" />}
      {!loading && error && <ErrorState message={error} onRetry={retry} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState
          title="Nothing here yet"
          message={
            view === 'received'
              ? 'No payments have been received yet.'
              : 'You have not made any payments yet.'
          }
        />
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>{view === 'received' ? 'Buyer' : 'Business'}</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <Link to={`/payment/${payment.id}`} className="table__link">
                      {payment.reference || payment.transactionReference || 'Payment'}
                    </Link>
                  </td>
                  <td>
                    {view === 'received'
                      ? payment.buyerName || '—'
                      : payment.businessName || '—'}
                  </td>
                  <td>{formatCurrency(payment.amount, payment.currency)}</td>
                  <td>{payment.method || '—'}</td>
                  <td>
                    <StatusBadge status={payment.status} />
                    {payment.status === PAYMENT_STATUS.CONFIRMED && ' ✅'}
                  </td>
                  <td>{relativeTime(payment.paidAt || payment.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
