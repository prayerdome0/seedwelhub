import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { serverTimestamp, where } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { generateConversationId } from '../utils/ids';
import { sortByTimestamp } from '../utils/format';

const CONVERSATIONS = COLLECTIONS.CONVERSATIONS;
const MESSAGES = COLLECTIONS.MESSAGES;

export function getConversation(id) {
  return getById(CONVERSATIONS, id);
}

export async function findOrCreateConversation(userA, userB, { product = null } = {}) {
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
      ...(product ? { sharedProductId: product } : {}),
    },
    conversationId
  );
  return conversation;
}

/**
 * The old query combined array-contains with orderBy(lastMessageAt), which
 * requires a composite Firestore index. A missing index surfaced as a generic
 * network error on the Messages page. Fetch the user's private conversations
 * with the single-field filter and sort the small result set locally instead.
 */
export async function getConversationsForUser(uid) {
  const conversations = await queryOnce(CONVERSATIONS, [
    where('participantIds', 'array-contains', uid),
  ]);
  return sortByTimestamp(conversations, 'lastMessageAt', 'desc');
}

/**
 * Messages use the same index-free approach. Sorting before slicing keeps the
 * newest messages visible even when a conversation has more than the display
 * limit.
 */
export async function getMessages(conversationId, count = 200) {
  const messages = await queryOnce(MESSAGES, [
    where('conversationId', '==', conversationId),
  ]);
  return sortByTimestamp(messages, 'createdAt', 'asc').slice(-count);
}

export async function sendMessage({ conversationId, senderId, text = '', type = 'text', mediaUrl = '', ...data }) {
  const message = await createDoc(MESSAGES, {
    conversationId,
    senderId,
    text,
    type,
    mediaUrl,
    readBy: [senderId],
    ...data,
  });

  // Keep the inbox preview and ordering in sync with the message just sent.
  // The message itself has already been created, so an unusual failure while
  // updating the preview should not make the composer report a false failure.
  try {
    await updateConversationLastMessage(
      conversationId,
      text.trim() || (type === 'image' ? 'Shared an image' : '')
    );
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
