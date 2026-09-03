import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// ---------------------------------------------------------------------------
// ChatWorkspace integration — the real workspace component, the real service
// layer, the in-memory Firestore, a real jsdom DOM.
//
// This proves the *whole* fixed-layout messaging frame wires together:
//   • mounting locks the page body (chat-workspace-open) and unmounting frees it
//   • the fixed header, scrollable message list and fixed composer all render
//   • typing into the composer and sending creates a real stored message
//   • the reply flow links the new message to the original
//   • the ☰ drawer lists the user's conversations
//   • a thread with unread history opens ON the unread divider and keeps the
//     messages below unread until the viewer returns to the latest message
//   • ⋮ menus offer notification settings; non-admin group members can mute
//   • @mention suggestions are keyboard-navigable (arrows + Enter)
// ---------------------------------------------------------------------------

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  virtualConsole: new (await import('jsdom')).VirtualConsole(),
});
dom.window.scrollTo = () => {};
// jsdom does not implement scroll methods on elements (browsers do).
dom.window.Element.prototype.scrollTo = function scrollTo() {};
dom.window.Element.prototype.focus = dom.window.Element.prototype.focus;
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.getComputedStyle = dom.window.getComputedStyle;
// Effects inside bundled components resolve bare rAF/CSS against the Node
// global scope, so they must be pointed at the jsdom implementations.
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.CSS = dom.window.CSS || { escape: (v) => String(v).replace(/[^\w-]/g, '\\$&') };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { resetStore, store } from './firestore-mock.mjs';

const realError = console.error;
console.error = (...args) => {
  const noise = /Not implemented|React Router Future Flag|useLayoutEffect|Warning: An update/;
  if (noise.test(String(args[0]))) return;
  realError(...args);
};

const C = await import('../src/utils/constants.js');
const { findOrCreateConversation, sendMessage, markMessagesRead } =
  await import('../src/services/messageService.js');
const { createGroup, joinGroup, sendGroupMessage } = await import('../src/services/groupService.js');
const { readReceiptLabel } = await import('../src/utils/chat.js');
const { AuthContext } = await import('../src/contexts/AuthContext.jsx');
const { ToastProvider } = await import('../src/contexts/ToastContext.jsx');
const { default: ChatWorkspace } = await import('../src/components/chat/ChatWorkspace.jsx');

const ALICE = 'user_alice';
const BOB = 'user_bob';

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function flush(ms = 60) {
  await act(async () => { await sleep(ms); });
}

function mountWorkspace(mode, id) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        React.createElement(
          ToastProvider,
          null,
          React.createElement(
            AuthContext.Provider,
            { value: { user: { uid: ALICE }, profile: { name: 'Alice' }, loading: false } },
            React.createElement(ChatWorkspace, { mode, id })
          )
        )
      )
    );
  });
  return { root, host };
}

const click = (el) => act(() => { el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })); });
// Native value-setter + dispatched 'input' events do not reach React's
// delegated listeners in this jsdom/SSR combination, so typing is driven
// through React's own Simulate (exactly what the DOM Testing Library does).
const typeInto = (el, value, { caret } = {}) => {
  const target = { value };
  if (caret != null) {
    target.selectionStart = caret;
    target.selectionEnd = caret;
  }
  act(() => { Simulate.change(el, { target }); });
};

const messagesInStore = () => [...(store.get(C.COLLECTIONS.MESSAGES)?.values() || [])];

// ===========================================================================
console.log('\nCHAT WORKSPACE — DIRECT CONVERSATION (integration mount)');
// ===========================================================================
resetStore();

const conversation = await findOrCreateConversation(ALICE, BOB, {
  meta: { [`displayName_${ALICE}`]: 'Alice', [`displayName_${BOB}`]: 'Bob' },
});
const seed1 = await sendMessage({ conversationId: conversation.id, senderId: BOB, senderName: 'Bob', text: 'I will send the quotation tomorrow.' });
await sendMessage({ conversationId: conversation.id, senderId: ALICE, senderName: 'Alice', text: 'Great, thanks!' });
// Bob's message arrives unread; simulate Alice having read the first one only.
await markMessagesRead([seed1], ALICE);

