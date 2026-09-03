import { createDoc, getById, patchDoc, queryOnce, saveDoc } from './_base';
import {
  arrayRemove,
  arrayUnion,
  deleteField,
  increment,
  serverTimestamp,
  where,
} from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { sortByTimestamp } from '../utils/format';
import { messagePreview } from '../utils/chat';

const GROUPS = COLLECTIONS.GROUPS;
const MEMBERS = COLLECTIONS.GROUP_MEMBERS;
const MESSAGES = COLLECTIONS.MESSAGES;
const REPORTS = COLLECTIONS.REPORTS;

export function getGroup(id) {
  return getById(GROUPS, id);
}

export function getGroupsForUser(uid) {
  return queryOnce(MEMBERS, [where('uid', '==', uid)], { orderBy: ['createdAt', 'desc'] });
}

/**
 * Groups where `uid` is a current member, straight off the group document's
 * `memberIds` list (kept in sync by join/leave/add/remove). Used by the
 * forward-to-group picker. Legacy groups without `memberIds` still surface
 * through getGroupsForUser — callers merge the two results.
 */
export function getGroupsWhereMember(uid) {
  return queryOnce(GROUPS, [where('memberIds', 'array-contains', uid)]);
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
    // `memberIds` / `adminIds` mirror the membership collection so security
    // rules can check membership/admin rights without a query (rules cannot
    // query collections).
    memberIds: [creatorId],
    adminIds: [creatorId],
    // Group permissions: everyone can post by default; admins can lock this.
    permissions: { whoCanSend: 'all' },
    announcement: null,
    typing: {},
    presence: {},
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

export async function joinGroup(groupId, uid, { name = '' } = {}) {
  const ref = await createDoc(MEMBERS, {
    groupId,
    uid,
    role: 'member',
    status: 'active',
    name,
    joinedAt: serverTimestamp(),
  });
  await patchDoc(GROUPS, groupId, {
    memberIds: arrayUnion(uid),
    memberCount: increment(1),
  });
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
  await patchDoc(GROUPS, groupId, {
    memberIds: arrayRemove(uid),
    adminIds: arrayRemove(uid),
    memberCount: increment(-1),
  });
  await maybeReassignLastAdmin(groupId, uid);
  return true;
}

export function getGroupMembers(groupId) {
  return queryOnce(MEMBERS, [where('groupId', '==', groupId), where('status', '==', 'active')]);
}

// ---------------------------------------------------------------------------
// Admin controls — add/remove members, promote/demote, settings, announcements.
//
// "Authorized admins only" is enforced twice: the caller checks rights before
// offering the action in the UI, and the Firestore rules re-check it against
// the group document's `adminIds` before accepting the write.
// ---------------------------------------------------------------------------

async function assertGroupAdmin(group, actorId) {
  const admins = group.adminIds || [];
  const isCreator = group.creatorId && group.creatorId === actorId;
  if (!isCreator && !admins.includes(actorId)) {
    throw new Error('Only group admins can do that.');
  }
}

/** Adds a member directly (admin action). Works by Seedwel Hub user ID. */
export async function addGroupMember(group, uid, { name = '', addedBy = '' } = {}) {
  if (!uid) throw new Error('Please enter the member’s Seedwel ID.');
  await assertGroupAdmin(group, addedBy);
  const existing = await queryOnce(MEMBERS, [
    where('groupId', '==', group.id),
    where('uid', '==', uid),
  ], { limit: 1 });
  if (existing.length) {
    const m = existing[0];
    if (m.status === 'active') throw new Error('That user is already a member.');
    await saveDoc(MEMBERS, m.id, { ...m, status: 'active', joinedAt: serverTimestamp() });
  } else {
    await createDoc(MEMBERS, {
      groupId: group.id,
      uid,
      role: 'member',
      status: 'active',
      name,
      addedBy,
      joinedAt: serverTimestamp(),
    });
  }
  await patchDoc(GROUPS, group.id, {
    memberIds: arrayUnion(uid),
    memberCount: increment(1),
  });
  return true;
}

/** Removes a member (admin only). The membership doc is kept for audit. */
export async function removeGroupMember(group, member, actorId) {
  await assertGroupAdmin(group, actorId);
  if (member.role === 'admin' && (group.adminIds || []).length <= 1) {
    throw new Error('Promote another admin first — a group cannot be left without an admin.');
  }
  await saveDoc(MEMBERS, member.id, { ...member, status: 'removed', removedAt: serverTimestamp() });
  await patchDoc(GROUPS, group.id, {
    memberIds: arrayRemove(member.uid),
    adminIds: arrayRemove(member.uid),
    memberCount: increment(-1),
  });
  return true;
}

/** Grants admin rights (admin only). */
export async function promoteToAdmin(group, member, actorId) {
  await assertGroupAdmin(group, actorId);
  await saveDoc(MEMBERS, member.id, { ...member, role: 'admin' });
  await patchDoc(GROUPS, group.id, { adminIds: arrayUnion(member.uid) });
  return true;
}

/** Revokes admin rights (admin only; the creator stays admin). */
export async function demoteFromAdmin(group, member, actorId) {
  await assertGroupAdmin(group, actorId);
  if (group.creatorId === member.uid) {
    throw new Error('The group creator cannot be demoted.');
  }
  await saveDoc(MEMBERS, member.id, { ...member, role: 'member' });
  await patchDoc(GROUPS, group.id, { adminIds: arrayRemove(member.uid) });
  return true;
}

/**
 * When an admin leaves, ensure at least one active admin remains: promote the
 * earliest remaining active member if this was the last one.
 */
async function maybeReassignLastAdmin(groupId, leavingUid) {
  const group = await getById(GROUPS, groupId);
  if (!group) return;
  const admins = (group.adminIds || []).filter((id) => id !== leavingUid);
  if (admins.length) return;
  const members = await getGroupMembers(groupId);
  const remaining = sortByTimestamp(
    members.filter((m) => m.uid !== leavingUid),
    'joinedAt',
    'asc'
  );
  const target = remaining[0];
  if (!target) return;
  await saveDoc(MEMBERS, target.id, { ...target, role: 'admin' });
  await patchDoc(GROUPS, groupId, { adminIds: arrayUnion(target.uid) });
}

/** Group settings — name, description, category, visibility, permissions. */
export async function updateGroupSettings(group, data, actorId) {
  await assertGroupAdmin(group, actorId);
  const allowed = {};
  for (const key of ['name', 'description', 'category', 'visibility', 'image', 'permissions']) {
    if (data[key] !== undefined) allowed[key] = data[key];
  }
  if (!Object.keys(allowed).length) throw new Error('Nothing to update.');
  return patchDoc(GROUPS, group.id, allowed);
}

/** Sets or clears the group announcement banner (admin only). */
export async function setGroupAnnouncement(group, text, actorId) {
  await assertGroupAdmin(group, actorId);
  const trimmed = String(text || '').trim();
  return patchDoc(GROUPS, group.id, {
    announcement: trimmed
      ? { text: trimmed.slice(0, 500), updatedAt: serverTimestamp(), updatedBy: actorId }
      : null,
  });
}

/** Files a group report for the admin review queue. */
export async function reportGroup({ group, reporterId, reason = '', note = '' }) {
  if (!reason) throw new Error('Please choose a reason for the report.');
  return createDoc(REPORTS, {
    type: 'group',
    targetId: group.id,
    reporterId,
    reason,
    note: String(note || '').slice(0, 1000),
    groupName: group.name || '',
    status: 'submitted',
  });
}

/** Mutes/unmutes this group for one member (stored on their membership doc). */
export async function setMemberGroupMuted(memberDoc, muted) {
  return saveDoc(MEMBERS, memberDoc.id, { ...memberDoc, muted: Boolean(muted) });
}

// ---------------------------------------------------------------------------
// Group chat feed.
// ---------------------------------------------------------------------------

/**
 * Same index-free approach as direct messages: fetch by group only, then sort
 * locally and keep the newest `count` messages. A server-side orderBy next to
 * the groupId filter would require a composite index.
 */
export async function getGroupMessages(groupId, count = 200) {
  const messages = await queryOnce(MESSAGES, [where('groupId', '==', groupId)]);
  return sortByTimestamp(messages, 'createdAt', 'asc').slice(-count);
}

export async function sendGroupMessage({
  groupId,
  senderId,
  text = '',
  type = 'text',
  mediaUrl = '',
  ...data
}) {
  const message = await createDoc(MESSAGES, {
    groupId,
    senderId,
    text,
    type,
    mediaUrl,
    deliveredTo: [senderId],
    readBy: [senderId],
    reactions: {},
    starredBy: [],
    ...data,
  });

  // Keep the group list ordering / preview in sync (same best-effort approach
  // as direct conversations — a preview failure must not fail the send).
  try {
    await patchDoc(GROUPS, groupId, {
      lastMessage: messagePreview(message),
      lastMessageAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('[SeedwelHub] Group message sent but group preview was not updated:', error);
  }

  return message;
}

// ---------------------------------------------------------------------------
// Group presence & typing — small maps on the group document.
// ---------------------------------------------------------------------------

export async function setGroupTyping(groupId, uid, typing) {
  return patchDoc(GROUPS, groupId, {
    [`typing.${uid}`]: typing ? serverTimestamp() : deleteField(),
  });
}

export async function setGroupPresence(groupId, uid) {
  return patchDoc(GROUPS, groupId, {
    [`presence.${uid}`]: serverTimestamp(),
  });
}
