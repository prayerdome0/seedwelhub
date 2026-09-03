import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../Avatar';
import Spinner from '../Spinner';
import Image from '../Image';
import { REPORT_REASONS, formatBytes, messagePreview, messageTime } from '../../utils/chat';

// ---------------------------------------------------------------------------
// Side panels for the chat workspace: in-conversation search, media & files,
// starred/pinned lists, conversation info, group info + members + settings,
// plus the shared report dialog and a two-step confirm control.
//
// Panels render INSIDE the fixed workspace (absolutely positioned) so opening
// one never scrolls the page.
// ---------------------------------------------------------------------------

export function SidePanel({ title, onClose, children, footer }) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <aside className="chat-aside" role="complementary" aria-label={title}>
      <div className="chat-aside__head">
        <h3>{title}</h3>
        <button type="button" className="chat-aside__close" onClick={onClose} aria-label="Close panel">
          ✕
        </button>
      </div>
      <div className="chat-aside__body">{children}</div>
      {footer && <div className="chat-aside__foot">{footer}</div>}
    </aside>
  );
}

export function SearchPanel({ term, onTermChange, results, onJump }) {
  return (
    <>
      <input
        className="chat-aside__search"
        value={term}
        onChange={(e) => onTermChange(e.target.value)}
        placeholder="Search within conversation…"
        aria-label="Search within conversation"
        autoFocus
      />
      <div className="chat-aside__results">
        {term.trim() && results.length === 0 && (
          <p className="chat-aside__empty">No messages match “{term.trim()}”.</p>
        )}
        {!term.trim() && (
          <p className="chat-aside__empty">Search messages in this conversation. Matching text is highlighted in the thread.</p>
        )}
        {results.map((message) => (
          <button key={message.id} type="button" className="chat-aside__result" onClick={() => onJump(message.id)}>
            <strong>{message.senderName || 'Message'}</strong>
            <span>{messagePreview(message)}</span>
            <small>{messageTime(message.createdAt)}</small>
          </button>
        ))}
      </div>
    </>
  );
}

