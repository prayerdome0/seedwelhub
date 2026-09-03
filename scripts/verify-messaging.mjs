import assert from 'node:assert/strict';
import { resetStore, store } from './firestore-mock.mjs';

// ---------------------------------------------------------------------------
// Messaging workspace verification.
//
// Runs the REAL chat service layer against the in-memory Firestore, plus the
// pure helpers from src/utils/chat.js that drive the fixed-layout UI:
//
//   Flow M1 — direct conversation: send → deliver → read → edit → delete
//             → react → star → pin → reply → forward → report → typing
//             → presence → mute → block → clear
//   Flow M2 — group messaging: create → join → admin-gated member management
//             → announcements → permissions → leave-with-reassignment
//   Flow M3 — UI helpers: day separators, unread divider, delivery ticks,
//             mention highlighting, search
// ---------------------------------------------------------------------------

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const C = await import('../src/utils/constants.js');
const U = await import('../src/utils/chat.js');

const messageService = await import('../src/services/messageService.js');
const {
  findOrCreateConversation, getConversation, getMessages, sendMessage,
  markMessagesDelivered, markMessagesRead, editMessage, deleteMessage,
  setReactions, toggleStarMessage, setPinnedMessage, reportMessage,
  reportConversation, setConversationTyping, setConversationPresence,
  setConversationMuted, setConversationBlocked, clearConversation,
} = messageService;

const groupService = await import('../src/services/groupService.js');
const {
  createGroup, joinGroup, leaveGroup, getGroup, getGroupMembers,
  getGroupMessages, sendGroupMessage, addGroupMember, removeGroupMember,
  promoteToAdmin, demoteFromAdmin, updateGroupSettings, setGroupAnnouncement,
  reportGroup, setMemberGroupMuted, setGroupTyping, setGroupPresence,
} = groupService;

const ALICE = 'user_alice';
const BOB = 'user_bob';
const CAROL = 'user_carol';

const msgsIn = (conversationId) =>
  getMessages(conversationId, 10000).then((list) => list);
const rawMessages = () => [...(store.get(C.COLLECTIONS.MESSAGES)?.values() || [])];
const reports = () => [...(store.get(C.COLLECTIONS.REPORTS)?.values() || [])];

// ===========================================================================
console.log('\nFLOW M1 — DIRECT CONVERSATION LIFECYCLE');
// ===========================================================================
resetStore();

let conversation;
await check('conversation is created between two users with chat metadata', async () => {
  conversation = await findOrCreateConversation(ALICE, BOB, {
    meta: { [`displayName_${ALICE}`]: 'Alice', [`displayName_${BOB}`]: 'Bob' },
  });
  const again = await findOrCreateConversation(ALICE, BOB);
  assert.equal(again.id, conversation.id, 're-opening must reuse the same conversation');
  assert.deepEqual(conversation.participantIds.sort(), [ALICE, BOB].sort());
});

await check('sending a text message seeds receipts and updates the inbox preview', async () => {
  const message = await sendMessage({
    conversationId: conversation.id, senderId: ALICE, text: 'I will send the quotation tomorrow.',
    senderName: 'Alice',
  });
  assert.ok(message.id);
  assert.deepEqual(message.readBy, [ALICE]);
  assert.deepEqual(message.deliveredTo, [ALICE]);
  const refreshed = await getConversation(conversation.id);
  assert.equal(refreshed.lastMessage, 'I will send the quotation tomorrow.');
});

let firstMessage;
await check('typed media messages preview correctly and support replies', async () => {
  firstMessage = (await msgsIn(conversation.id))[0];
  const reply = await sendMessage({
    conversationId: conversation.id, senderId: BOB, text: 'Perfect, thank you!',
    senderName: 'Bob',
    replyTo: firstMessage.id,
    replyPreview: U.messagePreview(firstMessage),
  });
  assert.equal(reply.replyTo, firstMessage.id);
  assert.equal(reply.replyPreview, 'I will send the quotation tomorrow.');
});

await check('delivery receipts tick over when the other side fetches', async () => {
  const list = await msgsIn(conversation.id);
  const marked = await markMessagesDelivered(list, BOB);
  assert.equal(marked, 1, 'Alice’s incoming message should mark delivered for Bob');
  const after = await msgsIn(conversation.id);
  assert.ok(after.every((m) => m.deliveredTo.includes(BOB)));
});

