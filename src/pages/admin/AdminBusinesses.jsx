import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getTotalBusinesses, verifyBusiness, rejectBusiness } from '../../services/adminService';
import { useToast } from '../../contexts/ToastContext';
import { relativeTime } from '../../utils/format';

export default function AdminBusinesses() {
  const { data, loading, error, retry } = useAsync(() => getTotalBusinesses(), []);
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
  if (!data || data.length === 0) return <EmptyState title="No businesses yet" />;

  return (
    <div className="panel">
      <h2 className="panel__title">Businesses ({data.length})</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Business</th><th>Owner</th><th>Category</th><th>Verified</th><th>Created</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.ownerId?.slice(0, 8) || '—'}</td>
                <td>{b.category || '—'}</td>
                <td><StatusBadge status={b.isVerified ? 'verified' : 'pending'} /></td>
                <td>{relativeTime(b.createdAt)}</td>
                <td>
                  {!b.isVerified && (
                    <button type="button" className="btn btn--sm btn--outline" onClick={() => handleVerify(b.id)}>Verify</button>
                  )}
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
