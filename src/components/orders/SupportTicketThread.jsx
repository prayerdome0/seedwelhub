import { useState } from 'react';
import StatusBadge from '../StatusBadge';
import { useToast } from '../../contexts/ToastContext';
import { addOrderSupportReply, setOrderSupportStatus, supportStatusLabel } from '../../services/supportService';
import { formatDateTime } from '../../utils/format';

export default function SupportTicketThread({ ticket, user, role = 'buyer', onUpdated, showAdminControls = false }) {
  const [reply, setReply] = useState('');
  const [showClosedReply, setShowClosedReply] = useState(false);
  const [saving, setSaving] = useState(false);
  const { showToast } = useToast();

  const sendReply = async (event) => {
    event.preventDefault();
    const text = reply.trim();
    if (!text) return;
    setSaving(true);
    try {
      await addOrderSupportReply(ticket, {
        senderId: user.uid,
        senderName: user.name || user.displayName || user.email || (role === 'seller' ? 'Seller' : 'Buyer'),
        senderRole: role,
        text,
      });
      setReply('');
      setShowClosedReply(false);
      showToast('Reply sent.', 'success');
      onUpdated?.();
    } catch (error) {
      showToast(error.message || 'Could not send your reply.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status) => {
    setSaving(true);
    try {
      await setOrderSupportStatus(ticket.id, status);
      showToast(`Request marked ${status.replaceAll('_', ' ')}.`, 'success');
      onUpdated?.();
    } catch (error) {
      showToast(error.message || 'Could not update the request status.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
  const canManage = role === 'seller' || role === 'admin';

  return (
    <div className="support-thread">
      <header className="support-thread__header">
        <div>
          <span className="support-thread__topic">{String(ticket.topic || 'other').replaceAll('_', ' ')}</span>
          <h3>Order {ticket.orderNumber || ticket.orderId}</h3>
          <p>{ticket.businessName || 'Order support'} · {messages.length} message{messages.length === 1 ? '' : 's'}</p>
        </div>
        <StatusBadge status={ticket.status || 'open'} label={supportStatusLabel(ticket.status || 'open')} />
      </header>

      <div className="support-thread__messages" aria-live="polite">
        {messages.map((message) => (
          <article key={message.id || `${message.senderId}-${message.createdAt}`} className={`support-message support-message--${message.senderRole || 'buyer'}`}>
            <div className="support-message__meta">
              <strong>{message.senderName || (message.senderRole === 'seller' ? 'Seller' : 'Buyer')}</strong>
              <time>{formatDateTime(message.createdAt)}</time>
            </div>
            <p>{message.text}</p>
          </article>
        ))}
      </div>

      {role === 'buyer' && ['resolved', 'closed'].includes(ticket.status) && !showClosedReply && (
        <button type="button" className="btn btn--outline btn--sm mt-16" onClick={() => setShowClosedReply(true)}>
          Ask for more help
        </button>
      )}
      {(ticket.status !== 'resolved' && ticket.status !== 'closed' || (role === 'buyer' && showClosedReply)) && (
        <form className="support-thread__reply" onSubmit={sendReply}>
          <label className="form__label" htmlFor={`support-reply-${ticket.id}`}>Reply</label>
          <textarea
            id={`support-reply-${ticket.id}`}
            className="form__textarea"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            placeholder="Write a clear update or response…"
            maxLength={2000}
            required
          />
          <button type="submit" className="btn btn--primary btn--sm" disabled={saving || !reply.trim()}>
            {saving ? 'Sending…' : 'Send reply'}
          </button>
        </form>
      )}

      {(canManage || showAdminControls) && (
        <div className="support-thread__actions">
          {ticket.status !== 'resolved' && (
            <button type="button" className="btn btn--outline btn--sm" onClick={() => changeStatus('resolved')} disabled={saving}>
              Mark resolved
            </button>
          )}
          {ticket.status === 'resolved' && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => changeStatus('open')} disabled={saving}>
              Reopen request
            </button>
          )}
          {showAdminControls && ticket.status !== 'closed' && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => changeStatus('closed')} disabled={saving}>
              Close case
            </button>
          )}
        </div>
      )}
    </div>
  );
}
