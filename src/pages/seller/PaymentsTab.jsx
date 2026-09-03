import { Link } from 'react-router-dom';
import Spinner from '../../components/Spinner';
import Badge from '../../components/Badge';
import StatusBadge from '../../components/StatusBadge';
import PaymentProofList from '../../components/payments/PaymentProofList';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getProofsByBusiness } from '../../services/paymentProofService';
import { getPaymentsByBusiness } from '../../services/paymentService';
import { PROOF_STATUS } from '../../utils/constants';
import { formatCurrency, formatDateTime } from '../../utils/format';

// Seller Dashboard → Payments.
// Pending proofs come first because they are the only thing that needs the
// seller's action; the confirmed ledger sits underneath as a record.
export default function PaymentsTab({ business }) {
  const proofs = useAsync(
    () => (business?.id ? getProofsByBusiness(business.id) : Promise.resolve([])),
    [business?.id]
  );
  const payments = useAsync(
    () => (business?.id ? getPaymentsByBusiness(business.id) : Promise.resolve([])),
    [business?.id]
  );

  if (!business) return null;

  const loading = proofs.loading || payments.loading;
  const error = proofs.error || payments.error;

  const allProofs = proofs.data || [];
  const pending = allProofs.filter((proof) =>
    [PROOF_STATUS.SUBMITTED, PROOF_STATUS.UNDER_REVIEW].includes(proof.status)
  );
  const reviewed = allProofs.filter(
    (proof) => ![PROOF_STATUS.SUBMITTED, PROOF_STATUS.UNDER_REVIEW].includes(proof.status)
  );
  const ledger = payments.data || [];

  const refresh = () => {
    proofs.retry();
    payments.retry();
  };

  if (loading) return <Spinner size="large" label="Loading payments…" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;

  return (
    <div className="mt-16">
      <div className="panel dash-toolbar">
        <div>
          <h2 className="panel__title">Payments</h2>
          <p className="text-muted">
            Review payment proofs before confirming. Confirming a payment marks the order paid
            and issues the buyer's receipt automatically.
          </p>
        </div>
        {pending.length > 0 && (
          <Badge tone="warning">{pending.length} awaiting review</Badge>
        )}
      </div>

      {pending.length > 0 && (
        <div className="mt-16">
          <PaymentProofList
            proofs={pending}
            business={business}
            onReviewed={refresh}
          />
        </div>
      )}

      {pending.length === 0 && (
        <div className="panel mt-16">
          <EmptyState
            title="No payment proofs awaiting review"
            message="When a buyer submits proof of payment, it will appear here for you to verify."
          />
        </div>
      )}

      {reviewed.length > 0 && (
        <div className="panel mt-16">
          <h3 className="panel__title">Reviewed proofs ({reviewed.length})</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Buyer</th>
                  <th>Amount</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th>Reviewed</th>
                </tr>
              </thead>
              <tbody>
                {reviewed.map((proof) => (
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
                    <td><StatusBadge status={proof.status} /></td>
                    <td>{formatDateTime(proof.reviewedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {ledger.length > 0 && (
        <div className="panel mt-16">
          <h3 className="panel__title">Payment ledger ({ledger.length})</h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Buyer</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      <Link to={`/payment/${payment.id}`} className="table__link">
                        {payment.reference || payment.transactionReference || '—'}
                      </Link>
                    </td>
                    <td>{payment.buyerName || '—'}</td>
                    <td>{formatCurrency(payment.amount, payment.currency)}</td>
                    <td>{payment.method || '—'}</td>
                    <td><StatusBadge status={payment.status} /></td>
                    <td>{formatDateTime(payment.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
