import { useEffect, useMemo, useRef, useState } from 'react';
import EmojiPicker from './EmojiPicker';
import useVoiceRecorder from './useVoiceRecorder';
import { formatDuration, messagePreview } from '../../utils/chat';

// ---------------------------------------------------------------------------
// The fixed composer at the bottom of the chat.
//
//   😊  📎  [ Type a message… ]            🎤   ← idle
//   😊  📎  [ Type a message… ]            ➤   ← while typing
//   🔒   ● REC 0:42   🗑️   ➤                  ← recording
//
// Also hosts the reply preview strip (above the input), the edit strip, the
// @mention suggester (groups) and the attachment menu. The composer never
// disappears when the message list grows — the workspace fixes it in place.
// ---------------------------------------------------------------------------

const ATTACH_ITEMS = [
  { id: 'image', icon: '🖼️', label: 'Photo' },
  { id: 'video', icon: '🎥', label: 'Video' },
  { id: 'camera', icon: '📷', label: 'Camera' },
  { id: 'file', icon: '📄', label: 'Document' },
  { id: 'location', icon: '📍', label: 'Location' },
];

export default function ChatComposer({
  mode = 'direct',
  placeholder = 'Type a message…',
  disabled = false,
  disabledReason = '',
  replyTo = null,
  editing = null,
  mentionCandidates = [],
  sending = false,
  onSendText,
  onEditSave,
  onSendVoice,
  onAttachFile,
  onShareLocation,
  onOpenCamera,
  onCancelReply,
  onCancelEdit,
  onTypingChange,
  onNotify,
}) {
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null); // {token, start}
  const inputRef = useRef(null);
  const attachRef = useRef(null);
  const emojiRef = useRef(null);
  const attachMenuRef = useRef(null);
  const typingTimer = useRef(null);
  const typingActive = useRef(false);

  const recorder = useVoiceRecorder({
    onComplete: (blob, durationMs) => onSendVoice && onSendVoice(blob, durationMs),
    onError: (message) => onNotify && onNotify(message, 'error'),
  });

  // Editing another message swaps the draft into the input.
  useEffect(() => {
    if (editing) {
      setText(editing.text || '');
      inputRef.current?.focus();
    }
  }, [editing]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  // Auto-grow the textarea up to ~5 lines.
  const resizeInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  };
  useEffect(resizeInput, [text]);

  const notifyTyping = (value) => {
    if (!onTypingChange) return;
    if (value && !typingActive.current) {
      typingActive.current = true;
      onTypingChange(true);
    }
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      typingActive.current = false;
      onTypingChange(false);
    }, 4000);
  };

  const flushTyping = () => {
    window.clearTimeout(typingTimer.current);
    if (typingActive.current) {
      typingActive.current = false;
      onTypingChange && onTypingChange(false);
    }
  };

  const handleChange = (event) => {
    setText(event.target.value);
    notifyTyping(true);
    // @mention detection for groups.
    if (mode === 'group' && mentionCandidates.length) {
      const caret = event.target.selectionStart ?? event.target.value.length;
      const before = event.target.value.slice(0, caret);
      const match = before.match(/@([\p{L}\p{N}_.-]*)$/u);
      setMentionQuery(match ? { token: match[1], start: caret - match[0].length } : null);
    }
  };

  const mentionMatches = useMemo(() => {
    if (!mentionQuery) return [];
    const needle = mentionQuery.token.toLowerCase();
    return mentionCandidates
      .filter((m) => m.name && m.name.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [mentionQuery, mentionCandidates]);

  const applyMention = (candidate) => {
    const el = inputRef.current;
    if (!el || !mentionQuery) return;
    const caret = el.selectionStart ?? text.length;
    const insert = `@${candidate.name} `;
    const next =
      text.slice(0, mentionQuery.start) + insert + text.slice(caret);
    setText(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = mentionQuery.start + insert.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || sending) return;
    flushTyping();
    if (editing) {
      onEditSave && onEditSave(editing, trimmed);
    } else {
      onSendText && onSendText(trimmed);
    }
    setText('');
    setMentionQuery(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    if (!el) {
      setText((t) => t + emoji);
      return;
    }
    const caret = el.selectionStart ?? text.length;
    const next = text.slice(0, caret) + emoji + text.slice(el.selectionEnd ?? caret);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = caret + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleFileChange = (event, kind) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow picking the same file twice
    if (file && onAttachFile) onAttachFile(file, kind);
  };

  const micPointerDown = (event) => {
    if (disabled || !recorder.supported) {
      if (!recorder.supported) onNotify && onNotify('Voice recording is not supported in this browser.', 'info');
      return;
    }
    event.preventDefault();
    recorder.begin();
  };

  const micPointerUp = () => {
    if (!recorder.locked && recorder.state === 'recording') recorder.pause();
  };

  const recording = recorder.state !== 'idle';

  return (
    <footer className={`chat-composer${disabled ? ' chat-composer--disabled' : ''}`}>
      {replyTo && !editing && (
        <div className="chat-context-strip">
          <span className="chat-context-strip__icon" aria-hidden="true">↩️</span>
          <span className="chat-context-strip__body">
            <small>Replying to {replyTo.name}</small>
            {replyTo.preview}
          </span>
          <button type="button" className="chat-context-strip__close" onClick={onCancelReply} aria-label="Cancel reply">
            ✕
          </button>
        </div>
      )}

      {editing && (
        <div className="chat-context-strip chat-context-strip--edit">
          <span className="chat-context-strip__icon" aria-hidden="true">✏️</span>
          <span className="chat-context-strip__body">
            <small>Editing message</small>
            {messagePreview(editing)}
          </span>
          <button type="button" className="chat-context-strip__close" onClick={() => { onCancelEdit && onCancelEdit(); setText(''); }} aria-label="Cancel editing">
            ✕
          </button>
        </div>
      )}

      {recording ? (
        <div className="chat-recorder" role="status" aria-label={`Recording voice message, ${formatDuration(Math.round(recorder.elapsedMs / 1000))}`}>
          <button
            type="button"
            className={`chat-recorder__lock${recorder.locked ? ' chat-recorder__lock--on' : ''}`}
            onClick={() => recorder.setLocked(!recorder.locked)}
            aria-pressed={recorder.locked}
            title={recorder.locked ? 'Recording locked — tap to unlock' : 'Lock recording (hands-free)'}
            aria-label="Lock recording"
          >
            🔒
          </button>
          <span className={`chat-recorder__dot${recorder.state === 'recording' ? ' chat-recorder__dot--live' : ''}`} aria-hidden="true" />
          <span className="chat-recorder__timer">
            {recorder.state === 'recording' ? 'REC' : 'PAUSED'} {formatDuration(Math.round(recorder.elapsedMs / 1000))}
          </span>
          <button
            type="button"
            className="chat-recorder__btn chat-recorder__btn--resume"
            onClick={() => (recorder.state === 'paused' ? recorder.resume() : recorder.pause())}
            aria-label={recorder.state === 'paused' ? 'Resume recording' : 'Pause recording'}
          >
            {recorder.state === 'paused' ? '▶' : '⏸'}
          </button>
          <button
            type="button"
            className="chat-recorder__btn chat-recorder__btn--trash"
            onClick={recorder.discard}
            aria-label="Discard recording"
            title="Discard"
          >
            🗑️
          </button>
          <button
            type="button"
            className="chat-recorder__btn chat-recorder__btn--send"
            onClick={recorder.finish}
            aria-label="Send voice message"
            title="Send"
          >
            ➤
          </button>
        </div>
      ) : (
        <div className="chat-composer__row">
          <div className="chat-composer__tools">
            <div className="chat-composer__tool-wrap" ref={emojiRef}>
              <button
                type="button"
                className="chat-composer__icon"
                onClick={() => { setEmojiOpen((v) => !v); setAttachOpen(false); }}
                aria-label="Insert emoji"
                aria-expanded={emojiOpen}
                disabled={disabled}
              >
                😊
              </button>
              {emojiOpen && (
                <div className="chat-composer__popover">
                  <EmojiPicker
                    onPick={insertEmoji}
                    onSticker={(sticker) => {
                      setEmojiOpen(false);
                      onSendText && onSendText('', { type: 'sticker', text: sticker });
                    }}
                    onClose={() => setEmojiOpen(false)}
                  />
                </div>
              )}
            </div>

            <div className="chat-composer__tool-wrap" ref={attachRef}>
              <button
                ref={attachMenuRef}
                type="button"
                className="chat-composer__icon"
                onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }}
                aria-label="Attach"
                aria-expanded={attachOpen}
                disabled={disabled}
              >
                📎
              </button>
              {attachOpen && (
                <div className="chat-composer__popover chat-composer__popover--menu">
                  <div className="chat-attach-menu" role="menu">
                    {ATTACH_ITEMS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="chat-attach-menu__item"
                        role="menuitem"
                        onClick={() => {
                          setAttachOpen(false);
                          if (item.id === 'location') onShareLocation && onShareLocation();
                          else if (item.id === 'camera') onOpenCamera && onOpenCamera();
                        }}
                      >
                        {item.id === 'image' && (
                          <label className="chat-attach-menu__label">
                            <span aria-hidden="true">{item.icon}</span> {item.label}
                            <input type="file" accept="image/*" hidden onChange={(e) => handleFileChange(e, 'image')} />
                          </label>
                        )}
                        {item.id === 'video' && (
                          <label className="chat-attach-menu__label">
                            <span aria-hidden="true">{item.icon}</span> {item.label}
                            <input type="file" accept="video/*" hidden onChange={(e) => handleFileChange(e, 'video')} />
                          </label>
                        )}
                        {item.id === 'file' && (
                          <label className="chat-attach-menu__label">
                            <span aria-hidden="true">{item.icon}</span> {item.label}
                            <input type="file" hidden onChange={(e) => handleFileChange(e, 'file')} />
                          </label>
                        )}
                        {(item.id === 'location' || item.id === 'camera') && (
                          <>
                            <span aria-hidden="true">{item.icon}</span> {item.label}
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="chat-composer__input-wrap">
            <textarea
              ref={inputRef}
              className="chat-composer__input"
              rows={1}
              value={text}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (mentionQuery && mentionMatches.length && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab'].includes(e.key)) {
                  if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    applyMention(mentionMatches[0]);
                  }
                  return;
                }
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === 'Escape') {
                  if (editing) { onCancelEdit && onCancelEdit(); setText(''); }
                  else if (replyTo) onCancelReply && onCancelReply();
                }
              }}
              onBlur={() => setMentionQuery(null)}
              placeholder={disabled ? (disabledReason || 'Messages are unavailable') : placeholder}
              disabled={disabled}
              aria-label="Message input"
            />

            {mentionQuery && mentionMatches.length > 0 && (
              <div className="chat-mentions" role="listbox" aria-label="Mention suggestions">
                {mentionMatches.map((candidate) => (
                  <button
                    key={candidate.uid}
                    type="button"
                    className="chat-mentions__item"
                    role="option"
                    aria-selected="false"
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep input focus
                      applyMention(candidate);
                    }}
                  >
                    <span className="chat-mentions__avatar">{(candidate.name || '?')[0]?.toUpperCase()}</span>
                    <span>{candidate.name}</span>
                    {candidate.isAdmin && <small className="chat-mentions__admin">Admin</small>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {text.trim() || editing ? (
            <button
              type="button"
              className="chat-composer__send"
              onClick={submit}
              disabled={disabled || sending || !text.trim()}
              aria-label={editing ? 'Save edit' : 'Send message'}
            >
              ➤
            </button>
          ) : (
            <button
              type="button"
              className="chat-composer__send chat-composer__send--mic"
              onPointerDown={micPointerDown}
              onPointerUp={micPointerUp}
              onPointerLeave={micPointerUp}
              disabled={disabled}
              aria-label="Hold to record a voice message"
              title="Hold to record"
            >
              🎤
            </button>
          )}
        </div>
      )}

      {disabled && disabledReason && !recording && (
        <p className="chat-composer__disabled-note">{disabledReason}</p>
      )}
    </footer>
  );
}
