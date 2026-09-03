import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { serverTimestamp } from '../firebase/firestore';

const COL = COLLECTIONS.NOTIFICATIONS;

export function getNotificationsForUser(uid, count = 100) {
  return queryOnce(COL, [where('recipientId', '==', uid)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export function getUnreadNotificationsForUser(uid) {
  return queryOnce(
    COL,
    [where('recipientId', '==', uid), where('read', '==', false)],
    { orderBy: ['createdAt', 'desc'] }
  );
}

export async function createNotification({ recipientId, title, message, type = 'general', related = {} }) {
  return createDoc(COL, {
    recipientId,
    title,
    message,
    type,
    read: false,
    related,
    createdAt: serverTimestamp(),
  });
}

export async function markNotificationRead(id) {
  return patchDoc(COL, id, { read: true });
}

export async function markAllRead(uid) {
  const items = await getUnreadNotificationsForUser(uid);
  const results = [];
  for (const item of items) {
    results.push(await patchDoc(COL, item.id, { read: true }));
  }
  return results;
}

export async function deleteNotification(id) {
  return patchDoc(COL, id, { deleted: true });
}

export async function countUnread(uid) {
  const items = await getUnreadNotificationsForUser(uid);
  return items.length;
}
