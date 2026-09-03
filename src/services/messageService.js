import { createDoc, getById, patchDoc, queryOnce, removeDoc } from './_base';
import { arrayRemove, arrayUnion, deleteField, serverTimestamp, where } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { generateConversationId } from '../utils/ids';
import { messagePreview } from '../utils/chat';

const CONVERSATIONS = COLLECTIONS.CONVERSATIONS;
const MESSAGES = COLLECTIONS.MESSAGES;
const REPORTS = COLLECTIONS.REPORTS;

export function getConversation(id) {
  return getById(CONVERSATIONS, id);
}

export async function findOrCreateConversation(userA, userB, { product = null, meta = {} } = {}) {
  const conversationId = generateConversationId(userA, userB);
  const existing = await getById(CONVERSATIONS, conversationId);
  if (existing) return existing;

  const conversation = await createDoc(
    CONVERSATIONS,
    {
      conversationId,
      participants: [userA, userB],
      participantIds: [userA, userB],
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      unreadCounts: { [userA]: 0, [userB]: 0 },
      type: 'direct',
      typing: {},
      presence: {},
      muted: {},
      blockedBy: {},
      ...(product ? { sharedProductId: product } : {}),
      // Display info per participant (`displayName_<uid>` / `photoURL_<uid>`)
      // so each side of the thread can render the other person.
      ...meta,
    },
    conversationId
  );
  return conversation;
}

/**
 * Filtered + ordered queries need a composite Firestore index, which surfaced
 * as a generic network error on the Messages page. `queryOnce` now handles
 * this centrally (filter server-side, order client-side); these wrappers keep
 * the inbox and thread behaviour explicit.
 */
export async function getConversationsForUser(uid) {
  return queryOnce(CONVERSATIONS, [
    where('participantIds', 'array-contains', uid),
  ], { orderBy: ['lastMessageAt', 'desc'] });
}

/**
 * Sorting before slicing keeps the newest messages visible even when a
 * conversation has more than the display limit.
 */
export async function getMessages(conversationId, count = 200) {
  const messages = await queryOnce(MESSAGES, [
    where('conversationId', '==', conversationId),
  ], { orderBy: ['createdAt', 'asc'] });
  return messages.slice(-count);
}

export async function sendMessage({
  conversationId,
  senderId,
  text = '',
  type = 'text',
  mediaUrl = '',
  ...data
}) {
  const message = await createDoc(MESSAGES, {
    conversationId,
    senderId,
    text,
    type,
    mediaUrl,
    // Delivery / read receipts: the sender has obviously "delivered to" and
    // "read" their own message. Everyone else is added by markMessagesDelivered
    // and markMessagesRead as they receive / open the thread.
    deliveredTo: [senderId],
    readBy: [senderId],
    reactions: {},
    starredBy: [],
    ...data,
  });

  // Keep the inbox preview and ordering in sync with the message just sent.
  // The message itself has already been created, so an unusual failure while
  // updating the preview should not make the composer report a false failure.
  try {
    await updateConversationLastMessage(conversationId, messagePreview(message));
  } catch (error) {
    console.warn('[SeedwelHub] Message sent but inbox preview was not updated:', error);
  }

  return message;
}

export async function markConversationRead(conversationId, uid) {
  // In a full implementation this updates per-participant unread counts. Here we
  // record read-at on the conversation so the unread badge can be derived.
  return patchDoc(CONVERSATIONS, conversationId, { [`lastReadBy.${uid}`]: serverTimestamp() });
}

