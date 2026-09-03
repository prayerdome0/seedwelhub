import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getTotalUsers, activateUser, suspendUser } from '../../services/adminService';
import { useToast } from '../../contexts/ToastContext';
import { relativeTime } from '../../utils/format';

export default function AdminUsers() {
  const { data, loading, error, retry } = useAsync(() => getTotalUsers(), []);
  const { showToast } = useToast();

  const handleSuspend = async (uid) => {
    await suspendUser(uid);
    showToast('User suspended.', 'success');
    retry();
  };
  const handleActivate = async (uid) => {
    await activateUser(uid);
    showToast('User activated.', 'success');
    retry();
  };

  if (loading) return <Spinner size="large" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.length === 0) return <EmptyState title="No users yet" />;

  return (
    <div className="panel">
      <h2 className="panel__title">Users ({data.length})</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody>
            {data.map((u) => (
              <tr key={u.id}>
                <td>{u.name || '—'}</td>
                <td>{u.email}</td>
                <td><StatusBadge status={u.role} /></td>
                <td><StatusBadge status={u.accountStatus} /></td>
                <td>{relativeTime(u.createdAt)}</td>
                <td>
                  {u.accountStatus === 'suspended' ? (
                    <button type="button" className="btn btn--sm btn--outline" onClick={() => handleActivate(u.uid)}>Activate</button>
                  ) : (
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => handleSuspend(u.uid)}>Suspend</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
