import { useRef, useState } from 'react';
import Avatar from '../Avatar';
import ChatMenu, { ChatMenuDivider, ChatMenuItem, ChatMenuTitle } from './ChatMenu';
import { messagePreview } from '../../utils/chat';

// ---------------------------------------------------------------------------
// The fixed chat header:
//
//   ☰ | avatar | Name + status | 🔔 | 📞 | 📹 | ⋮
//
// It stays visible while messages scroll underneath it in the message list.
// The ☰ button opens the conversations drawer (quick switch between threads),
// the avatar/name opens the conversation/group info panel, and ⋮ opens the
// message settings menu supplied by the workspace.
// ---------------------------------------------------------------------------

export default function ChatHeader({
  title,
  subtitle,
  typingLabel = '',
  avatarSrc,
  muted = false,
  pinnedMessage = null,
  menuItems = [],
  onOpenMenuDrawer,
  onOpenInfo,
  onToggleMute,
  onStartCall,
  onUnpin,
  onJumpToMessage,
}) {
  const moreRef = useRef(null);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header className="chat-header">
      <button
        type="button"
        className="chat-header__icon chat-header__icon--menu"
        onClick={onOpenMenuDrawer}
        aria-label="Open conversations menu"
      >
        <span className="chat-header__burger" aria-hidden="true">
          <span /><span /><span />
        </span>
      </button>

      <button type="button" className="chat-header__identity" onClick={onOpenInfo} title="View details">
        <Avatar src={avatarSrc} name={title} size="sm" />
        <span className="chat-header__titles">
          <span className="chat-header__title">{title}</span>
          <span className={`chat-header__status${typingLabel ? ' chat-header__status--typing' : ''}`}>
            {typingLabel ? `${typingLabel}…` : subtitle}
          </span>
        </span>
      </button>

      <div className="chat-header__actions">
        <button
          type="button"
          className={`chat-header__icon${muted ? ' chat-header__icon--active' : ''}`}
          onClick={onToggleMute}
          aria-pressed={muted}
          aria-label={muted ? 'Unmute notifications' : 'Mute notifications'}
          title={muted ? 'Unmute notifications' : 'Mute notifications'}
        >
          {muted ? '🔕' : '🔔'}
        </button>
        <button
          type="button"
          className="chat-header__icon"
          onClick={() => onStartCall && onStartCall(false)}
          aria-label="Voice call"
          title="Voice call"
        >
          📞
        </button>
        <button
          type="button"
          className="chat-header__icon"
          onClick={() => onStartCall && onStartCall(true)}
          aria-label="Video call"
          title="Video call"
        >
          📹
        </button>
        <button
          ref={moreRef}
          type="button"
          className="chat-header__icon"
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More options"
          aria-expanded={moreOpen}
          title="More options"
        >
          ⋮
        </button>
      </div>

      <ChatMenu open={moreOpen} onClose={() => setMoreOpen(false)} anchorRef={moreRef} width={250}>
        <ChatMenuTitle>Message settings</ChatMenuTitle>
        {menuItems.map((item, index) =>
          item.divider ? (
            <ChatMenuDivider key={`divider-${index}`} />
          ) : (
            <ChatMenuItem
              key={item.label}
              icon={item.icon}
              label={item.label}
              hint={item.hint}
              danger={item.danger}
              disabled={item.disabled}
              onClick={() => {
                setMoreOpen(false);
                item.onClick && item.onClick();
              }}
            />
          )
        )}
      </ChatMenu>

      {pinnedMessage && !pinnedMessage.deleted && (
        <button
          type="button"
          className="chat-pinned"
          onClick={() => onJumpToMessage && onJumpToMessage(pinnedMessage.id)}
          title="Jump to pinned message"
        >
          <span className="chat-pinned__icon" aria-hidden="true">📌</span>
          <span className="chat-pinned__preview">
            <small>Pinned</small>
            {messagePreview(pinnedMessage)}
          </span>
          {onUnpin && (
            <span
              className="chat-pinned__unpin"
              role="button"
              tabIndex={-1}
              aria-label="Unpin message"
              onClick={(e) => {
                e.stopPropagation();
                onUnpin();
              }}
            >
              ✕
            </span>
          )}
        </button>
      )}
    </header>
  );
}
