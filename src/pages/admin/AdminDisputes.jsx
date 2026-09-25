import { useState } from 'react';
import { Link } from 'react-router-dom';
import Badge from '../../components/Badge';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import SupportTicketThread from '../../components/orders/SupportTicketThread';
import { EmptyState, ErrorState } from '../../components/PageState';
import { useAuth } from '../../contexts/AuthContext';
import useAsync from '../../hooks/useAsync';
import { getAllOrderSupportTickets, supportStatusLabel } from '../../services/supportService';
import { formatDateTime } from '../../utils/format';

const FILTERS = [
  ['all', 'All cases'],
  ['open', 'Open'],
  ['awaiting_seller', 'Awaiting seller'],
  ['awaiting_buyer', 'Awaiting buyer'],
  ['resolved', 'Resolved'],
  ['closed', 'Closed'],
];

export default function AdminDisputes() {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState('');
  const cases = useAsync(() => getAllOrderSupportTickets(), []);

  if (cases.loading) return <Spinner size="large" label="Loading buyer-help cases…" />;
  if (cases.error) return <ErrorState message={cases.error} onRetry={cases.retry} />;

  const all = cases.data || [];
  const filtered = filter === 'all' ? all : all.filter((ticket) => ticket.status === filter);
  const openCount = all.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length;
  const selected = all.find((ticket) => ticket.id === selectedId);

  return (
    <div className="admin-disputes">
      <div className="panel">
        <div className="admin-disputes__heading">
          <div>
            <h2 className="panel__title">Order help &amp; disputes</h2>
            <p className="text-muted">Review buyer requests, follow the conversation and record a resolution. Any refund or payment reversal must still be completed through the seller's payment provider.</p>
          </div>
          {openCount > 0 && <Badge tone="danger">{openCount} open</Badge>}
        </div>
        <div className="admin-disputes__filters" role="group" aria-label="Filter cases">
          {FILTERS.map(([value, label]) => (
            <button key={value} type="button" className={`chip ${filter === value ? 'active' : ''}`} onClick={() => setFilter(value)}>
              {label}{value === 'all' ? ` (${all.length})` : ''}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No cases in this view" message="New order-help requests will appear here." />
      ) : (
        <div className="admin-case-list">
          {filtered.map((ticket) => (
            <article key={ticket.id} className={`panel admin-case ${selectedId === ticket.id ? 'admin-case--selected' : ''}`}>
              <div className="admin-case__summary">
                <div className="admin-case__copy">
                  <div className="flex items-center gap-8 flex-wrap">
                    <strong>{ticket.buyerName || 'Buyer'}</strong>
                    <StatusBadge status={ticket.status} label={supportStatusLabel(ticket.status)} />
                  </div>
                  <p>{ticket.businessName || 'Seller'} · {String(ticket.topic || 'other').replaceAll('_', ' ')} · <Link to={`/order/${ticket.orderId}`} className="table__link">{ticket.orderNumber || ticket.orderId}</Link></p>
                  <p className="admin-case__last-message">{ticket.lastMessage || 'No message'}<small> · {formatDateTime(ticket.updatedAt || ticket.lastMessageAt)}</small></p>
                </div>
                <button type="button" className="btn btn--outline btn--sm" onClick={() => setSelectedId((current) => current === ticket.id ? '' : ticket.id)}>
                  {selectedId === ticket.id ? 'Hide conversation' : 'Review case'}
                </button>
              </div>
              {selectedId === ticket.id && selected && (
                <div className="admin-case__thread">
                  <SupportTicketThread
                    ticket={selected}
                    user={{ ...user, name: profile?.name || user?.displayName || 'Admin' }}
                    role="admin"
                    showAdminControls
                    onUpdated={cases.retry}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
