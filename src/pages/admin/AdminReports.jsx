import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getReports } from '../../services/adminService';
import { relativeTime } from '../../utils/format';

export default function AdminReports() {
  const { data, loading, error, retry } = useAsync(() => getReports(), []);

  if (loading) return <Spinner size="large" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.length === 0) return <EmptyState title="No reports yet" message="Reports will appear here." />;

  return (
    <div className="panel">
      <h2 className="panel__title">Reports ({data.length})</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Report</th><th>Type</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td>{r.title || r.description || '—'}</td>
                <td>{r.type || '—'}</td>
                <td><StatusBadge status={r.status} /></td>
                <td>{relativeTime(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
