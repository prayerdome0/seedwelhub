import { useRef, useState } from 'react';
import Avatar from '../Avatar';
import Image from '../Image';
import ChatMenu, { ChatMenuDivider, ChatMenuItem, ChatMenuTitle } from './ChatMenu';
import {
  MESSAGE_TYPES,
  QUICK_REACTIONS,
  deliveryStatus,
  formatBytes,
  formatDuration,
  matchSegments,
  messagePreview,
  messageTime,
  reactionChips,
  readReceiptLabel,
  splitMentions,
  voiceBars,
} from '../../utils/chat';

// ---------------------------------------------------------------------------
// One message inside the conversation.
//
// Renders every message type (text, image, video, file, voice, location,
// sticker, system), the reply quote, reactions, star/pin markers, delivery &
// read ticks, and the per-message action sheet (reply / react / copy /
// forward / star / pin / edit / delete / report).
//
// Purely presentational: every action is a callback so the workspace stays in
// charge of what is actually allowed.
// ---------------------------------------------------------------------------

function Tick({ status }) {
  if (status === 'none') return null;
  if (status === 'read') return <span className="chat-ticks chat-ticks--read" title="Read">✓✓</span>;
  if (status === 'delivered') return <span className="chat-ticks" title="Delivered">✓✓</span>;
  return <span className="chat-ticks chat-ticks--sent" title="Sent">✓</span>;
}

function VoicePlayer({ message, own }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const duration = Math.round((message.durationMs || 0) / 1000) || 1;

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  return (
    <div className={`chat-voice${own ? ' chat-voice--own' : ''}`}>
      <button
        type="button"
        className="chat-voice__play"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div className="chat-voice__body">
        <div
          className="chat-voice__bars"
          role="presentation"
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
            audio.currentTime = ratio * duration;
          }}
        >
          {voiceBars(message.id).map((height, i) => (
            <span
              key={i}
              className={`chat-voice__bar${i / voiceBars(message.id).length <= progress ? ' chat-voice__bar--played' : ''}`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <span className="chat-voice__time">{formatDuration(playing || progress > 0 ? elapsed : duration)}</span>
      </div>
      <audio
        ref={audioRef}
        src={message.mediaUrl}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setElapsed(0);
        }}
        onTimeUpdate={(e) => {
          const audio = e.currentTarget;
          setElapsed(audio.currentTime);
          setProgress(duration ? Math.min(1, audio.currentTime / duration) : 0);
        }}
      />
    </div>
  );
}

function LocationCard({ location, own }) {
  const label = location?.label || 'Shared location';
  const coords =
    location?.lat != null && location?.lng != null
      ? `${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}`
      : '';
  return (
    <a
      className={`chat-location${own ? ' chat-location--own' : ''}`}
      href={`https://www.google.com/maps?q=${location?.lat},${location?.lng}`}
      target="_blank"
      rel="noreferrer noopener"
    >
      <span className="chat-location__pin" aria-hidden="true">📍</span>
      <span className="chat-location__body">
        <strong>{label}</strong>
        {coords && <small>{coords} — open in Google Maps ↗</small>}
      </span>
    </a>
  );
}

function TextBody({ text, memberNames, searchTerm }) {
  const segments = splitMentions(text, memberNames);
  return (
    <>
      {segments.map((segment, i) =>
        segment.mention ? (
          <span key={i} className="chat-mention">{segment.text}</span>
        ) : (
          <span key={i}>
            {matchSegments(segment.text, searchTerm).map((part, j) =>
              part.match ? <mark key={j} className="chat-search-hit">{part.text}</mark> : part.text
            )}
          </span>
        )
      )}
    </>
  );
}

