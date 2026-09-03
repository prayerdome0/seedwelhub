import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Spinner from '../../components/Spinner';
import Badge from '../../components/Badge';
import Button from '../../components/Button';
import StatusBadge from '../../components/StatusBadge';
import Avatar from '../../components/Avatar';
import { EmptyState, ErrorState, NotFoundState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getUserSecurityDossier, setUserRiskStatus } from '../../services/adminService';
import {
  RISK_STATUS,
  RISK_STATUS_FLOW,
  RISK_STATUS_LABELS,
} from '../../utils/constants';
import { formatCurrency, formatDateTime, relativeTime } from '../../utils/format';

// ---------------------------------------------------------------------------
// Admin → user security dossier.
//
// The consolidated, authorized view of one account: identity, role, status,
// orders, payments, proofs, transaction references, security events, reports
// and the audit trail. This is what an administrator uses to adjudicate a
// dispute — a record of platform activity, not covert tracking of a person.
// ---------------------------------------------------------------------------
function riskTone(status) {
  if (status === RISK_STATUS.SUSPENDED || status === RISK_STATUS.RESTRICTED) return 'danger';
  if (status === RISK_STATUS.UNDER_REVIEW || status === RISK_STATUS.FLAGGED) return 'warning';
  return 'success';
}

export default function AdminUserDossier() {
  const { uid } = useParams();
  const { user: admin } = useAuth();
  const { showToast } = useToast();
  const { data, loading, error, retry } = useAsync(() => getUserSecurityDossier(uid), [uid]);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState('');

  if (loading) return <Spinner size="large" label="Building dossier…" />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (!data?.user) {
    return <NotFoundState title="User not found" message="No account exists with this id." />;
  }

  const {
    user,
    businesses,
    orders,
    sellerOrders,
    payments,
    proofs,
    securityEvents,
    reports,
    auditLogs,
  } = data;

  const currentRisk = user.riskStatus || RISK_STATUS.NORMAL;

  const applyRisk = async (status) => {
    setBusy(status);
    try {
      await setUserRiskStatus(uid, status, { actorId: admin.uid, reason });
      showToast(`Account moved to “${RISK_STATUS_LABELS[status]}”.`, 'success');
      setReason('');
      retry();
    } catch (err) {
      showToast(err.message || 'Could not update the account status.', 'error');
    } finally {
      setBusy('');
    }
  };

  return (
    <>
      <div className="mb-16">
        <Link to="/admin/users" className="section__link">← Back to Users</Link>
      </div>

      <div className="panel">
        <div className="dossier-head">
          <Avatar src={user.photoURL} name={user.name || user.email} size="lg" />
          <div className="dossier-head__text">
            <h2 className="dossier-head__name">{user.name || 'Unnamed user'}</h2>
            <p className="text-muted">{user.email}</p>
            <div className="flex gap-8 flex-wrap mt-8">
              <Badge tone="neutral">{user.role || 'user'}</Badge>
              <StatusBadge status={user.accountStatus} />
              <Badge tone={riskTone(currentRisk)}>
                Risk: {RISK_STATUS_LABELS[currentRisk]}
              </Badge>
              {businesses?.length > 0 && <Badge tone="info">Seller</Badge>}
            </div>
          </div>
        </div>

        <dl className="kv mt-16">
          <dt>User ID</dt><dd><code>{user.uid || uid}</code></dd>
          <dt>Email verified</dt><dd>{user.emailVerified ? 'Yes' : 'No'}</dd>
          <dt>Phone</dt><dd>{user.phone || '—'}</dd>
          <dt>Joined</dt><dd>{formatDateTime(user.createdAt)}</dd>
          <dt>Last updated</dt><dd>{formatDateTime(user.updatedAt)}</dd>
          {user.riskReason && (<><dt>Risk reason</dt><dd>{user.riskReason}</dd></>)}
        </dl>
      </div>

      {/* Risk lifecycle */}
      <div className="panel">
        <h2 className="panel__title">Account risk status</h2>
        <div className="risk-flow">
          {RISK_STATUS_FLOW.map((status) => (
            <span
              key={status}
              className={`risk-flow__step ${currentRisk === status ? 'is-current' : ''}`}
            >
              {RISK_STATUS_LABELS[status]}
            </span>
          ))}
        </div>

        <div className="form__group mt-16">
          <label className="form__label" htmlFor="risk-reason">
            Reason (recorded in the audit trail)
          </label>
          <input
            id="risk-reason"
            className="form__input"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why is this status being applied?"
          />
        </div>

        <div className="dash-actions">
          {RISK_STATUS_FLOW.filter((status) => status !== currentRisk).map((status) => (
            <Button
              key={status}
              variant={status === RISK_STATUS.NORMAL ? 'outline' : 'ghost'}
              size="sm"
              loading={busy === status}
              onClick={() => applyRisk(status)}
            >
              {RISK_STATUS_LABELS[status]}
            </Button>
          ))}
        </div>
      </div>

      {businesses?.length > 0 && (
        <div className="panel">
          <h2 className="panel__title">Businesses ({businesses.length})</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Category</th><th>Verified</th><th>Status</th></tr></thead>
              <tbody>
                {businesses.map((business) => (
                  <tr key={business.id}>
                    <td>
                      <Link to={`/business/${business.id}`} className="table__link">
                        {business.name}
                      </Link>
                    </td>
                    <td>{business.category || '—'}</td>
                    <td>{business.isVerified ? '✅' : '—'}</td>
                    <td><StatusBadge status={business.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <DossierTable
        title="Orders placed (as buyer)"
        rows={orders}
        columns={['Order', 'Total', 'Payment', 'Status', 'Date']}
        render={(order) => (
          <tr key={order.id}>
            <td><Link to={`/order/${order.id}`} className="table__link">{order.orderNumber}</Link></td>
            <td>{formatCurrency(order.total, order.currency)}</td>
            <td><StatusBadge status={order.paymentStatus} /></td>
            <td><StatusBadge status={order.status} /></td>
            <td>{relativeTime(order.createdAt)}</td>
          </tr>
        )}
      />

      <DossierTable
        title="Sales received (as seller)"
        rows={sellerOrders}
        columns={['Order', 'Buyer', 'Total', 'Payment', 'Date']}
        render={(order) => (
          <tr key={order.id}>
            <td><Link to={`/order/${order.id}`} className="table__link">{order.orderNumber}</Link></td>
            <td>{order.buyerName || '—'}</td>
            <td>{formatCurrency(order.total, order.currency)}</td>
            <td><StatusBadge status={order.paymentStatus} /></td>
            <td>{relativeTime(order.createdAt)}</td>
          </tr>
        )}
      />

      <DossierTable
        title="Payments"
        rows={payments}
        columns={['Reference', 'Amount', 'Method', 'Status', 'Date']}
        render={(payment) => (
          <tr key={payment.id}>
            <td><code>{payment.transactionReference || payment.reference || '—'}</code></td>
            <td>{formatCurrency(payment.amount, payment.currency)}</td>
            <td>{payment.method || '—'}</td>
            <td><StatusBadge status={payment.status} /></td>
            <td>{relativeTime(payment.createdAt)}</td>
          </tr>
        )}
      />

      <DossierTable
        title="Payment proofs submitted"
        rows={proofs}
        columns={['Order', 'Amount', 'Reference', 'Status', 'Submitted']}
        render={(proof) => (
          <tr key={proof.id}>
            <td>
              {proof.orderId ? (
                <Link to={`/order/${proof.orderId}`} className="table__link">
                  {proof.orderNumber || 'Order'}
                </Link>
              ) : '—'}
            </td>
            <td>{formatCurrency(proof.amount, proof.currency)}</td>
            <td><code>{proof.transactionReference || '—'}</code></td>
            <td><StatusBadge status={proof.status} /></td>
            <td>{relativeTime(proof.submittedAt || proof.createdAt)}</td>
          </tr>
        )}
      />

      <DossierTable
        title="Security events"
        rows={securityEvents}
        columns={['Event', 'Severity', 'Resolved', 'When']}
        render={(event) => (
          <tr key={event.id}>
            <td>{event.event}</td>
            <td>
              <Badge tone={event.severity === 'high' || event.severity === 'critical' ? 'danger' : event.severity === 'warning' ? 'warning' : 'neutral'}>
                {event.severity}
              </Badge>
            </td>
            <td>{event.resolved ? '✅' : '—'}</td>
            <td>{relativeTime(event.createdAt)}</td>
          </tr>
        )}
      />

      <DossierTable
        title="Reports filed against this account"
        rows={reports}
        columns={['Reason', 'Reported by', 'Status', 'When']}
        render={(report) => (
          <tr key={report.id}>
            <td>{report.reason || report.type || '—'}</td>
            <td>{report.reporterName || report.reporterId?.slice(0, 8) || '—'}</td>
            <td><StatusBadge status={report.status} /></td>
            <td>{relativeTime(report.createdAt)}</td>
          </tr>
        )}
      />

      <DossierTable
        title="Audit trail"
        rows={auditLogs}
        columns={['Action', 'Performed by', 'When']}
        render={(log) => (
          <tr key={log.id}>
            <td><code>{log.action}</code></td>
            <td>{log.actorId?.slice(0, 8) || 'system'}</td>
            <td>{formatDateTime(log.createdAt)}</td>
          </tr>
        )}
      />
    </>
  );
}

function DossierTable({ title, rows, columns, render }) {
  const list = rows || [];
  return (
    <div className="panel">
      <h2 className="panel__title">{title} ({list.length})</h2>
      {list.length === 0 ? (
        <EmptyState title="Nothing recorded" message={`No ${title.toLowerCase()} for this account.`} />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>{list.map(render)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
