// Group administration verification — photo, name and description.
//
// Runs the REAL group service against the in-memory Firestore mock, so the
// authorization rules ("only authorized admins may change group information")
// and the no-duplicate-record guarantee are exercised end to end.
import assert from 'node:assert/strict';

const {
  createGroup,
  getGroup,
  joinGroup,
  updateGroupPhoto,
  updateGroupDescription,
  updateGroupSettings,
  promoteToAdmin,
  getGroupMembers,
} = await import('../src/services/groupService.js');
const { queryOnce } = await import('../src/services/_base.js');
const { COLLECTIONS } = await import('../src/utils/constants.js');

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const ADMIN = 'admin-uid';
const MEMBER = 'member-uid';

async function freshGroup() {
  const group = await createGroup({
    creatorId: ADMIN,
    name: 'Seedwel Traders',
    description: 'Original description',
    image: '',
  });
  await joinGroup(group.id, MEMBER, { name: 'Regular Member' });
  return getGroup(group.id);
}

console.log('\nGROUP INFORMATION — ADMIN CONTROLS');

await check('a new group carries name, photo slot and description', async () => {
  const group = await freshGroup();
  assert.equal(group.name, 'Seedwel Traders');
  assert.equal(group.description, 'Original description');
  assert.equal(group.image, '');
  assert.ok(group.adminIds.includes(ADMIN));
});

await check('an admin can change the group photo', async () => {
  const group = await freshGroup();
  await updateGroupPhoto(group, 'https://cdn.example/photo.jpg', ADMIN);
  const updated = await getGroup(group.id);
  assert.equal(updated.image, 'https://cdn.example/photo.jpg');
});

await check('changing the photo does NOT create a duplicate group record', async () => {
  const group = await freshGroup();
  const before = (await queryOnce(COLLECTIONS.GROUPS, [])).length;
  await updateGroupPhoto(group, 'https://cdn.example/new.jpg', ADMIN);
  const after = (await queryOnce(COLLECTIONS.GROUPS, [])).length;
  assert.equal(after, before, 'the group document must be patched in place');
  const updated = await getGroup(group.id);
  assert.equal(updated.id, group.id);
});

await check('a regular member cannot change the group photo', async () => {
  const group = await freshGroup();
  await assert.rejects(
    () => updateGroupPhoto(group, 'https://cdn.example/hacked.jpg', MEMBER),
    /Only group admins/
  );
  const unchanged = await getGroup(group.id);
  assert.equal(unchanged.image, '');
});

await check('an admin can edit the group description', async () => {
  const group = await freshGroup();
  await updateGroupDescription(group, 'This group is for Seedwel Hub sellers and buyers.', ADMIN);
  const updated = await getGroup(group.id);
  assert.equal(updated.description, 'This group is for Seedwel Hub sellers and buyers.');
});

await check('the description persists (stored on the group document)', async () => {
  const group = await freshGroup();
  await updateGroupDescription(group, 'Persisted text', ADMIN);
  const reloaded = await getGroup(group.id);
  assert.equal(reloaded.description, 'Persisted text');
});

await check('the description is length-capped', async () => {
  const group = await freshGroup();
  await updateGroupDescription(group, 'x'.repeat(600), ADMIN);
  const updated = await getGroup(group.id);
  assert.equal(updated.description.length, 300);
});

await check('a regular member cannot edit the description', async () => {
  const group = await freshGroup();
  await assert.rejects(
    () => updateGroupDescription(group, 'member text', MEMBER),
    /Only group admins/
  );
});

await check('an admin can rename the group', async () => {
  const group = await freshGroup();
  await updateGroupSettings(group, { name: 'Renamed Group' }, ADMIN);
  const updated = await getGroup(group.id);
  assert.equal(updated.name, 'Renamed Group');
});

await check('a regular member cannot rename the group', async () => {
  const group = await freshGroup();
  await assert.rejects(
    () => updateGroupSettings(group, { name: 'Hijacked' }, MEMBER),
    /Only group admins/
  );
  assert.equal((await getGroup(group.id)).name, 'Seedwel Traders');
});

await check('a promoted member gains the admin controls', async () => {
  const group = await freshGroup();
  const members = await getGroupMembers(group.id);
  const target = members.find((m) => m.uid === MEMBER);
  await promoteToAdmin(group, target, ADMIN);
  const promotedGroup = await getGroup(group.id);
  await updateGroupDescription(promotedGroup, 'Set by the new admin', MEMBER);
  assert.equal((await getGroup(group.id)).description, 'Set by the new admin');
});

await check('the photo update records who changed it and when', async () => {
  const group = await freshGroup();
  await updateGroupPhoto(group, 'https://cdn.example/audit.jpg', ADMIN);
  const updated = await getGroup(group.id);
  assert.equal(updated.photoUpdatedBy, ADMIN);
  assert.ok(updated.photoUpdatedAt);
});

console.log(`\n${passed} assertions passed.`);
