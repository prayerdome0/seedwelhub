import { Link } from 'react-router-dom';
import Badge from '../../components/Badge';
import Spinner from '../../components/Spinner';
import StatusBadge from '../../components/StatusBadge';
import { EmptyState, ErrorState } from '../../components/PageState';
import useAsync from '../../hooks/useAsync';
import { getOrderSupportTicketsByOwner, supportStatusLabel } from '../../services/supportService';
import { formatDateTime } from '../../utils/format';

export default function SellerHelpTab({ user, business }) {
  const tickets = useAsync(
    () => (user?.uid ? getOrderSupportTicketsByOwner(user.uid) : Promise.resolve([])),
    [user?.uid]
  );
  const list = (tickets.data || []).filter((ticket) => !business?.id || !ticket.businessId || ticket.businessId === business.id);
  const openCount = list.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length;

  if (tickets.loading) return <Spinner size="large" label="Loading buyer-help requests…" />;
  if (tickets.error) return <ErrorState message={tickets.error} onRetry={tickets.retry} />;

  return (
    <div className="panel seller-help-tab">
      <div className="seller-help-tab__header">
        <div>
          <h2 className="panel__title">Buyer help requests</h2>
          <p className="text-muted">Respond on the order thread so the buyer can see updates, decisions and next steps.</p>
        </div>
        {openCount > 0 && <Badge tone="warning">{openCount} need attention</Badge>}
      </div>
      {list.length === 0 ? (
        <EmptyState title="No buyer-help requests" message="If a buyer asks for help on an order, it will appear here." />
      ) : (
        <div className="seller-help-list">
          {list.map((ticket) => (
            <article key={ticket.id} className="seller-help-card">
              <div className="seller-help-card__main">
                <div className="flex items-center gap-8 flex-wrap">
                  <strong>{ticket.buyerName || 'Buyer'}</strong>
                  <StatusBadge status={ticket.status} label={supportStatusLabel(ticket.status)} />
                </div>
                <p className="seller-help-card__order">
                  {ticket.businessName || business?.name || 'Order'} · {ticket.orderNumber || ticket.orderId}
                </p>
                <p className="seller-help-card__message">{ticket.lastMessage || 'No message'}</p>
                <small>Updated {formatDateTime(ticket.updatedAt || ticket.lastMessageAt)}</small>
              </div>
              <Link to={`/order/${ticket.orderId}`} className="btn btn--primary btn--sm">Open &amp; reply</Link>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