export function MediaPanel({ media, files, onJump, onOpenImage }) {
  return (
    <>
      <h4 className="chat-aside__section">🖼️ Photos & videos</h4>
      {media.length === 0 && <p className="chat-aside__empty">No shared media yet.</p>}
      <div className="chat-aside__media-grid">
        {media.map((message) =>
          message.type === 'image' ? (
            <button
              key={message.id}
              type="button"
              className="chat-aside__media-cell"
              onClick={() => onOpenImage(message.mediaUrl, message.text)}
              title="Open"
            >
              <Image src={message.mediaUrl} alt={message.text || 'Shared image'} />
            </button>
          ) : (
            <button
              key={message.id}
              type="button"
              className="chat-aside__media-cell chat-aside__media-cell--video"
              onClick={() => onJump(message.id)}
              title="Jump to video"
            >
              <video src={message.mediaUrl} preload="metadata" muted />
              <span aria-hidden="true">▶</span>
            </button>
          )
        )}
      </div>
      <h4 className="chat-aside__section">📄 Documents</h4>
      {files.length === 0 && <p className="chat-aside__empty">No documents shared yet.</p>}
      {files.map((message) => (
        <a
          key={message.id}
          className="chat-aside__file"
          href={message.mediaUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          <span aria-hidden="true">📄</span>
          <strong>{message.mediaName || 'Document'}</strong>
          <small>{formatBytes(message.mediaSize)}</small>
        </a>
      ))}
    </>
  );
}

export function MessageListPanel({ messages, onJump, emptyHint }) {
  return (
    <>
      {messages.length === 0 && <p className="chat-aside__empty">{emptyHint}</p>}
      {messages.map((message) => (
        <button key={message.id} type="button" className="chat-aside__result" onClick={() => onJump(message.id)}>
          <strong>{message.senderName || 'Message'}</strong>
          <span>{messagePreview(message)}</span>
          <small>{messageTime(message.createdAt)}</small>
        </button>
      ))}
    </>
  );
}

export function InfoPanel({
  title,
  avatarSrc,
  rows = [],
  actions = [],
  children,
}) {
  return (
    <>
      <div className="chat-aside__profile">
        <Avatar src={avatarSrc} name={title} size="lg" />
        <h4>{title}</h4>
      </div>
      {rows.length > 0 && (
        <dl className="chat-aside__rows">
          {rows.map((row) => (
            <div key={row.label} className="chat-aside__row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {children}
      {actions.length > 0 && (
        <div className="chat-aside__actions">
          {actions.map((action) =>
            action.danger ? (
              <DangerAction key={action.label} {...action} />
            ) : (
              <button
                key={action.label}
                type="button"
                className={`btn ${action.primary ? 'btn--primary' : 'btn--secondary'} btn--sm`}
                onClick={action.onClick}
                disabled={action.disabled}
              >
                {action.icon ? `${action.icon} ` : ''}{action.label}
              </button>
            )
          )}
        </div>
      )}
    </>
  );
}

/** Two-step confirm button for destructive actions (clear, block, remove…). */
export function DangerAction({ icon, label, confirmLabel = 'Are you sure?', onConfirm, disabled }) {
  const [arming, setArming] = useState(false);
  useEffect(() => {
    if (!arming) return undefined;
    const timer = window.setTimeout(() => setArming(false), 4000);
    return () => window.clearTimeout(timer);
  }, [arming]);
  return arming ? (
    <span className="chat-aside__confirm">
      <small>{confirmLabel}</small>
      <button type="button" className="btn btn--danger btn--sm" onClick={onConfirm}>
        Yes, continue
      </button>
      <button type="button" className="btn btn--secondary btn--sm" onClick={() => setArming(false)}>
        No
      </button>
    </span>
  ) : (
    <button
      type="button"
      className="btn btn--danger-outline btn--sm"
      onClick={() => setArming(true)}
      disabled={disabled}
    >
      {icon ? `${icon} ` : ''}{label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Group-specific panels.
// ---------------------------------------------------------------------------

export function GroupSettingsForm({ group, viewerIsAdmin, saving, onSave, onSetAnnouncement }) {
  const [name, setName] = useState(group.name || '');
  const [description, setDescription] = useState(group.description || '');
  const [category, setCategory] = useState(group.category || '');
  const [visibility, setVisibility] = useState(group.visibility || 'public');
  const [whoCanSend, setWhoCanSend] = useState(group.permissions?.whoCanSend || 'all');
  const [announcement, setAnnouncement] = useState(group.announcement?.text || '');

  useEffect(() => {
    setName(group.name || '');
    setDescription(group.description || '');
    setCategory(group.category || '');
    setVisibility(group.visibility || 'public');
    setWhoCanSend(group.permissions?.whoCanSend || 'all');
    setAnnouncement(group.announcement?.text || '');
  }, [group]);

  if (!viewerIsAdmin) {
    return (
      <p className="chat-aside__empty">
        Only group admins can change group settings. You can still manage your own notifications below.
      </p>
    );
  }

  return (
    <form
      className="chat-aside__form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, description, category, visibility, permissions: { whoCanSend } });
      }}
    >
      <label>
        Group name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={300} />
      </label>
      <label>
        Category
        <input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} />
      </label>
      <label>
        Visibility
        <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
          <option value="public">Public — anyone can join</option>
          <option value="private">Private — invite only</option>
        </select>
      </label>
      <label>
        Group permissions — who can send messages
        <select value={whoCanSend} onChange={(e) => setWhoCanSend(e.target.value)}>
          <option value="all">All members</option>
          <option value="admins">Admins only</option>
        </select>
      </label>
      <label>
        📢 Group announcement
        <textarea
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Pin an announcement for everyone…"
        />
      </label>
      <div className="chat-aside__actions">
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving}>
          {saving ? <Spinner size="sm" /> : 'Save settings'}
        </button>
        <button
          type="button"
          className="btn btn--secondary btn--sm"
          onClick={() => onSetAnnouncement(announcement)}
          disabled={saving}
        >
          📢 Update announcement
        </button>
      </div>
    </form>
  );
}

export function MembersPanel({
  members,
  viewerId,
  viewerIsAdmin,
  onlineUids = [],
  onAddMember,
  onRemoveMember,
  onPromote,
  onDemote,
  onLeave,
  adding,
  busy,
}) {
  const [uid, setUid] = useState('');
  const [name, setName] = useState('');
  const [filter, setFilter] = useState('');

  const filtered = members.filter((m) =>
    (m.name || '').toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <>
      {viewerIsAdmin && (
        <form
          className="chat-aside__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!uid.trim()) return;
            onAddMember(uid.trim(), name.trim());
            setUid('');
            setName('');
          }}
        >
          <h4 className="chat-aside__section">➕ Add member</h4>
          <label>
            Member’s Seedwel ID (UID)
            <input value={uid} onChange={(e) => setUid(e.target.value)} placeholder="e.g. kQ3x…uid" required />
          </label>
          <label>
            Name (optional)
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown next to their messages" />
          </label>
          <button type="submit" className="btn btn--primary btn--sm" disabled={adding}>
            {adding ? <Spinner size="sm" /> : 'Add member'}
          </button>
          <p className="chat-aside__note">
            Seedwel IDs are private — ask the member to copy it from their profile page.
          </p>
        </form>
      )}

      <input
        className="chat-aside__search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Search ${members.length} members…`}
        aria-label="Search members"
      />

      <div className="chat-aside__members">
        {filtered.map((member) => {
          const own = member.uid === viewerId;
          const online = onlineUids.includes(member.uid);
          return (
            <div key={member.id} className="chat-aside__member">
              <span className="chat-aside__member-avatar">
                <Avatar name={member.name || member.uid} size="sm" />
                {online && <i className="chat-aside__online" title="Online" />}
              </span>
              <span className="chat-aside__member-body">
                <strong>
                  {member.name || 'Member'} {own && <small>(you)</small>}
                </strong>
                <small>
                  {member.role === 'admin' ? '🛡 Admin' : 'Member'}
                  {online ? ' · online' : ''}
                </small>
              </span>
              {viewerIsAdmin && !own && (
                <span className="chat-aside__member-actions">
                  {member.role === 'admin' ? (
                    <button type="button" className="chat-aside__mini" onClick={() => onDemote(member)} disabled={busy} title="Demote from admin">
                      🛡✕
                    </button>
                  ) : (
                    <button type="button" className="chat-aside__mini" onClick={() => onPromote(member)} disabled={busy} title="Promote to admin">
                      🛡
                    </button>
                  )}
                  <button type="button" className="chat-aside__mini chat-aside__mini--danger" onClick={() => onRemoveMember(member)} disabled={busy} title="Remove member">
                    ✕
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="chat-aside__actions chat-aside__actions--stack">
        <DangerAction
          icon="🚪"
          label="Leave group"
          confirmLabel="Leave this group?"
          onConfirm={onLeave}
        />
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Report dialog — shared by message reports, conversation and group reports.
// ---------------------------------------------------------------------------

export function ReportDialog({ open, title = 'Report', onClose, onSubmit, submitting }) {
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setNote('');
    }
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="report-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <div className="report-dialog__card">
        <div className="report-dialog__head">
          <h3>🚩 {title}</h3>
          <button type="button" className="report-dialog__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="report-dialog__body">
          {REPORT_REASONS.map((item) => (
            <label key={item} className="report-dialog__reason">
              <input
                type="radio"
                name="report-reason"
                value={item}
                checked={reason === item}
                onChange={() => setReason(item)}
              />
              {item}
            </label>
          ))}
          <textarea
            className="report-dialog__note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Anything else we should know? (optional)"
          />
        </div>
        <div className="report-dialog__actions">
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!reason || submitting}
            onClick={() => onSubmit({ reason, note })}
          >
            {submitting ? <Spinner size="sm" /> : 'Submit report'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Small row used by the info panels (e.g. Muted / Media count / Members). */
export function InfoRow({ label, value }) {
  return (
    <div className="chat-aside__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