let mounted;
await flush(0);
mounted = mountWorkspace('direct', conversation.id);
await flush(150);

check('mounting locks the page body into the fixed chat workspace', () => {
  assert.ok(document.body.classList.contains('chat-workspace-open'), 'body must carry chat-workspace-open');
});

check('fixed header shows name, status, calls and more-options', () => {
  const html = document.body.innerHTML;
  assert.match(html, /Bob/);
  assert.match(html, /aria-label="Voice call"/);
  assert.match(html, /aria-label="Video call"/);
  assert.match(html, /aria-label="More options"/);
  assert.match(html, /aria-label="Open conversations menu"/);
});

check('message list is the scroll container with day divider and messages', () => {
  const html = document.body.innerHTML;
  assert.match(html, /role="log"/);
  assert.match(html, /Today/);
  assert.match(html, /I will send the quotation tomorrow\./);
  // The viewer lands at the bottom, so the workspace marks incoming messages
  // read immediately — the unread divider must therefore be gone by now.
  assert.ok(!/New messages/.test(html), 'divider clears once opened at the bottom');
});

check('composer is present with emoji, attach and hold-to-record', () => {
  const html = document.body.innerHTML;
  assert.match(html, /aria-label="Insert emoji"/);
  assert.match(html, /aria-label="Attach"/);
  assert.match(html, /aria-label="Hold to record a voice message"/);
  assert.match(html, /Type a message/);
});

check('own message shows a delivery tick with a receipt tooltip', () => {
  const html = document.body.innerHTML;
  assert.match(html, /chat-ticks/);
  // Bob's client never fetched, so Alice's own message is still "Sent".
  assert.match(html, /title="Sent"/, 'tick must carry its receipt tooltip');
});

await check('typing + send creates a stored message and clears the composer', async () => {
  const textarea = document.querySelector('.chat-composer__input');
  assert.ok(textarea, 'composer input should exist');
  typeInto(textarea, 'Integration hello!');
  await flush(20);
  const sendBtn = document.querySelector('button[aria-label="Send message"]');
    assert.ok(sendBtn, 'send button must replace the mic while typing');
  click(sendBtn);
  await flush(120);
  const stored = messagesInStore().find((m) => m.text === 'Integration hello!');
  assert.ok(stored, 'message should be persisted through the real service layer');
  assert.equal(stored.senderName, 'Alice');
  assert.equal(stored.conversationId, conversation.id);
  assert.equal(document.querySelector('.chat-composer__input').value, '', 'composer clears after send');
});

await check('reply flow links the new message to the original', async () => {
  const menuBtn = document.querySelector('[data-message-id] button[aria-label="Message options"]');
  assert.ok(menuBtn, 'each message exposes its action menu');
  click(menuBtn);
  await flush(30);
  const replyItem = [...document.querySelectorAll('.chat-menu__item')].find((b) => /Reply/.test(b.textContent));
  assert.ok(replyItem, 'Reply action is offered');
  click(replyItem);
  await flush(30);
  assert.match(document.body.innerHTML, /Replying to Bob/);

  const textarea = document.querySelector('.chat-composer__input');
  typeInto(textarea, 'Replying to your quotation note');
  await flush(20);
  click(document.querySelector('button[aria-label="Send message"]'));
  await flush(120);
  const stored = messagesInStore().find((m) => m.text === 'Replying to your quotation note');
  assert.ok(stored, 'reply message stored');
  assert.ok(stored.replyTo, 'reply must reference the original message id');
  assert.match(document.body.innerHTML, /↩️ Bob/); // quoted block on the new bubble
});

await check('⋮ header menu lists search, media, starred, pinned and safety items', async () => {
  const more = document.querySelector('button[aria-label="More options"]');
  click(more);
  await flush(30);
  const labels = [...document.querySelectorAll('.chat-menu__item .chat-menu__label')].map((b) => b.textContent);
  for (const expected of ['Search', 'Media & files', 'Starred messages', 'Pinned messages', 'Clear conversation', 'Conversation settings']) {
    assert.ok(labels.includes(expected), `menu should offer “${expected}”`);
  }
  click(document.querySelector('.chat-menu__item')); // open the first (Search)
  await flush(30);
  assert.match(document.body.innerHTML, /Search within conversation/);
});