await check('read receipts are per-user and idempotent', async () => {
  const list = await msgsIn(conversation.id);
  await markMessagesRead(list, BOB);
  await markMessagesRead(await msgsIn(conversation.id), BOB); // second pass: no-ops
  const after = await msgsIn(conversation.id);
  assert.ok(after.every((m) => m.readBy.includes(BOB)));
  const marked = await markMessagesRead(after, BOB);
  assert.equal(marked, 0, 'already-read messages must not be re-written');
});

await check('editing keeps history flags (edited = true)', async () => {
  const mine = (await msgsIn(conversation.id)).find((m) => m.senderId === BOB);
  await editMessage(mine, 'Perfect — updated, thank you!');
  const after = (await msgsIn(conversation.id)).find((m) => m.id === mine.id);
  assert.equal(after.text, 'Perfect — updated, thank you!');
  assert.equal(after.edited, true);
  await assert.rejects(() => editMessage(after, '   '), /cannot be empty/);
});

await check('deleting is soft — the bubble survives as “deleted”', async () => {
  const mine = (await msgsIn(conversation.id)).find((m) => m.senderId === ALICE && m.type === 'text');
  await deleteMessage(mine);
  const after = (await msgsIn(conversation.id)).find((m) => m.id === mine.id);
  assert.equal(after.deleted, true);
  assert.equal(after.text, '');
  assert.match(U.messagePreview(after), /deleted/);
});

await check('reactions toggle per user via the pure map helper', async () => {
  const target = (await msgsIn(conversation.id)).find((m) => m.senderId === BOB);
  const once = U.toggleReactionMap(target.reactions, ALICE, '👍');
  await setReactions(target, once);
  const twice = U.toggleReactionMap(once, ALICE, '👍'); // toggle off
  await setReactions(target, twice);
  assert.deepEqual(twice, {}, 'toggling the same emoji twice removes it');

  const withTwo = U.toggleReactionMap(twice, ALICE, '❤️');
  const withThree = U.toggleReactionMap(withTwo, CAROL, '❤️');
  const chips = U.reactionChips(withThree, ALICE);
  assert.equal(chips.length, 1);
  assert.equal(chips[0].count, 2);
  assert.equal(chips[0].mine, true);
});

await check('starring is personal and pinning is communal', async () => {
  const target = (await msgsIn(conversation.id)).find((m) => m.senderId === BOB);
  await toggleStarMessage(target, ALICE, true);
  let after = (await msgsIn(conversation.id)).find((m) => m.id === target.id);
  assert.ok(after.starredBy.includes(ALICE));
  assert.ok(!after.starredBy.includes(BOB), 'stars must not leak to other users');

  await setPinnedMessage(target, true, ALICE);
  after = (await msgsIn(conversation.id)).find((m) => m.id === target.id);
  assert.equal(after.pinned, true);
  await setPinnedMessage(after, false, ALICE);
  after = (await msgsIn(conversation.id)).find((m) => m.id === target.id);
  assert.equal(after.pinned, false);
});

let secondConversation;
await check('forwarding copies the payload without reply metadata', async () => {
  secondConversation = await findOrCreateConversation(ALICE, CAROL, {
    meta: { [`displayName_${CAROL}`]: 'Carol' },
  });
  const original = (await msgsIn(conversation.id)).find((m) => m.senderId === BOB && !m.deleted);
  // The workspace forwards by sending a copy into the target conversation.
  await sendMessage({
    conversationId: secondConversation.id, senderId: ALICE, senderName: 'Alice',
    text: original.text, type: original.type, forwarded: true,
  });
  const forwardedList = await msgsIn(secondConversation.id);
  assert.equal(forwardedList.length, 1);
  assert.equal(forwardedList[0].forwarded, true);
  assert.equal(forwardedList[0].text, original.text);
});

await check('message and conversation reports land in the review queue', async () => {
  const bad = (await msgsIn(conversation.id))[0];
  await reportMessage({ message: { ...bad, senderId: BOB }, reporterId: ALICE, reason: 'Spam or scam' });
  await reportConversation({ conversation: secondConversation, reporterId: ALICE, reason: 'Harassment' });
  assert.equal(reports().length, 2);
  assert.equal(reports()[0].type, 'message');
  assert.ok(reports()[0].targetId);
  await assert.rejects(
    () => reportMessage({ message: bad, reporterId: ALICE, reason: '' }),
    /choose a reason/
  );
});

