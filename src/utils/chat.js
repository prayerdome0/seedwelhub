// ---------------------------------------------------------------------------
// Pure helpers for the Seedwel Hub messaging workspace.
//
// No Firebase, no React — everything here is deterministic and covered by the
// verification suites (scripts/verify-messaging.mjs). The UI keeps its logic in
// these functions so the chat behaves identically in direct chats and groups.
// ---------------------------------------------------------------------------

import { timestampMillis } from './format';

export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
  FILE: 'file',
  VOICE: 'voice',
  LOCATION: 'location',
  STICKER: 'sticker',
  SYSTEM: 'system',
};

// Emoji shown next to each message type in previews, quotes and the inbox.
const TYPE_PREVIEWS = {
  [MESSAGE_TYPES.IMAGE]: '📷 Photo',
  [MESSAGE_TYPES.VIDEO]: '🎥 Video',
  [MESSAGE_TYPES.FILE]: '📎 File',
  [MESSAGE_TYPES.VOICE]: '🎤 Voice message',
  [MESSAGE_TYPES.LOCATION]: '📍 Location',
  [MESSAGE_TYPES.STICKER]: '🎬 Sticker',
  [MESSAGE_TYPES.SYSTEM]: 'ℹ️',
};

/** One-line preview of a message for quotes, pinned banners and the inbox. */
export function messagePreview(message) {
  if (!message) return '';
  if (message.deleted) return '🚫 Message deleted';
  const base = TYPE_PREVIEWS[message.type];
  if (message.type === MESSAGE_TYPES.FILE && message.mediaName) {
    return `📎 ${message.mediaName}`;
  }
  const text = (message.text || '').trim();
  if (base && text) return `${base} ${text}`;
  if (base) return base;
  return text || 'Message';
}

// ---------------------------------------------------------------------------
// Dates — separators between conversation days.
// ---------------------------------------------------------------------------

function toLocalDate(value) {
  const ms = timestampMillis(value);
  if (!ms || Number.isNaN(ms)) return null;
  return new Date(ms);
}

/** Stable local-day key ("2026-09-03") so messages group by calendar day. */
export function dayKey(value) {
  const date = toLocalDate(value);
  if (!date) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Human label for a day separator: Today / Yesterday / 3 Sep 2026. */
export function dayLabel(value, now = new Date()) {
  const date = toLocalDate(value);
  if (!date) return '';
  const sameDay = (a, b) => dayKeyOf(a) === dayKeyOf(b);
  const dayKeyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  if (sameDay(date, now)) return 'Today';
  const yesterday = new Date(now.getTime() - 86400000);
  if (sameDay(date, yesterday)) return 'Yesterday';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

/** Splits an ordered message list into day groups for the message list. */
export function groupMessagesByDay(messages, now = new Date()) {
  const groups = [];
  for (const message of messages) {
    const key = dayKey(message.createdAt) || 'unknown';
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(message);
    } else {
      groups.push({ key, label: dayLabel(message.createdAt, now), messages: [message] });
    }
  }
  return groups;
}

/**
 * Index of the first message the "unread messages" divider should sit above.
 *
 * WhatsApp-style behaviour: the divider only appears when NEW unread messages
 * follow messages that were already read. A brand-new conversation (nothing
 * read yet) shows no divider at all.
 */
export function findUnreadDividerIndex(messages, viewerId) {
  if (!viewerId || !messages?.length) return -1;
  let firstUnread = -1;
  let hasReadEarlier = false;
  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i];
    const read = (m.readBy || []).includes(viewerId);
    const incoming = m.senderId !== viewerId;
    if (read) hasReadEarlier = true;
    if (incoming && !read && firstUnread === -1) firstUnread = i;
  }
  if (firstUnread === -1 || !hasReadEarlier) return -1;
  return firstUnread;
}

// ---------------------------------------------------------------------------
// Delivery status & read receipts.
// ---------------------------------------------------------------------------

/**
 * Status of the viewer's OWN message:
 *   'sent'      — saved, not yet fetched by anyone else (single tick)
 *   'delivered' — fetched by at least one other participant (double tick)
 *   'read'      — opened by at least one other participant (blue double tick)
 *   'none'      — not the viewer's message (nothing to show)
 */
export function deliveryStatus(message, viewerId, otherParticipantIds = []) {
  if (!message || !viewerId || message.senderId !== viewerId) return 'none';
  if (message.deleted) return 'none';
  const others = otherParticipantIds.filter(Boolean);
  if (!others.length) return 'sent';
  if (others.some((id) => (message.readBy || []).includes(id))) return 'read';
  if (others.some((id) => (message.deliveredTo || []).includes(id))) return 'delivered';
  return 'sent';
}

/** "Read by 3 of 8" tooltip text for group receipts. */
export function readReceiptLabel(message, viewerId, otherParticipantIds = []) {
  const others = otherParticipantIds.filter(Boolean);
  const readCount = others.filter((id) => (message.readBy || []).includes(id)).length;
  const deliveredCount = others.filter((id) => (message.deliveredTo || []).includes(id)).length;
  if (readCount > 0) return `Read by ${readCount} of ${others.length}`;
  if (deliveredCount > 0) return `Delivered to ${deliveredCount} of ${others.length}`;
  return 'Sent';
}

