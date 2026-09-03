import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { generateConversationId } from '../utils/ids';
import { serverTimestamp } from '../firebase/firestore';

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

export function getConversationsForUser(uid) {
  return queryOnce(CONVERSATIONS, [where('participantIds', 'array-contains', uid)], {
    orderBy: ['lastMessageAt', 'desc'],
  });
}

export function getMessages(conversationId, count = 200) {
  return queryOnce(MESSAGES, [where('conversationId', '==', conversationId)], {
    orderBy: ['createdAt', 'asc'],
    limit: count,
  });
}

export async function sendMessage({ conversationId, senderId, text = '', type = 'text', mediaUrl = '', ...data }) {
  return createDoc(MESSAGES, {
    conversationId,
    senderId,
    text,
    type,
    mediaUrl,
    readBy: [senderId],
    ...data,
  });
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
