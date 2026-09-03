import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getPendingPayments, updatePaymentStatus } from '../../services/paymentService';
import { useToast } from '../../contexts/ToastContext';
import { formatCurrency, relativeTime } from '../../utils/format';

export default function AdminPayments() {
  const { data, loading, error, retry } = useAsync(() => getPendingPayments(), []);
  const { showToast } = useToast();

  const handleConfirm = async (id) => {
    await updatePaymentStatus(id, 'confirmed');
    showToast('Payment confirmed.', 'success');
    retry();
  };
  const handleReject = async (id) => {
    await updatePaymentStatus(id, 'rejected');
    showToast('Payment rejected.', 'info');
    retry();
  };

  if (loading) return <Spinner size="large" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.length === 0) return <EmptyState title="No pending payments" />;

  return (
    <div className="panel">
      <h2 className="panel__title">Pending Payments ({data.length})</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Reference</th><th>Business</th><th>Amount</th><th>Method</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id}>
                <td>{p.reference}</td>
                <td>{p.businessName || '—'}</td>
                <td>{formatCurrency(p.amount)}</td>
                <td>{p.method || '—'}</td>
                <td>{relativeTime(p.createdAt)}</td>
                <td>
                  <button type="button" className="btn btn--sm btn--outline" onClick={() => handleConfirm(p.id)}>Confirm</button>
                  <button type="button" className="btn btn--sm btn--danger" style={{ marginLeft: 6 }} onClick={() => handleReject(p.id)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