// ---------------------------------------------------------------------------
// @mentions
// ---------------------------------------------------------------------------

/** Extracts @mentioned names (case-insensitive) from a message body. */
export function mentionedNames(text) {
  if (!text) return [];
  const matches = String(text).match(/@[\p{L}\p{N}_.-]+/gu) || [];
  return matches.map((m) => m.slice(1));
}

/** True when the message @mentions one of `names`. */
export function mentionsUser(text, names = []) {
  const lower = (names || []).map((n) => String(n || '').trim().toLowerCase()).filter(Boolean);
  if (!lower.length) return false;
  return mentionedNames(text).some((m) => lower.includes(m.toLowerCase()));
}

/** Splits text into segments so @mentions can be highlighted while rendering. */
export function splitMentions(text, memberNames = []) {
  const names = (memberNames || [])
    .map((n) => String(n || '').trim())
    .filter(Boolean)
    .map(escapeRegExp);
  if (!text || !names.length) return [{ text: text || '', mention: false }];
  // Alternation of literal @names; the lookahead rejects longer handles
  // (@Bob must not match inside @Bobby).
  const pattern = new RegExp(`(@(?:${names.join('|')}))(?![\\p{L}\\p{N}_.-])`, 'giu');
  const segments = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > last) segments.push({ text: text.slice(last, start), mention: false });
    segments.push({ text: match[0], mention: true });
    last = start + match[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), mention: false });
  return segments.length ? segments : [{ text, mention: false }];
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Case-insensitive search across message text and file names. */
export function searchMessages(messages, term) {
  const needle = String(term || '').trim().toLowerCase();
  if (!needle) return [];
  return (messages || []).filter((m) => {
    if (m.deleted) return false;
    return (
      (m.text || '').toLowerCase().includes(needle) ||
      (m.mediaName || '').toLowerCase().includes(needle)
    );
  });
}

/** Wraps matched substrings in <mark>-ready segments for a search result row. */
export function matchSegments(text, term) {
  const needle = String(term || '').trim().toLowerCase();
  if (!needle || !text) return [{ text: text || '' }];
  const segments = [];
  let last = 0;
  let index = text.toLowerCase().indexOf(needle);
  while (index !== -1) {
    if (index > last) segments.push({ text: text.slice(last, index) });
    segments.push({ text: text.slice(index, index + needle.length), match: true });
    last = index + needle.length;
    index = text.toLowerCase().indexOf(needle, last);
  }
  if (last < text.length) segments.push({ text: text.slice(last) });
  return segments;
}

// ---------------------------------------------------------------------------
// Reactions
// ---------------------------------------------------------------------------

/**
 * Reactions live on the message as `{ emoji: [uid, …] }`. Toggling returns the
 * updated map (or the same map when nothing changed) — the service persists it.
 */
export function toggleReactionMap(reactions = {}, viewerId, emoji) {
  if (!viewerId || !emoji) return reactions || {};
  const next = {};
  for (const [key, uids] of Object.entries(reactions || {})) {
    next[key] = [...(uids || [])];
  }
  const current = next[emoji] || [];
  if (current.includes(viewerId)) {
    next[emoji] = current.filter((id) => id !== viewerId);
    if (!next[emoji].length) delete next[emoji];
  } else {
    next[emoji] = [...current, viewerId];
  }
  return next;
}

/** Reaction chips to render: emoji, count and whether the viewer already used it. */
export function reactionChips(reactions = {}, viewerId) {
  return Object.entries(reactions || {})
    .filter(([, uids]) => (uids || []).length > 0)
    .map(([emoji, uids]) => ({ emoji, count: uids.length, mine: (uids || []).includes(viewerId) }));
}

/** The six quick-react emoji offered in the message action sheet. */
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// ---------------------------------------------------------------------------
// Typing / presence freshness
// ---------------------------------------------------------------------------

export const TYPING_WINDOW_MS = 6000;
export const PRESENCE_WINDOW_MS = 90000;

function isRecent(timestamp, windowMs, now = Date.now()) {
  if (!timestamp) return false;
  const ms = timestampMillis(timestamp);
  if (!ms || Number.isNaN(ms)) return false;
  return now - ms < windowMs;
}

/** A typing flag is only meaningful for a few seconds after it was written. */
export function isTypingRecently(timestamp, now) {
  return isRecent(timestamp, TYPING_WINDOW_MS, now);
}

/** Presence heartbeats expire after PRESENCE_WINDOW_MS. */
export function isPresenceRecent(timestamp, now) {
  return isRecent(timestamp, PRESENCE_WINDOW_MS, now);
}

/**
 * Names of the users currently typing, from a `{ uid: timestamp }` map stored
 * on the conversation/group document.
 */
export function typingNames(typingMap = {}, excludeUid, nameFor = () => '', now = Date.now()) {
  return Object.entries(typingMap || {})
    .filter(([uid, ts]) => uid !== excludeUid && isTypingRecently(ts, now))
    .map(([uid]) => nameFor(uid))
    .filter(Boolean);
}