await check('in-conversation search highlights and lists hits', async () => {
  const input = document.querySelector('.chat-aside__search');
  assert.ok(input, 'search panel input renders');
  typeInto(input, 'quotation');
  await flush(30);
  assert.match(document.body.innerHTML, /I will send the quotation tomorrow\./);
  assert.match(document.body.innerHTML, /chat-search-hit|chat-aside__result/);
});

await check('⋮ menu offers a Notifications entry opening the settings sheet', async () => {
  const close = document.querySelector('.chat-aside__close');
  if (close) click(close);
  await flush(20);
  const more = document.querySelector('button[aria-label="More options"]');
  click(more);
  await flush(30);
  const labels = [...document.querySelectorAll('.chat-menu__item .chat-menu__label')].map((b) => b.textContent);
  assert.ok(labels.includes('Notifications'), `direct ⋮ menu should offer “Notifications” (has: ${labels.join(', ')})`);
  const item = [...document.querySelectorAll('.chat-menu__item')].find((b) =>
    b.querySelector('.chat-menu__label')?.textContent === 'Notifications'
  );
  click(item);
  await flush(30);
  const html = document.body.innerHTML;
  assert.match(html, /Conversation settings/, 'settings sheet opens from the Notifications entry');
  assert.match(html, /Notifications/, 'sheet shows the notification state');
  const closeSheet = document.querySelector('.chat-aside__close');
  if (closeSheet) click(closeSheet);
  await flush(20);
});

await check('☰ drawer lists the user’s conversations', async () => {
  click(document.querySelector('button[aria-label="Open conversations menu"]'));
  await flush(60);
  const html = document.body.innerHTML;
  assert.match(html, /Conversations/);
  assert.match(html, /Bob/);
  // close it again
  const close = document.querySelector('.drawer__close');
  if (close) click(close);
  await flush(30);
});

// Unmount → the body lock must be released.
act(() => mounted.root.unmount());
mounted.host.remove();
await flush(20);

check('unmounting frees the page body again', () => {
  assert.ok(!document.body.classList.contains('chat-workspace-open'));
});

// ===========================================================================
console.log('\nCHAT WORKSPACE — GROUP (integration mount)');
// ===========================================================================
resetStore();

const group = await createGroup({ creatorId: BOB, name: 'Lusaka Wholesale Club', visibility: 'public' });
// The creator's auto-generated membership carries no display name — set one,
// as profile-carrying clients would.
for (const m of store.get(C.COLLECTIONS.GROUP_MEMBERS).values()) {
  if (m.uid === BOB) m.name = 'Bob';
}
await joinGroup(group.id, ALICE, { name: 'Alice' });
await joinGroup(group.id, 'user_carol', { name: 'Carol' });
await sendGroupMessage({ groupId: group.id, senderId: BOB, senderName: 'Bob', text: 'Meeting at 10 on Saturday.' });

mounted = mountWorkspace('group', group.id);
await flush(150);

check('group header shows member count and the same fixed action bar', () => {
  const html = document.body.innerHTML;
  assert.match(html, /Lusaka Wholesale Club/);
  assert.match(html, /3 members/);
  assert.match(html, /aria-label="Voice call"/);
  assert.match(html, /Meeting at 10 on Saturday\./);
});

await check('group members can open the members panel with admin badges', async () => {
  const more = document.querySelector('button[aria-label="More options"]');
  click(more);
  await flush(30);
  const membersItem = [...document.querySelectorAll('.chat-menu__item')].find((b) => /Members/.test(b.textContent));
  assert.ok(membersItem, 'Members entry exists in the group ⋮ menu');
  click(membersItem);
  await flush(50);
  const html = document.body.innerHTML;
  assert.match(html, /Group members/);
  assert.match(html, /🛡 Admin/);
  assert.match(html, /Alice/);
});

