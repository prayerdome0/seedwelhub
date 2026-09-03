import Spinner from '../../components/Spinner';
import Badge from '../../components/Badge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getPendingVerifications, verifyBusiness, rejectBusiness } from '../../services/adminService';
import { useToast } from '../../contexts/ToastContext';
import { relativeTime } from '../../utils/format';

export default function AdminVerification() {
  const { data, loading, error, retry } = useAsync(() => getPendingVerifications(), []);
  const { showToast } = useToast();

  const handleVerify = async (id) => {
    await verifyBusiness(id);
    showToast('Business verified.', 'success');
    retry();
  };
  const handleReject = async (id) => {
    await rejectBusiness(id);
    showToast('Business rejected.', 'info');
    retry();
  };

  if (loading) return <Spinner size="large" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.length === 0) return <EmptyState title="Nothing to verify" message="No pending verifications." />;

  return (
    <div className="panel">
      <h2 className="panel__title">Business Verification</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Business</th><th>Category</th><th>Submitted</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td><Badge tone="info">{b.category || '—'}</Badge></td>
                <td>{relativeTime(b.createdAt)}</td>
                <td>
                  <button type="button" className="btn btn--sm btn--outline" onClick={() => handleVerify(b.id)}>Approve</button>
                  <button type="button" className="btn btn--sm btn--danger" style={{ marginLeft: 6 }} onClick={() => handleReject(b.id)}>Reject</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
