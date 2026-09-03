import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../Avatar';
import Spinner from '../Spinner';
import { messagePreview } from '../../utils/chat';

// ---------------------------------------------------------------------------
// Forward a message to another conversation or group. Shows the user's recent
// direct threads plus their groups; the workspace performs the actual send.
// ---------------------------------------------------------------------------

export default function ForwardDialog({ open, targets = [], loading, message, onClose, onForward }) {
  const [term, setTerm] = useState('');
  const [sendingTo, setSendingTo] = useState(null);

  useEffect(() => {
    if (open) {
      setTerm('');
      setSendingTo(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase();
    if (!needle) return targets;
    return targets.filter((t) => (t.title || '').toLowerCase().includes(needle));
  }, [targets, term]);

  if (!open) return null;

  const choose = async (target) => {
    setSendingTo(target.id);
    try {
      await onForward(target);
    } finally {
      setSendingTo(null);
    }
  };

  return createPortal(
    <div className="forward-dialog" role="dialog" aria-modal="true" aria-label="Forward message">
      <div className="forward-dialog__card">
        <div className="forward-dialog__head">
          <h3>Forward message</h3>
          <button type="button" className="forward-dialog__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="forward-dialog__preview">
          <small>Forwarding:</small> {message ? messagePreview(message) : ''}
        </p>
        <input
          className="forward-dialog__search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search conversations and groups…"
          aria-label="Search forward targets"
        />
        <div className="forward-dialog__list">
          {loading && <div className="forward-dialog__loading"><Spinner size="sm" /></div>}
          {!loading && filtered.length === 0 && (
            <p className="forward-dialog__empty">No conversations or groups found.</p>
          )}
          {!loading &&
            filtered.map((target) => (
              <button
                key={`${target.kind}-${target.id}`}
                type="button"
                className="forward-dialog__item"
                onClick={() => choose(target)}
                disabled={Boolean(sendingTo)}
              >
                <Avatar src={target.photo} name={target.title} size="sm" />
                <span className="forward-dialog__item-body">
                  <strong>{target.title}</strong>
                  <small>{target.kind === 'group' ? `Group · ${target.subtitle || ''}` : 'Direct message'}</small>
                </span>
                {sendingTo === target.id ? <Spinner size="sm" /> : <span aria-hidden="true">➤</span>}
              </button>
            ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
