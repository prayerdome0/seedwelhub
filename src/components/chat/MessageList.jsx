import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import MessageBubble from './MessageBubble';
import {
  dayKey,
  findUnreadDividerIndex,
  groupMessagesByDay,
} from '../../utils/chat';

// ---------------------------------------------------------------------------
// The message container — the ONLY vertically scrollable area in the whole
// messaging workspace.
//
// Scroll policy (a strict requirement for Seedwel Hub chat):
//  - the page body never scrolls; all scrolling happens on this element;
//  - `scrollToMessage` positions this container's scrollTop directly (never
//    scrollIntoView, which would walk up to the page and drag it along);
//  - opening a thread lands instantly at the first unread message when there
//    is one, otherwise at the latest message — never a slow glide through
//    history, and never a silent "everything is read" when it is not;
//  - when the viewer is at the bottom, new messages keep it pinned there;
//  - when the viewer is reading older messages, the list does NOT jump —
//    an onNewMessages callback lets the workspace show a "↓ N new messages"
//    pill instead.
// ---------------------------------------------------------------------------

const BOTTOM_THRESHOLD = 90; // px from the bottom counts as "at the bottom"

const MessageList = forwardRef(function MessageList(
  {
    messages,
    viewerId,
    otherIds = [],
    memberNames = [],
    membersById = null,
    mode = 'direct',
    searchTerm = '',
    replyToMessage,
    pendingMessages = [],
    typingLabel = '',
    loading = false,
    error = null,
    onRetry,
    emptyHint = 'No messages yet. Say hello!',
    canPin = true,
    onReply,
    onReact,
    onCopy,
    onForward,
    onStar,
    onPin,
    onEdit,
    onDelete,
    onReport,
    onOpenImage,
    onAtBottomChange,
    onNewMessages,
    onMessageVisible,
  },
  ref
) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const atBottomRef = useRef(true);
  const seenIdsRef = useRef(new Set());
  const placedRef = useRef(false); // initial placement done (with content)
  const prevCountRef = useRef(0);
  const [highlightId, setHighlightId] = useState(null);
  const highlightTimer = useRef(null);

  // ---- public scroll API ----------------------------------------------------
  const scrollToBottom = useCallback((behavior = 'auto') => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const isAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_THRESHOLD;
  }, []);

  /**
   * Jumps to a message INSIDE this container only. The position is computed
   * from getBoundingClientRect against the container — the page itself cannot
   * move, and offsetTop is deliberately avoided (the container is not the
   * offsetParent, so offsetTop would be measured from behind the fixed
   * header and every jump would land off-target).
   */
  const scrollToMessage = useCallback((messageId, behavior = 'smooth', align = 'center') => {
    const el = scrollRef.current;
    if (!el || !messageId) return false;
    const target = el.querySelector(`[data-message-id="${CSS.escape(String(messageId))}"]`);
    if (!target) return false;
    const topInContainer =
      target.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    const centered = topInContainer - el.clientHeight / 2 + target.clientHeight / 2;
    const atTop = topInContainer - 12;
    const top = align === 'start' ? atTop : centered;
    el.scrollTo({ top: Math.max(0, top), behavior });
    setHighlightId(String(messageId));
    window.clearTimeout(highlightTimer.current);
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 1800);
    return true;
  }, []);

  useImperativeHandle(ref, () => ({ scrollToBottom, scrollToMessage, isAtBottom }), [
    scrollToBottom,
    scrollToMessage,
    isAtBottom,
  ]);

  // ---- scroll tracking ------------------------------------------------------
  const handleScroll = useCallback(() => {
    const bottom = isAtBottom();
    if (bottom !== atBottomRef.current) {
      atBottomRef.current = bottom;
      onAtBottomChange && onAtBottomChange(bottom);
    }
  }, [isAtBottom, onAtBottomChange]);

  // ---- arrivals: pin to bottom, or count new messages ----------------------
  const allMessages = useMemo(
    () => [...(messages || []), ...(pendingMessages || [])],
    [messages, pendingMessages]
  );

  useEffect(() => {
    const count = allMessages.length;
    const grew = count > prevCountRef.current;
    const freshIds = [];

    if (grew) {
      for (const m of allMessages) {
        if (!seenIdsRef.current.has(m.id)) freshIds.push(m);
      }
    }
    for (const m of allMessages) seenIdsRef.current.add(m.id);

    // ---- initial placement -------------------------------------------------
    // Wait for real content (the first render usually happens while messages
    // are still loading), then land INSTANTLY — at the first unread message
    // when the unread divider applies, otherwise at the latest message.
    // Where the viewer lands is reported back through onAtBottomChange so the
    // workspace only marks read receipts once the thread is genuinely at the
    // bottom (opening on the unread divider must not mark it all as read).
    if (!placedRef.current) {
      if (count === 0) {
        prevCountRef.current = count;
        return;
      }
      placedRef.current = true;
      const unreadIndex = findUnreadDividerIndex(allMessages, viewerId);
      const dividerId = unreadIndex >= 0 ? allMessages[unreadIndex]?.id : null;
      requestAnimationFrame(() => {
        if (dividerId) {
          scrollToMessage(dividerId, 'auto', 'start');
        } else {
          scrollToBottom('auto');
        }
        // Landed at the unread divider ⇒ there are unread messages below ⇒
        // by definition not at the bottom. Otherwise confirm with the real
        // scroll geometry.
        const bottom = dividerId ? false : isAtBottom();
        atBottomRef.current = bottom;
        onAtBottomChange && onAtBottomChange(bottom);
      });
      prevCountRef.current = count;
      return;
    }

    if (grew) {
      const incoming = freshIds.filter((m) => m.senderId !== viewerId);
      if (atBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom('smooth'));
        if (incoming.length) onMessageVisible && onMessageVisible(incoming);
      } else if (freshIds.length) {
        onNewMessages && onNewMessages(freshIds.length, incoming.length);
      }
    }
    prevCountRef.current = count;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMessages]);

  // ---- unread divider & day groups -----------------------------------------
  const unreadIndex = useMemo(
    () => findUnreadDividerIndex(allMessages, viewerId),
    [allMessages, viewerId]
  );
  const dayGroups = useMemo(() => groupMessagesByDay(allMessages), [allMessages]);
  const unreadId = unreadIndex >= 0 ? allMessages[unreadIndex]?.id : null;
  const indexById = useMemo(() => {
    const map = new Map();
    allMessages.forEach((m, i) => map.set(m.id, i));
    return map;
  }, [allMessages]);

  const renderBubble = (message) => {
    const index = indexById.get(message.id);
    const prev = index > 0 ? allMessages[index - 1] : null;
    const own = message.senderId === viewerId;
    const senderMember = membersById ? membersById[message.senderId] : null;
    const senderName =
      message.senderName ||
      (mode === 'direct' ? (own ? 'You' : '') : senderMember?.name || senderMember?.displayName || '');
    const showSender =
      message.type !== 'system' &&
      (!prev ||
        prev.senderId !== message.senderId ||
        prev.type === 'system' ||
        dayKey(prev.createdAt) !== dayKey(message.createdAt));

    return (
      <MessageBubble
        key={message.id}
        message={message}
        viewerId={viewerId}
        otherIds={otherIds}
        own={own}
        senderName={senderName}
        senderPhoto={senderMember?.photo || ''}
        isAdmin={Boolean(senderMember?.isAdmin)}
        showSender={Boolean(showSender)}
        highlight={highlightId === String(message.id)}
        searchTerm={searchTerm}
        memberNames={memberNames}
        replyToMessage={message.replyTo ? replyToMessage(message.replyTo) : null}
        canEdit={own && !message.deleted && message.type === 'text' && !message.pending}
        canDelete={own && !message.deleted && !message.pending}
        canPin={canPin && !message.deleted && !message.pending}
        canReport={!own && !message.deleted && !message.pending}
        onReply={() => onReply && onReply(message)}
        onReact={(emoji) => onReact && onReact(message, emoji)}
        onCopy={(payload) => onCopy && onCopy(payload)}
        onForward={() => onForward && onForward(message)}
        onStar={(starred) => onStar && onStar(message, starred)}
        onPin={(pinned) => onPin && onPin(message, pinned)}
        onEdit={() => onEdit && onEdit(message)}
        onDelete={() => onDelete && onDelete(message)}
        onReport={() => onReport && onReport(message)}
        onJumpTo={(id) => scrollToMessage(id)}
        onOpenImage={onOpenImage}
      />
    );
  };

  return (
    <div
      ref={scrollRef}
      className="chat-body"
      onScroll={handleScroll}
      role="log"
      aria-live="polite"
      aria-label="Messages"
      tabIndex={0}
    >
      {loading && allMessages.length === 0 && (
        <div className="chat-body__loading">Loading messages…</div>
      )}

      {!loading && error && allMessages.length === 0 && (
        <div className="chat-body__error">
          <p>{error}</p>
          {onRetry && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      )}

      {!loading && !error && allMessages.length === 0 && (
        <div className="chat-body__empty">
          <span className="chat-body__empty-emoji" aria-hidden="true">💬</span>
          <p>{emptyHint}</p>
        </div>
      )}

      {dayGroups.map((group) => (
        <div key={group.key} className="chat-day-group">
          <div className="chat-date-divider" role="separator">
            <span>{group.label}</span>
          </div>
          {group.messages.map((message) => (
            <div key={message.id} className="chat-body__slot">
              {unreadId === message.id && (
                <div className="chat-unread-divider" aria-label="Unread messages below">
                  <span>New messages</span>
                </div>
              )}
              {renderBubble(message)}
            </div>
          ))}
        </div>
      ))}

      {typingLabel && (
        <div className="chat-typing" aria-live="polite">
          <span className="chat-typing__dots" aria-hidden="true">
            <i /><i /><i />
          </span>
          <span className="chat-typing__label">{typingLabel}</span>
        </div>
      )}

      <div ref={bottomRef} aria-hidden="true" />
    </div>
  );
});

export default MessageList;