export async function updateConversationLastMessage(conversationId, message) {
  return patchDoc(CONVERSATIONS, conversationId, {
    lastMessage: message,
    lastMessageAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Message actions — edit, delete, react, star, pin, report.
//
// Every action works on the shared `messages` collection, so direct chats and
// groups reuse them unchanged.
// ---------------------------------------------------------------------------

/** Edits the sender's own text message (kept in place with an "edited" mark). */
export async function editMessage(message, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Message text cannot be empty.');
  return patchDoc(MESSAGES, message.id, {
    text: trimmed,
    edited: true,
    editedAt: serverTimestamp(),
  });
}

/** Soft-deletes a message so replies quoting it stay comprehensible. */
export async function deleteMessage(message) {
  return patchDoc(MESSAGES, message.id, {
    deleted: true,
    text: '',
    mediaUrl: '',
    mediaName: '',
    mediaSize: 0,
    reactions: {},
    edited: false,
    deletedAt: serverTimestamp(),
  });
}

/** Persists a toggled reaction map (computed by utils/chat.toggleReactionMap). */
export async function setReactions(message, reactions) {
  return patchDoc(MESSAGES, message.id, { reactions: reactions || {} });
}

/** Stars / unstars a message for one user (personal, per-user bookmarks). */
export async function toggleStarMessage(message, uid, starred) {
  return patchDoc(MESSAGES, message.id, {
    starredBy: starred ? arrayUnion(uid) : arrayRemove(uid),
  });
}

/** Pins / unpins a message. Pinned banners link back to the original. */
export async function setPinnedMessage(message, pinned, uid) {
  return patchDoc(MESSAGES, message.id, {
    pinned: Boolean(pinned),
    pinnedBy: uid,
    pinnedAt: pinned ? serverTimestamp() : deleteField(),
  });
}

/** Files a message report for the admin review queue. */
export async function reportMessage({ message, reporterId, reason = '', note = '' }) {
  if (!reason) throw new Error('Please choose a reason for the report.');
  return createDoc(REPORTS, {
    type: 'message',
    targetId: message.id,
    reporterId,
    reason,
    note: String(note || '').slice(0, 1000),
    senderId: message.senderId || '',
    conversationId: message.conversationId || null,
    groupId: message.groupId || null,
    snippet: messagePreview(message).slice(0, 200),
    status: 'submitted',
  });
}

/** Files a whole-conversation report (harassment, spam threads, …). */
export async function reportConversation({ conversation, reporterId, reason = '', note = '' }) {
  if (!reason) throw new Error('Please choose a reason for the report.');
  return createDoc(REPORTS, {
    type: 'conversation',
    targetId: conversation.id,
    reporterId,
    reason,
    note: String(note || '').slice(0, 1000),
    snippet: String(conversation.lastMessage || '').slice(0, 200),
    status: 'submitted',
  });
}

// ---------------------------------------------------------------------------
// Delivery & read receipts.
// ---------------------------------------------------------------------------

/**
 * Marks incoming messages as delivered to `uid`. Called while polling so the
 * sender's single tick becomes a double tick as soon as the recipient's client
 * fetches the thread — no Firestore listeners required.
 */
export async function markMessagesDelivered(messages, uid) {
  if (!uid) return 0;
  const targets = (messages || []).filter(
    (m) => m.senderId !== uid && !(m.deliveredTo || []).includes(uid) && !m.deleted
  );
  await Promise.all(
    targets.map((m) => patchDoc(MESSAGES, m.id, { deliveredTo: arrayUnion(uid) }))
  );
  return targets.length;
}

/**
 * Marks incoming messages as READ — only when the viewer is actually looking
 * at the latest messages (at the bottom of the thread).
 */
export async function markMessagesRead(messages, uid) {
  if (!uid) return 0;
  const targets = (messages || []).filter(
    (m) => m.senderId !== uid && !(m.readBy || []).includes(uid) && !m.deleted
  );
  await Promise.all(
    targets.map((m) => patchDoc(MESSAGES, m.id, { readBy: arrayUnion(uid) }))
  );
  return targets.length;
}

// ---------------------------------------------------------------------------
// Conversation-level presence, typing and preferences.
//
// These write small maps (`typing`, `presence`, `muted`, `blockedBy`) onto the
// conversation document, which participants may already update — so no new
// Firestore rules are needed for them.
// ---------------------------------------------------------------------------

/** Raises/lowers this user's typing flag on the conversation. */
export async function setConversationTyping(conversationId, uid, typing) {
  return patchDoc(CONVERSATIONS, conversationId, {
    [`typing.${uid}`]: typing ? serverTimestamp() : deleteField(),
  });
}

/** Presence heartbeat — "online" is a timestamp fresher than ~90 seconds. */
export async function setConversationPresence(conversationId, uid) {
  return patchDoc(CONVERSATIONS, conversationId, {
    [`presence.${uid}`]: serverTimestamp(),
  });
}

/** Mutes/unmutes notifications for this conversation, per user. */
export async function setConversationMuted(conversationId, uid, muted) {
  return patchDoc(CONVERSATIONS, conversationId, {
    [`muted.${uid}`]: Boolean(muted),
  });
}

/** Blocks/unblocks the OTHER participant from this conversation. */
export async function setConversationBlocked(conversationId, uid, blocked) {
  return patchDoc(CONVERSATIONS, conversationId, {
    [`blockedBy.${uid}`]: Boolean(blocked),
    blockedAt: blocked ? serverTimestamp() : deleteField(),
  });
}

/** Wipes every message in the conversation and resets the inbox preview. */
export async function clearConversation(conversationId) {
  const messages = await getMessages(conversationId, 10000);
  await Promise.all(messages.map((m) => removeDoc(MESSAGES, m.id)));
  await patchDoc(CONVERSATIONS, conversationId, {
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    typing: {},
  });
  return messages.length;
}

/** Conversation settings sheet (e.g. notification preferences). */
export async function updateConversationSettings(conversationId, data) {
  return patchDoc(CONVERSATIONS, conversationId, data);
}
