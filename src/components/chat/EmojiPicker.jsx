import { useEffect, useRef, useState } from 'react';
import { EMOJI_GROUPS, STICKERS } from '../../utils/chat';

// ---------------------------------------------------------------------------
// Emoji + sticker picker for the composer. Pure client-side data — no external
// GIF service is wired in, so the sticker tab sends large "sticker" emoji that
// render without a chat bubble. Emoji insert at the caret; stickers send
// immediately via onSticker.
// ---------------------------------------------------------------------------

const RECENT_KEY = 'seedwel.chat.recentEmoji';

function loadRecent() {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 16) : [];
  } catch (e) {
    return [];
  }
}

export default function EmojiPicker({ onPick, onSticker, onClose }) {
  const [tab, setTab] = useState('smileys');
  const [recent, setRecent] = useState([]);
  const rootRef = useRef(null);

  useEffect(() => {
    setRecent(loadRecent());
  }, []);

  useEffect(() => {
    const handlePointer = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) onClose();
    };
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const rememberRecent = (emoji) => {
    const next = [emoji, ...recent.filter((e) => e !== emoji)].slice(0, 16);
    setRecent(next);
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch (e) {
      // Private browsing — recents are best-effort.
    }
  };

  const handleEmoji = (emoji) => {
    rememberRecent(emoji);
    onPick(emoji);
  };

  const activeGroup = EMOJI_GROUPS.find((g) => g.id === tab);

  return (
    <div className="emoji-picker" ref={rootRef} role="dialog" aria-label="Emoji and stickers">
      <div className="emoji-picker__tabs" role="tablist">
        {recent.length > 0 && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'recent'}
            className={`emoji-picker__tab${tab === 'recent' ? ' emoji-picker__tab--active' : ''}`}
            onClick={() => setTab('recent')}
          >
            <span aria-hidden="true">🕘</span>
          </button>
        )}
        {EMOJI_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={tab === group.id}
            title={group.name}
            className={`emoji-picker__tab${tab === group.id ? ' emoji-picker__tab--active' : ''}`}
            onClick={() => setTab(group.id)}
          >
            <span aria-hidden="true">{group.label}</span>
          </button>
        ))}
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'stickers'}
          title="Stickers"
          className={`emoji-picker__tab${tab === 'stickers' ? ' emoji-picker__tab--active' : ''}`}
          onClick={() => setTab('stickers')}
        >
          <span aria-hidden="true">🎬</span>
        </button>
      </div>

      {tab === 'recent' && (
        <div className="emoji-picker__grid">
          {recent.map((emoji) => (
            <button key={emoji} type="button" className="emoji-picker__emoji" onClick={() => handleEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {activeGroup && (
        <div className="emoji-picker__grid">
          {activeGroup.emoji.map((emoji) => (
            <button key={emoji} type="button" className="emoji-picker__emoji" onClick={() => handleEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {tab === 'stickers' && (
        <div className="emoji-picker__grid emoji-picker__grid--stickers">
          {STICKERS.map((sticker) => (
            <button
              key={sticker}
              type="button"
              className="emoji-picker__sticker"
              onClick={() => onSticker(sticker)}
              aria-label={`Send ${sticker} sticker`}
            >
              {sticker}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