await check('typing flags write per-user nested fields', async () => {
  await setConversationTyping(conversation.id, ALICE, true);
  let doc = await getConversation(conversation.id);
  assert.ok(doc.typing?.[ALICE], 'typing map should hold a timestamp for Alice');
  await setConversationTyping(conversation.id, ALICE, false);
  doc = await getConversation(conversation.id);
  assert.equal(doc.typing?.[ALICE], undefined, 'clearing must remove the flag');
});

await check('presence heartbeats and mute/block preferences persist', async () => {
  await setConversationPresence(conversation.id, ALICE);
  await setConversationMuted(conversation.id, ALICE, true);
  await setConversationBlocked(conversation.id, ALICE, true);
  const doc = await getConversation(conversation.id);
  assert.ok(U.isPresenceRecent(doc.presence?.[ALICE]));
  assert.equal(doc.muted?.[ALICE], true);
  assert.equal(doc.blockedBy?.[ALICE], true);
});

await check('clearing wipes every message and resets the preview', async () => {
  const before = (await msgsIn(conversation.id)).length;
  const count = await clearConversation(conversation.id);
  assert.equal(count, before, 'every message should have been removed');
  assert.equal((await msgsIn(conversation.id)).length, 0);
  const doc = await getConversation(conversation.id);
  assert.equal(doc.lastMessage, '');
});

// ===========================================================================
console.log('\nFLOW M2 — GROUP MESSAGING & ADMIN CONTROLS');
// ===========================================================================
resetStore();

let group;
await check('creating a group seeds the membership mirror and admin list', async () => {
  group = await createGroup({ creatorId: ALICE, name: 'Lusaka Wholesale', visibility: 'public' });
  assert.deepEqual(group.adminIds, [ALICE]);
  assert.deepEqual(group.memberIds, [ALICE]);
  assert.equal(group.memberCount, 1);
  assert.equal(group.permissions.whoCanSend, 'all');
});

await check('joining updates members, mirror and count together', async () => {
  await joinGroup(group.id, BOB, { name: 'Bob' });
  const refreshed = await getGroup(group.id);
  const members = await getGroupMembers(group.id);
  assert.equal(members.length, 2);
  assert.deepEqual(refreshed.memberIds.sort(), [ALICE, BOB].sort());
  assert.equal(refreshed.memberCount, 2);
});

await check('group messages carry receipts and sync the group preview', async () => {
  const message = await sendGroupMessage({
    groupId: group.id, senderId: BOB, senderName: 'Bob', text: 'Maize at 320 today',
  });
  assert.deepEqual(message.readBy, [BOB]);
  const refreshed = await getGroup(group.id);
  assert.equal(refreshed.lastMessage, 'Maize at 320 today');
  const list = await getGroupMessages(group.id);
  assert.equal(list.length, 1);
  // Cross-collection receipt reuse: group messages mark read the same way.
  await markMessagesRead(list, ALICE);
  const after = await getGroupMessages(group.id);
  assert.ok(after[0].readBy.includes(ALICE));
});

await check('non-admins cannot manage members — the guard throws', async () => {
  const members = await getGroupMembers(group.id);
  const bobMember = members.find((m) => m.uid === BOB);
  await assert.rejects(
    () => addGroupMember({ ...group, id: group.id }, CAROL, { addedBy: BOB }),
    /Only group admins/
  );
  await assert.rejects(
    () => removeGroupMember({ ...group, id: group.id }, bobMember, BOB),
    /Only group admins/
  );
  await assert.rejects(
    () => promoteToAdmin({ ...group, id: group.id }, bobMember, BOB),
    /Only group admins/
  );
});

await check('admins add, promote, demote and remove members', async () => {
  await addGroupMember(group, CAROL, { name: 'Carol', addedBy: ALICE });
  let members = await getGroupMembers(group.id);
  const carol = members.find((m) => m.uid === CAROL);
  assert.ok(carol, 'Carol should be an active member');

  await promoteToAdmin(group, carol, ALICE);
  let refreshed = await getGroup(group.id);
  assert.ok(refreshed.adminIds.includes(CAROL));

  await demoteFromAdmin(group, { ...carol, role: 'admin' }, ALICE);
  refreshed = await getGroup(group.id);
  assert.ok(!refreshed.adminIds.includes(CAROL));

  await removeGroupMember(group, carol, ALICE);
  members = await getGroupMembers(group.id);
  assert.ok(!members.some((m) => m.uid === CAROL));
  refreshed = await getGroup(group.id);
  assert.ok(!refreshed.memberIds.includes(CAROL));
  assert.equal(refreshed.memberCount, 2);
});