await check('mention suggestions appear while composing in a group', async () => {
  const textarea = document.querySelector('.chat-composer__input');
  typeInto(textarea, 'Ping @Bo', { caret: 10 });
  await flush(40);
  const suggestions = [...document.querySelectorAll('.chat-mentions__item')].map((b) => b.textContent);
  assert.ok(suggestions.length >= 1, 'group member Bob should be suggested for @Bo');
  assert.ok(suggestions.join(' ').includes('Bob'));
});

await check('mention suggestions are keyboard-navigable (↓ moves, Enter applies)', async () => {
  const textarea = document.querySelector('.chat-composer__input');
  typeInto(textarea, 'Ping @', { caret: 6 });
  await flush(40);
  const items = [...document.querySelectorAll('.chat-mentions__item')];
  assert.ok(items.length >= 2, 'an empty @ query suggests every member');
  const names = items.map((b) => b.querySelectorAll('span')[1]?.textContent || '');
  act(() => { Simulate.keyDown(textarea, { key: 'ArrowDown' }); });
  await flush(20);
  assert.equal(items[0].getAttribute('aria-selected'), 'false', 'first suggestion loses the highlight');
  assert.equal(items[1].getAttribute('aria-selected'), 'true', 'second suggestion is highlighted after ↓');
  act(() => { Simulate.keyDown(textarea, { key: 'Enter' }); });
  await flush(30);
  assert.ok(
    textarea.value.includes(`@${names[1]}`),
    `Enter must apply the highlighted suggestion (@${names[1]}), got “${textarea.value}”`
  );
  assert.ok(!textarea.value.includes(`@${names[0]}`), 'the unhighlighted suggestion must not be applied');
  const submitted = messagesInStore().find((m) => /Ping @/.test(m.text || ''));
  assert.ok(!submitted, 'Enter on a highlighted mention must not submit the message');
});

await check('group ⋮ menu lists Group info and Group notification settings', async () => {
  const more = document.querySelector('button[aria-label="More options"]');
  click(more);
  await flush(30);
  const labels = [...document.querySelectorAll('.chat-menu__item .chat-menu__label')].map((b) => b.textContent);
  for (const expected of ['Group info', 'Group notification settings', 'Add members', 'Group settings', 'Group announcement', 'Group permissions', 'Leave group', 'Report group']) {
    assert.ok(labels.includes(expected), `group ⋮ menu should offer “${expected}”`);
  }
  const infoItem = [...document.querySelectorAll('.chat-menu__item')].find((b) => /Group info/.test(b.textContent));
  click(infoItem);
  await flush(30);
  assert.match(document.body.innerHTML, /Group info/, 'Group info entry opens the info panel');
  const close = document.querySelector('.chat-aside__close');
  if (close) click(close);
  await flush(20);
});

await check('non-admin members can mute their own group notifications', async () => {
  const more = document.querySelector('button[aria-label="More options"]');
  click(more);
  await flush(30);
  const item = [...document.querySelectorAll('.chat-menu__item')].find((b) =>
    /Group notification settings/.test(b.textContent)
  );
  assert.ok(item, 'Group notification settings entry exists');
  click(item);
  await flush(40);
  const html = document.body.innerHTML;
  assert.match(html, /Your notifications/, 'personal notification block renders for non-admins');
  assert.match(html, /Only group admins can change group settings/, 'group configuration stays admin-gated');
  const muteBtn = [...document.querySelectorAll('.chat-aside__body button')].find((b) =>
    /Mute notifications/.test(b.textContent)
  );
  assert.ok(muteBtn, 'mute control is available to every member');
  click(muteBtn);
  await flush(220);
  assert.match(
    document.body.innerHTML,
    /Unmute notifications/,
    'the control flips once the group is muted for this member'
  );
});

check('group receipt labels describe how many members read a message', () => {
  const msg = { senderId: ALICE, readBy: [ALICE, BOB], deliveredTo: [ALICE, BOB, 'user_carol'] };
  assert.equal(readReceiptLabel(msg, ALICE, [BOB, 'user_carol']), 'Read by 1 of 2');
  const fresh = { senderId: ALICE, readBy: [ALICE], deliveredTo: [ALICE, BOB] };
  assert.equal(readReceiptLabel(fresh, ALICE, [BOB, 'user_carol']), 'Delivered to 1 of 2');
});

