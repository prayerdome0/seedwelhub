import Spinner from '../../components/Spinner';
import { ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getTotalUsers, getTotalBusinesses, getTotalProducts, getTotalOrders, getTotalPayments, getRecentAuditLogs, getSecurityEvents } from '../../services/adminService';
import { relativeTime } from '../../utils/format';

export default function AdminDashboard() {
  const stats = useAsync(async () => {
    const [users, businesses, products, orders, payments, auditLogs, securityEvents] = await Promise.all([
      getTotalUsers(),
      getTotalBusinesses(),
      getTotalProducts(),
      getTotalOrders(),
      getTotalPayments(),
      getRecentAuditLogs(8),
      getSecurityEvents(8),
    ]);
    return {
      users: users.length,
      businesses: businesses.length,
      products: products.length,
      orders: orders.length,
      payments: payments.length,
      auditLogs,
      securityEvents,
    };
  }, []);

  if (stats.loading) return <Spinner size="large" />;
  if (stats.error) return <ErrorState message={stats.error} onRetry={stats.retry} />;

  const data = stats.data;

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="stat-card"><span className="stat-card__label">Total Users</span><span className="stat-card__value">{data.users}</span></div>
        <div className="stat-card"><span className="stat-card__label">Total Businesses</span><span className="stat-card__value">{data.businesses}</span></div>
        <div className="stat-card"><span className="stat-card__label">Total Products</span><span className="stat-card__value">{data.products}</span></div>
        <div className="stat-card"><span className="stat-card__label">Total Orders</span><span className="stat-card__value">{data.orders}</span></div>
        <div className="stat-card"><span className="stat-card__label">Total Payments</span><span className="stat-card__value">{data.payments}</span></div>
      </div>

      <div className="panel">
        <h2 className="panel__title">Recent Admin Activity</h2>
        {data.auditLogs.length === 0 && <p className="text-muted">No recent activity.</p>}
        <ul>
          {data.auditLogs.map((log) => (
            <li key={log.id} className="notif-item">
              <div className="notif-item__body">
                <div className="notif-item__title">{log.action}</div>
                <div className="notif-item__msg">{log.target}</div>
                <div className="notif-item__time">{relativeTime(log.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h2 className="panel__title">Security Alerts</h2>
        {data.securityEvents.length === 0 && <p className="text-muted">No security alerts.</p>}
        <ul>
          {data.securityEvents.map((ev) => (
            <li key={ev.id} className="notif-item">
              <div className="notif-item__body">
                <div className="notif-item__title">{ev.event}</div>
                <div className="notif-item__msg">Severity: {ev.severity}</div>
                <div className="notif-item__time">{relativeTime(ev.createdAt)}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