await check('the group creator cannot be demoted', async () => {
  const members = await getGroupMembers(group.id);
  const aliceMember = members.find((m) => m.uid === ALICE);
  await assert.rejects(
    () => demoteFromAdmin(group, aliceMember, ALICE),
    /creator cannot be demoted/
  );
});

await check('settings and announcements are admin-gated', async () => {
  await updateGroupSettings(group, { description: 'Bulk trading', permissions: { whoCanSend: 'admins' } }, ALICE);
  let refreshed = await getGroup(group.id);
  assert.equal(refreshed.description, 'Bulk trading');
  assert.equal(refreshed.permissions.whoCanSend, 'admins');

  await setGroupAnnouncement(group, 'Market day moved to Saturday', ALICE);
  refreshed = await getGroup(group.id);
  assert.equal(refreshed.announcement.text, 'Market day moved to Saturday');

  const bobMember = (await getGroupMembers(group.id)).find((m) => m.uid === BOB);
  await assert.rejects(
    () => updateGroupSettings(group, { name: 'Hijacked' }, BOB),
    /Only group admins/
  );
  await setMemberGroupMuted(bobMember, true);
  const mutedMember = (await getGroupMembers(group.id)).find((m) => m.uid === BOB);
  assert.equal(mutedMember.muted, true);
});

await check('group typing/presence maps are per-user', async () => {
  await setGroupTyping(group.id, BOB, true);
  await setGroupPresence(group.id, BOB);
  const refreshed = await getGroup(group.id);
  assert.ok(refreshed.typing?.[BOB]);
  assert.ok(U.isPresenceRecent(refreshed.presence?.[BOB]));
  assert.equal(U.typingNames(refreshed.typing, BOB, () => 'Bob').length, 0, 'own typing is never shown');
  assert.equal(U.typingNames(refreshed.typing, ALICE, (uid) => (uid === BOB ? 'Bob' : '?')).length, 1);
});

await check('leaving removes membership; the last admin is reassigned', async () => {
  // Bob is a regular member, Alice (creator) is the only admin.
  await joinGroup(group.id, CAROL, { name: 'Carol' }); // rejoin after earlier removal
  await leaveGroup(group.id, BOB);
  let members = await getGroupMembers(group.id);
  assert.ok(!members.some((m) => m.uid === BOB && m.status === 'active'));

  // Now the CREATOR leaves — Carol must be promoted so the group keeps an admin.
  await leaveGroup(group.id, ALICE);
  const refreshed = await getGroup(group.id);
  assert.ok(refreshed.adminIds.includes(CAROL), 'Carol should inherit admin');
  assert.ok(!refreshed.memberIds.includes(ALICE));
});

await check('groups can be reported', async () => {
  await reportGroup({ group, reporterId: BOB, reason: 'Spam or scam' });
  assert.equal(reports().length, 1);
  assert.equal(reports()[0].type, 'group');
});

// ===========================================================================
console.log('\nFLOW M3 — FIXED-LAYOUT UI HELPERS (utils/chat.js)');
// ===========================================================================

const T0 = new Date('2026-09-03T10:00:00');
const T0_LATER = new Date('2026-09-03T11:30:00');
const YESTERDAY = new Date('2026-09-02T18:00:00');
const stamp = (date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 });

await check('day separators group Today / Yesterday with labels', () => {
  const groups = U.groupMessagesByDay(
    [
      { id: '1', createdAt: stamp(YESTERDAY) },
      { id: '2', createdAt: stamp(YESTERDAY) },
      { id: '3', createdAt: stamp(T0) },
      { id: '4', createdAt: stamp(T0_LATER) },
    ],
    T0_LATER
  );
  assert.equal(groups.length, 2);
  assert.equal(groups[0].label, 'Yesterday');
  assert.equal(groups[1].label, 'Today');
  assert.equal(groups[1].messages.length, 2);
});

await check('the unread divider only appears once something older was read', () => {
  const list = [
    { id: 'a', senderId: BOB, readBy: [ALICE] },
    { id: 'b', senderId: BOB, readBy: [ALICE] },
    { id: 'c', senderId: BOB, readBy: [BOB] },
    { id: 'd', senderId: ALICE, readBy: [ALICE] },
  ];
  assert.equal(U.findUnreadDividerIndex(list, ALICE), 2, 'divider sits before the first unread incoming message');
  const allUnread = [
    { id: 'a', senderId: BOB, readBy: [BOB] },
    { id: 'b', senderId: BOB, readBy: [BOB] },
  ];
  assert.equal(U.findUnreadDividerIndex(allUnread, ALICE), -1, 'a brand-new thread shows no divider');
  const noneUnread = [{ id: 'a', senderId: BOB, readBy: [ALICE, BOB] }];
  assert.equal(U.findUnreadDividerIndex(noneUnread, ALICE), -1);
});

