import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../Button';
import Spinner from '../Spinner';
import SupportTicketThread from './SupportTicketThread';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import useAsync from '../../hooks/useAsync';
import { createOrderSupportTicket, getOrderSupportTicket } from '../../services/supportService';

const TOPICS = [
  ['delivery', 'Delivery or pickup'],
  ['cancellation', 'Cancel or change this order'],
  ['payment', 'Payment issue'],
  ['dispute', 'Report a dispute'],
  ['refund', 'Refund, return or exchange'],
  ['other', 'Something else'],
];

export default function OrderHelpPanel({ order, isBuyer, isSeller }) {
  const { user, profile, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [opening, setOpening] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [topic, setTopic] = useState('delivery');
  const [message, setMessage] = useState('');
  const role = isAdmin ? 'admin' : isSeller ? 'seller' : 'buyer';
  const ticketState = useAsync(
    () => getOrderSupportTicket({ orderId: order?.id, uid: user?.uid, role, isAdmin }),
    [order?.id, user?.uid, role, isAdmin]
  );

  if (!user || (!isBuyer && !isSeller && !isAdmin)) return null;

  const openRequest = async (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    setOpening(true);
    try {
      await createOrderSupportTicket({
        order,
        buyer: { uid: user.uid, name: profile?.name || user.displayName || user.email },
        topic,
        message,
      });
      setMessage('');
      setShowForm(false);
      showToast('Your help request was sent to the seller.', 'success');
      ticketState.retry();
    } catch (error) {
      showToast(error.message || 'Could not send your help request.', 'error');
    } finally {
      setOpening(false);
    }
  };

  return (
    <section className="panel order-help-panel">
      <div className="order-help-panel__heading">
        <div>
          <h2 className="panel__title">Need help with this order?</h2>
          <p className="text-muted">Ask the seller about an update, cancellation, return or refund. Requests are tracked here; payments are not automatically reversed.</p>
        </div>
        {isBuyer && !ticketState.data && (
          <Button variant="outline" size="sm" onClick={() => setShowForm((open) => !open)}>
            {showForm ? 'Close' : 'Get order help'}
          </Button>
        )}
      </div>

      {ticketState.loading && <Spinner size="sm" label="Checking order help…" />}
      {ticketState.error && <p className="form__msg form__msg--warning">Help history could not be loaded. <button type="button" className="link-button" onClick={ticketState.retry}>Try again</button></p>}

      {ticketState.data && (
        <SupportTicketThread
          ticket={ticketState.data}
          user={{ ...user, name: profile?.name || user.displayName }}
          role={role}
          onUpdated={ticketState.retry}
        />
      )}

      {isBuyer && !ticketState.data && showForm && (
        <form className="order-help-form" onSubmit={openRequest}>
          <div className="form__group">
            <label className="form__label" htmlFor={`help-topic-${order.id}`}>What do you need help with?</label>
            <select id={`help-topic-${order.id}`} className="form__select" value={topic} onChange={(event) => setTopic(event.target.value)}>
              {TOPICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor={`help-message-${order.id}`}>Message to the seller</label>
            <textarea
              id={`help-message-${order.id}`}
              className="form__textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              placeholder="Tell the seller what happened and what outcome you are asking for."
              required
            />
          </div>
          <div className="flex gap-8 flex-wrap">
            <Button type="submit" variant="primary" loading={opening}>Send request</Button>
            <Link to={`/messages`} className="btn btn--ghost">Message the seller</Link>
          </div>
        </form>
      )}

      {isSeller && !ticketState.loading && !ticketState.error && !ticketState.data && (
        <p className="text-muted">No buyer-help request has been opened for this order.</p>
      )}
    </section>
  );
}