export default function MessageBubble({
  message,
  viewerId,
  otherIds = [],
  own,
  senderName = '',
  senderPhoto = '',
  isAdmin = false,
  showSender = false,
  highlight = false,
  searchTerm = '',
  memberNames = [],
  replyToMessage = null,
  canEdit = false,
  canDelete = false,
  canPin = false,
  canReport = false,
  onReply,
  onReact,
  onCopy,
  onForward,
  onStar,
  onPin,
  onEdit,
  onDelete,
  onReport,
  onJumpTo,
  onOpenImage,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef(null);

  if (!message) return null;

  if (message.type === MESSAGE_TYPES.SYSTEM) {
    return (
      <div id={`msg-${message.id}`} className="chat-system" data-message-id={message.id}>
        <span>{message.text}</span>
        <small>{messageTime(message.createdAt)}</small>
      </div>
    );
  }

  const sticker = message.type === MESSAGE_TYPES.STICKER;
  const ownMessage = Boolean(own);
  const status = deliveryStatus(message, viewerId, otherIds);
  const starred = (message.starredBy || []).includes(viewerId);
  const chips = reactionChips(message.reactions, viewerId);
  const hasMedia =
    message.type === MESSAGE_TYPES.IMAGE ||
    message.type === MESSAGE_TYPES.VIDEO ||
    message.type === MESSAGE_TYPES.VOICE ||
    message.type === MESSAGE_TYPES.LOCATION ||
    message.type === MESSAGE_TYPES.FILE;
  const quotedName = replyToMessage
    ? replyToMessage.senderId === viewerId
      ? 'You'
      : replyToMessage.senderName || 'Member'
    : '';
    message.type === MESSAGE_TYPES.IMAGE ||
    message.type === MESSAGE_TYPES.VIDEO ||
    message.type === MESSAGE_TYPES.VOICE ||
    message.type === MESSAGE_TYPES.LOCATION ||
    message.type === MESSAGE_TYPES.FILE;

  const handleCopy = () => {
    const payload = message.text || message.mediaName || message.mediaUrl || '';
    if (onCopy) onCopy(payload);
    setMenuOpen(false);
  };

  return (
    <div
      id={`msg-${message.id}`}
      data-message-id={message.id}
      className={[
        'chat-msg',
        ownMessage ? 'chat-msg--own' : 'chat-msg--other',
        showSender ? 'chat-msg--first' : 'chat-msg--follow',
        highlight ? 'chat-msg--highlight' : '',
        message.pending ? 'chat-msg--pending' : '',
        sticker ? 'chat-msg--sticker' : '',
      ].filter(Boolean).join(' ')}
    >
      {!ownMessage && (
        <div className="chat-msg__avatar">
          {showSender ? <Avatar src={senderPhoto} name={senderName} size="sm" /> : null}
        </div>
      )}

      <div className="chat-msg__content">
        {showSender && !ownMessage && (
          <div className="chat-msg__sender">
            <span className="chat-msg__sender-name">{senderName || 'Member'}</span>
            {isAdmin && <span className="chat-msg__admin-badge" title="Group admin">🛡 Admin</span>}
          </div>
        )}

        {message.deleted ? (
          <div className={`chat-bubble chat-bubble--deleted${ownMessage ? ' chat-bubble--own' : ''}`}>
            <span>🚫 This message was deleted</span>
          </div>
        ) : (
          <div className="chat-msg__row">
            <div
              className={[
                'chat-bubble',
                ownMessage ? 'chat-bubble--own' : '',
                hasMedia ? 'chat-bubble--media' : '',
              ].filter(Boolean).join(' ')}
            >
              {message.forwarded && (
                <div className="chat-bubble__forwarded">↪ Forwarded</div>
              )}

              {message.replyTo && (
                <button
                  type="button"
                  className="chat-bubble__quote"
                  onClick={() => onJumpTo && onJumpTo(message.replyTo)}
                  title="Jump to the original message"
                >
                  {replyToMessage ? (
                    <>
                      <span className="chat-bubble__quote-name">↩️ {quotedName}</span>
                      <span className="chat-bubble__quote-text">
                        {replyToMessage.deleted ? '🚫 Message deleted' : messagePreview(replyToMessage)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="chat-bubble__quote-name">↩️ Original message</span>
                      <span className="chat-bubble__quote-text">{message.replyPreview || 'View message'}</span>
                    </>
                  )}
                </button>
              )}

              {sticker && <div className="chat-sticker">{message.text}</div>}

              {message.type === MESSAGE_TYPES.IMAGE && message.mediaUrl && (
                <button
                  type="button"
                  className="chat-bubble__image-btn"
                  onClick={() => onOpenImage && onOpenImage(message.mediaUrl, message.text)}
                  aria-label="Open image"
                >
                  <Image src={message.mediaUrl} alt={message.text || 'Shared image'} />
                </button>
              )}

              {message.type === MESSAGE_TYPES.VIDEO && message.mediaUrl && (
                <video className="chat-bubble__video" src={message.mediaUrl} controls preload="metadata" />
              )}

              {message.type === MESSAGE_TYPES.VOICE && message.mediaUrl && (
                <VoicePlayer message={message} own={ownMessage} />
              )}

              {message.type === MESSAGE_TYPES.LOCATION && (
                <LocationCard location={message.location} own={ownMessage} />
              )}

              {message.type === MESSAGE_TYPES.FILE && message.mediaUrl && (
                <a
                  className={`chat-file${ownMessage ? ' chat-file--own' : ''}`}
                  href={message.mediaUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <span className="chat-file__icon" aria-hidden="true">📄</span>
                  <span className="chat-file__body">
                    <strong>{message.mediaName || 'Document'}</strong>
                    <small>{formatBytes(message.mediaSize || message.mediaBytes)}</small>
                  </span>
                  <span className="chat-file__download" aria-hidden="true">⬇</span>
                </a>
              )}

              {message.text && message.type !== MESSAGE_TYPES.STICKER && (
                <div className="chat-bubble__text">
                  <TextBody text={message.text} memberNames={memberNames} searchTerm={searchTerm} />
                </div>
              )}

              <div className="chat-bubble__meta">
                {starred && <span className="chat-bubble__flag" title="Starred message">★</span>}
                {message.pinned && <span className="chat-bubble__flag" title="Pinned message">📌</span>}
                {message.edited && <span className="chat-bubble__edited">edited</span>}
                <span className="chat-bubble__time">{messageTime(message.createdAt)}</span>
                {message.pending ? (
                  <span className="chat-ticks chat-ticks--pending" title="Sending…">🕓</span>
                ) : (
                  <Tick status={status} />
                )}
              </div>
            </div>

            <button
              ref={menuBtnRef}
              type="button"
              className="chat-msg__menu-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Message options"
              aria-expanded={menuOpen}
            >
              ⋮
            </button>
          </div>
        )}

        {chips.length > 0 && !message.deleted && (
          <div className={ownMessage ? 'chat-msg__reactions chat-msg__reactions--own' : 'chat-msg__reactions'}>
            {chips.map((chip) => (
              <button
                key={chip.emoji}
                type="button"
                className={`chat-reaction${chip.mine ? ' chat-reaction--mine' : ''}`}
                onClick={() => onReact && onReact(chip.emoji)}
                title={`${chip.count} ${chip.count === 1 ? 'reaction' : 'reactions'}`}
              >
                <span>{chip.emoji}</span>
                {chip.count > 1 && <small>{chip.count}</small>}
              </button>
            ))}
          </div>
        )}
      </div>

      <ChatMenu open={menuOpen} onClose={() => setMenuOpen(false)} anchorRef={menuBtnRef} width={230}>
        <ChatMenuTitle>React</ChatMenuTitle>
        <div className="chat-menu__reactions">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="chat-menu__reaction"
              onClick={() => {
                onReact && onReact(emoji);
                setMenuOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
        <ChatMenuDivider />
        <ChatMenuItem icon="↩️" label="Reply" onClick={() => { onReply && onReply(); setMenuOpen(false); }} />
        <ChatMenuItem icon="⏪" label="Forward" onClick={() => { onForward && onForward(message); setMenuOpen(false); }} />
        <ChatMenuItem icon="📋" label="Copy" onClick={handleCopy} disabled={!message.text && !message.mediaName && !message.mediaUrl} />
        <ChatMenuItem
          icon={starred ? '★' : '☆'}
          label={starred ? 'Unstar message' : 'Star message'}
          onClick={() => { onStar && onStar(!starred); setMenuOpen(false); }}
        />
        {canPin && (
          <ChatMenuItem
            icon="📌"
            label={message.pinned ? 'Unpin message' : 'Pin message'}
            onClick={() => { onPin && onPin(!message.pinned); setMenuOpen(false); }}
          />
        )}
        {canEdit && (
          <ChatMenuItem icon="✏️" label="Edit message" onClick={() => { onEdit && onEdit(); setMenuOpen(false); }} />
        )}
        <ChatMenuDivider />
        {canDelete && (
          <ChatMenuItem icon="🗑️" label="Delete" danger onClick={() => { onDelete && onDelete(); setMenuOpen(false); }} />
        )}
        {canReport && (
          <ChatMenuItem icon="🚩" label="Report message" danger onClick={() => { onReport && onReport(); setMenuOpen(false); }} />
        )}
      </ChatMenu>
    </div>
  );
}