/** How many participants are currently online from a presence map. */
export function presenceCount(presenceMap = {}, excludeUid, now = Date.now()) {
  return Object.entries(presenceMap || {}).filter(
    ([uid, ts]) => uid !== excludeUid && isPresenceRecent(ts, now)
  ).length;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** 95 → "1:35" for voice notes and the recording timer. */
export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** 1536 → "1.5 KB" for file attachments. */
export function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short time (14:05) shown inside bubbles. */
export function messageTime(value) {
  const date = toLocalDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(date);
}

/**
 * Deterministic "waveform" bar heights for voice notes, derived from the
 * message id — stable across renders without storing samples.
 */
export function voiceBars(seed, count = 28) {
  const bars = [];
  let hash = 0;
  const key = String(seed || 'voice');
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  for (let i = 0; i < count; i += 1) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    bars.push(18 + (hash % 70)); // 18%–88% height
  }
  return bars;
}

// ---------------------------------------------------------------------------
// Media & files
// ---------------------------------------------------------------------------

/** All image/video/file/link messages for the Media & files panel. */
export function mediaMessages(messages) {
  return (messages || []).filter(
    (m) => !m.deleted && (m.type === MESSAGE_TYPES.IMAGE || m.type === MESSAGE_TYPES.VIDEO)
  );
}

export function fileMessages(messages) {
  return (messages || []).filter((m) => !m.deleted && m.type === MESSAGE_TYPES.FILE);
}

export function starredBy(messages, uid) {
  return (messages || []).filter((m) => !m.deleted && (m.starredBy || []).includes(uid));
}

export function pinnedMessages(messages) {
  return (messages || []).filter((m) => !m.deleted && m.pinned);
}

/** Google-maps deep link for a shared location. */
export function mapsLink(location) {
  if (!location) return '';
  const { lat, lng } = location;
  if (lat == null || lng == null) return '';
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

// ---------------------------------------------------------------------------
// Emoji picker + stickers (static data — no external service required).
// ---------------------------------------------------------------------------

export const EMOJI_GROUPS = [
  {
    id: 'smileys',
    label: '😀',
    name: 'Smileys & people',
    emoji: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '🥲', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🫢', '🤫',
      '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒',
      '🙄', '😬', '😮', '😯', '😴', '🤤', '😪', '😵', '🤯', '🥱',
      '😔', '😕', '🙁', '😒', '😞', '😟', '😤', '😢', '😭', '😦',
      '😧', '😨', '😩', '🤯', '😰', '😱', '🥵', '🥶', '😳', '🤪',
    ],
  },
  {
    id: 'gestures',
    label: '👍',
    name: 'Gestures & people',
    emoji: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘',
      '👏', '🙌', '🫶', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾',
      '👀', '👁️', '👋', '🤚', '🖐️', '✋', '🖖', '👋', '🤙', '👊',
    ],
  },
  {
    id: 'hearts',
    label: '❤️',
    name: 'Hearts & symbols',
    emoji: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💯', '✅',
      '❌', '⭐', '🌟', '✨', '⚡', '🔥', '🎉', '🎊', '🎈', '🏆',
    ],
  },
  {
    id: 'animals',
    label: '🐱',
    name: 'Animals & nature',
    emoji: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦆', '🦅',
      '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌',
      '🐞', '🐢', '🐍', '🐙', '🦐', '🐠', '🐟', '🐬', '🐳', '🌵',
    ],
  },
  {
    id: 'food',
    label: '🍔',
    name: 'Food & drink',
    emoji: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐',
      '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆',
      '🥔', '🥕', '🌽', '🌶️', '🥦', '🧄', '🧅', '🍄', '🥜', '🍞',
      '🥐', '🥖', '🧇', '🧀', '🍖', '🍗', '🥓', '🍔', '🍟', '🍕',
    ],
  },
  {
    id: 'objects',
    label: '💡',
    name: 'Objects & activity',
    emoji: [
      '⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '💾', '📷', '🎥',
      '📞', '☎️', '📺', '📻', '⏰', '⏳', '💡', '🔦', '🔋', '🧰',
      '💰', '💵', '💳', '📊', '📈', '📉', '📋', '📌', '📎', '✂️',
      '🔒', '🔑', '🔨', '🚗', '✈️', '🚀', '🛒', '🎁', '🎯', '⚽',
    ],
  },
];

/** Big emoji stickers — sent instantly, rendered without a bubble. */
export const STICKERS = [
  '😂', '🥳', '😎', '🤩', '😭', '🥺', '😡', '🤯', '😱', '🤔',
  '👍', '👏', '🙏', '💪', '🫶', '👀', '🔥', '💯', '🎉', '🎊',
  '❤️', '💜', '🌟', '✨', '⚡', '🌈', '☀️', '🌙', '🐱', '🐶',
  '🦄', '🍕', '🍔', '☕', '🎁', '🏆', '🎯', '🚀', '💰', '📌',
];

export const REPORT_REASONS = [
  'Spam or scam',
  'Offensive or abusive content',
  'Harassment or bullying',
  'Inappropriate media',
  'Fake listing or fraud',
  'Something else',
];
