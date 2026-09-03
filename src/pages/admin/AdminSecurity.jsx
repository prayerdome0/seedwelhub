import Spinner from '../../components/Spinner';
import Badge from '../../components/Badge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getSecurityEvents } from '../../services/adminService';
import { relativeTime } from '../../utils/format';

export default function AdminSecurity() {
  const { data, loading, error, retry } = useAsync(() => getSecurityEvents(), []);

  if (loading) return <Spinner size="large" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data || data.length === 0) return <EmptyState title="No security events" />;

  return (
    <div className="panel">
      <h2 className="panel__title">Security Events ({data.length})</h2>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Event</th><th>Severity</th><th>Actor</th><th>Date</th></tr></thead>
          <tbody>
            {data.map((ev) => (
              <tr key={ev.id}>
                <td>{ev.event}</td>
                <td><Badge tone={ev.severity === 'critical' || ev.severity === 'high' ? 'danger' : ev.severity === 'warning' ? 'warning' : 'neutral'}>{ev.severity}</Badge></td>
                <td>{ev.actorId?.slice(0, 8) || '—'}</td>
                <td>{relativeTime(ev.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