act(() => mounted.root.unmount());
mounted.host.remove();
await flush(20);

// ===========================================================================
console.log('\nCHAT WORKSPACE — UNREAD PLACEMENT & RETURN TO LATEST');
// ===========================================================================
resetStore();

const unreadConv = await findOrCreateConversation(ALICE, BOB, {
  meta: { [`displayName_${ALICE}`]: 'Alice', [`displayName_${BOB}`]: 'Bob' },
});
const readEarlier = await sendMessage({
  conversationId: unreadConv.id,
  senderId: BOB,
  senderName: 'Bob',
  text: 'Already read from earlier',
});
await sendMessage({ conversationId: unreadConv.id, senderId: ALICE, senderName: 'Alice', text: 'Thanks, noted' });
// Alice read the thread up to here…
await markMessagesRead([readEarlier], ALICE);
// …then Bob sent fresh messages while she was away, plus a location share.
await sendMessage({ conversationId: unreadConv.id, senderId: BOB, senderName: 'Bob', text: 'Fresh unread one' });
await sendMessage({
  conversationId: unreadConv.id,
  senderId: BOB,
  senderName: 'Bob',
  type: 'location',
  location: { lat: -15.3875, lng: 28.3228, label: 'Lusaka Depot' },
});
await sendMessage({ conversationId: unreadConv.id, senderId: BOB, senderName: 'Bob', text: 'Fresh unread two' });

mounted = mountWorkspace('direct', unreadConv.id);
// Two stages: the first lets the poll deliver + run the initial placement
// effect; the second lets the placement rAF land (act flushes queued updates
// at the end of its window, so the rAF fires one window later).
await flush(150);
await flush(80);

check('thread opens on the unread divider and keeps the messages below unread', () => {
  const divider = document.querySelector('.chat-unread-divider');
  assert.ok(divider, 'unread divider renders on open');
  const slot = divider.closest('.chat-body__slot');
  assert.ok(slot, 'divider sits inside a message slot');
  assert.match(slot.textContent, /Fresh unread one/, 'divider sits directly above the first unread message');
  const unread = messagesInStore().find((m) => m.text === 'Fresh unread one');
  assert.ok(unread, 'unread message exists in the store');
  assert.ok(
    !(unread.readBy || []).includes(ALICE),
    'opening on the divider must not mark the message read'
  );
  assert.match(document.body.innerHTML, /↓/, 'the ↓ return-to-latest pill is reachable from the divider');
});

check('location messages offer “Copy location” with their map link', () => {
  // Store documents are keyed by id (snapshots attach it) — read via entries.
  const entry = [...(store.get(C.COLLECTIONS.MESSAGES)?.entries() || [])].find(
    ([, m]) => m.type === 'location'
  );
  assert.ok(entry, 'location message seeded');
  const [locId] = entry;
  const node = document.querySelector(
    `[data-message-id="${CSS.escape(locId)}"] button[aria-label="Message options"]`
  );
  assert.ok(node, 'location bubble exposes its action menu');
  click(node);
  const copyItem = [...document.querySelectorAll('.chat-menu__item')].find((b) =>
    /Copy location/.test(b.textContent)
  );
  assert.ok(copyItem, 'Copy location action is offered');
  assert.ok(!copyItem.disabled, 'copy is enabled — the map link is copyable');
  click(copyItem); // close the menu again
});

await check('tapping ↓ returns to the latest message and marks the thread read', async () => {
  const pill = document.querySelector('.chat-jump-latest');
  assert.ok(pill, '↓ pill present while positioned on the divider');
  click(pill);
  await flush(150);
  await flush(120);
  const unread = messagesInStore().find((m) => m.text === 'Fresh unread one');
  assert.ok(
    (unread.readBy || []).includes(ALICE),
    'reaching the bottom marks the unread messages read'
  );
  assert.ok(!document.querySelector('.chat-unread-divider'), 'divider clears once everything is read');
});

act(() => mounted.root.unmount());
mounted.host.remove();
await flush(20);

console.log(`\n${passed} assertions passed.`);
