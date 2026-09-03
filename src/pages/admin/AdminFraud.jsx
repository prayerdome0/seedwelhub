import { Link } from 'react-router-dom';
import Spinner from '../../components/Spinner';
import Badge from '../../components/Badge';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { detectSuspiciousPayments } from '../../services/adminService';
import { getAllPendingProofs } from '../../services/paymentProofService';
import { formatCurrency, formatDateTime, relativeTime } from '../../utils/format';

// ---------------------------------------------------------------------------
// Admin → Fraud monitoring.
//
// Surfaces the two signals that matter most in practice:
//   1. the same transaction reference claimed against multiple orders
//      (a recycled payment screenshot), and
//   2. payment proofs left unreviewed for days, where a buyer may be stuck
//      or a seller may be stalling.
// ---------------------------------------------------------------------------
export default function AdminFraud() {
  const signals = useAsync(() => detectSuspiciousPayments(), []);
  const pending = useAsync(() => getAllPendingProofs(), []);

  const loading = signals.loading || pending.loading;
  const error = signals.error || pending.error;
  const retry = () => {
    signals.retry();
    pending.retry();
  };

  if (loading) return <Spinner size="large" label="Scanning transactions…" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;

  const duplicates = signals.data?.duplicateReferences || [];
  const stalled = signals.data?.stalledProofs || [];
  const queue = pending.data || [];

  return (
    <>
      <div className="panel">
        <h2 className="panel__title">Fraud monitoring</h2>
        <div className="grid grid--3">
          <div className="stat-card">
            <span className="stat-card__label">Duplicate references</span>
            <span className="stat-card__value">{duplicates.length}</span>
            <span className="stat-card__hint">Same reference on multiple orders</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Stalled proofs</span>
            <span className="stat-card__value">{stalled.length}</span>
            <span className="stat-card__hint">Unreviewed for 3+ days</span>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Awaiting review</span>
            <span className="stat-card__value">{queue.length}</span>
            <span className="stat-card__hint">Across all sellers</span>
          </div>
        </div>
      </div>

      <div className="panel">
        <h2 className="panel__title">
          Duplicate transaction references
          {duplicates.length > 0 && <Badge tone="danger" className="ml-8">{duplicates.length}</Badge>}
        </h2>
        <p className="text-muted mb-16">
          The same payment reference appearing on more than one order usually means one
          payment is being claimed against several purchases.
        </p>

        {duplicates.length === 0 ? (
          <EmptyState title="No duplicates found" message="No reference is being reused across orders." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Claims</th>
                  <th>Buyers</th>
                  <th>Orders</th>
                  <th>Total claimed</th>
                </tr>
              </thead>
              <tbody>
                {duplicates.map(({ reference, payments }) => (
                  <tr key={reference}>
                    <td><code>{reference}</code></td>
                    <td><Badge tone="danger">{payments.length}</Badge></td>
                    <td>
                      {[...new Set(payments.map((p) => p.buyerName).filter(Boolean))].join(', ') || '—'}
                    </td>
                    <td>
                      <div className="row-actions">
                        {payments
                          .filter((p) => p.orderId)
                          .map((p) => (
                            <Link key={p.id} to={`/order/${p.orderId}`} className="table__link">
                              {p.orderNumber || p.orderId.slice(0, 6)}
                            </Link>
                          ))}
                      </div>
                    </td>
                    <td>
                      {formatCurrency(
                        payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
                        payments[0]?.currency
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <h2 className="panel__title">Payment proofs awaiting review ({queue.length})</h2>
        {queue.length === 0 ? (
          <EmptyState title="Nothing pending" message="Every submitted proof has been reviewed." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((proof) => {
                  const isStalled = stalled.some((s) => s.id === proof.id);
                  return (
                    <tr key={proof.id}>
                      <td>
                        {proof.orderId ? (
                          <Link to={`/order/${proof.orderId}`} className="table__link">
                            {proof.orderNumber || 'Order'}
                          </Link>
                        ) : '—'}
                      </td>
                      <td>{proof.buyerName || '—'}</td>
                      <td>{formatCurrency(proof.amount, proof.currency)}</td>
                      <td><code>{proof.transactionReference || '—'}</code></td>
                      <td>
                        {isStalled ? (
                          <Badge tone="danger">Stalled</Badge>
                        ) : (
                          <StatusBadge status={proof.status} />
                        )}
                      </td>
                      <td>{relativeTime(proof.submittedAt || proof.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
