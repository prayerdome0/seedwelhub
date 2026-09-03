import { createDoc, getById, patchDoc, queryOnce, saveDoc } from './_base';
import { where, orderBy, limit, arrayUnion, arrayRemove } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { serverTimestamp } from '../firebase/firestore';

const GROUPS = COLLECTIONS.GROUPS;
const MEMBERS = COLLECTIONS.GROUP_MEMBERS;
const MESSAGES = COLLECTIONS.MESSAGES;

export function getGroup(id) {
  return getById(GROUPS, id);
}

export function getGroupsForUser(uid) {
  return queryOnce(MEMBERS, [where('uid', '==', uid)], { orderBy: ['createdAt', 'desc'] });
}

export function getPublicGroups() {
  return queryOnce(GROUPS, [where('visibility', '==', 'public')], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function createGroup({ creatorId, name, image = '', description = '', category = '', visibility = 'public' }) {
  const group = await createDoc(GROUPS, {
    name,
    image,
    description,
    category,
    visibility,
    creatorId,
    memberCount: 1,
  });
  await createDoc(MEMBERS, {
    groupId: group.id,
    uid: creatorId,
    role: 'admin',
    status: 'active',
    joinedAt: serverTimestamp(),
  });
  return group;
}

export async function joinGroup(groupId, uid) {
  const ref = await createDoc(MEMBERS, {
    groupId,
    uid,
    role: 'member',
    status: 'active',
    joinedAt: serverTimestamp(),
  });
  await incrementMemberCount(groupId, 1);
  return ref;
}

export async function leaveGroup(groupId, uid) {
  const members = await queryOnce(MEMBERS, [
    where('groupId', '==', groupId),
    where('uid', '==', uid),
  ], { limit: 1 });
  for (const m of members) {
    await saveDoc(MEMBERS, m.id, { ...m, status: 'left' });
  }
  await incrementMemberCount(groupId, -1);
}

async function incrementMemberCount(groupId, delta) {
  const group = await getById(GROUPS, groupId);
  if (!group) return;
  const current = Number(group.memberCount) || 0;
  await patchDoc(GROUPS, groupId, { memberCount: Math.max(0, current + delta) });
}

export function getGroupMembers(groupId) {
  return queryOnce(MEMBERS, [where('groupId', '==', groupId), where('status', '==', 'active')]);
}

export function getGroupMessages(groupId, count = 200) {
  return queryOnce(MESSAGES, [where('groupId', '==', groupId)], {
    orderBy: ['createdAt', 'asc'],
    limit: count,
  });
}

export async function sendGroupMessage({ groupId, senderId, text = '', type = 'text', mediaUrl = '' }) {
  return createDoc(MESSAGES, {
    groupId,
    senderId,
    text,
    type,
    mediaUrl,
  });
}