await check('delivery ticks progress sent → delivered → read', () => {
  const base = { senderId: ALICE, deleted: false };
  assert.equal(U.deliveryStatus({ ...base, readBy: [ALICE] }, ALICE, [BOB]), 'sent');
  assert.equal(
    U.deliveryStatus({ ...base, readBy: [ALICE], deliveredTo: [ALICE, BOB] }, ALICE, [BOB]),
    'delivered'
  );
  assert.equal(
    U.deliveryStatus({ ...base, readBy: [ALICE, BOB], deliveredTo: [ALICE, BOB] }, ALICE, [BOB]),
    'read'
  );
  assert.equal(U.deliveryStatus({ ...base, senderId: BOB }, ALICE, [BOB]), 'none');
});

await check('mentions highlight member names and detect self-mentions', () => {
  const members = ['Bob', 'Carol'];
  assert.ok(U.mentionsUser('Hey @Bob, check this', ['Bob']));
  assert.ok(!U.mentionsUser('Hey Bob, no symbol', ['Bob']));
  assert.ok(!U.mentionsUser('@Bobby', ['Bob']), 'prefix names must not half-match');
  const segments = U.splitMentions('Hi @Carol — see the invoice', members);
  const mention = segments.find((s) => s.mention);
  assert.ok(mention);
  assert.equal(mention.text, '@Carol');
});

await check('in-conversation search matches text and file names, skipping deleted', () => {
  const list = [
    { id: '1', text: 'The quotation is ready', type: 'text' },
    { id: '2', text: '', mediaName: 'invoice-204.pdf', type: 'file' },
    { id: '3', text: 'quotation revised', type: 'text', deleted: true },
  ];
  const hits = U.searchMessages(list, 'quotation');
  assert.equal(hits.length, 1);
  const files = U.searchMessages(list, 'invoice');
  assert.equal(files.length, 1);
  assert.equal(files[0].id, '2');
});

await check('media / starred / pinned panel filters behave', () => {
  const list = [
    { id: '1', type: 'image', mediaUrl: 'x' },
    { id: '2', type: 'video', mediaUrl: 'y' },
    { id: '3', type: 'file', mediaName: 'doc.pdf' },
    { id: '4', type: 'text', text: 'hi', starredBy: [ALICE] },
    { id: '5', type: 'text', text: 'pinned one', pinned: true },
  ];
  assert.equal(U.mediaMessages(list).length, 2);
  assert.equal(U.fileMessages(list).length, 1);
  assert.equal(U.starredBy(list, ALICE).length, 1);
  assert.equal(U.pinnedMessages(list).length, 1);
});

await check('formatting helpers stay stable', () => {
  assert.equal(U.formatDuration(95), '1:35');
  assert.equal(U.formatDuration(0), '0:00');
  assert.equal(U.formatBytes(1536), '1.5 KB');
  assert.equal(U.formatBytes(3 * 1024 * 1024), '3.0 MB');
  const bars = U.voiceBars('msg-1');
  assert.equal(bars.length, 28);
  assert.equal(bars.length, U.voiceBars('msg-1').length, 'waveform must be deterministic');
  assert.match(U.mapsLink({ lat: -15.4, lng: 28.2 }), /google\.com\/maps/);
});

await check('message previews cover every attachment type', () => {
  assert.equal(U.messagePreview({ type: 'image', text: '' }), '📷 Photo');
  assert.equal(U.messagePreview({ type: 'voice' }), '🎤 Voice message');
  assert.equal(U.messagePreview({ type: 'file', mediaName: 'price-list.pdf' }), '📎 price-list.pdf');
  assert.equal(U.messagePreview({ type: 'location' }), '📍 Location');
  assert.equal(U.messagePreview({ type: 'sticker', text: '🎉' }), '🎬 Sticker 🎉');
  assert.equal(U.messagePreview({ type: 'image', text: 'New stock' }), '📷 Photo New stock');
});

console.log(`\n${passed} assertions passed.`);
