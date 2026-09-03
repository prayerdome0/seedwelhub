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

check('own message shows a delivery tick', () => {
  const html = document.body.innerHTML;
  assert.match(html, /chat-ticks/);
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
await sendGroupMessage({ groupId: group.id, senderId: BOB, senderName: 'Bob', text: 'Meeting at 10 on Saturday.' });

mounted = mountWorkspace('group', group.id);
await flush(150);

check('group header shows member count and the same fixed action bar', () => {
  const html = document.body.innerHTML;
  assert.match(html, /Lusaka Wholesale Club/);
  assert.match(html, /2 members/);
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

act(() => mounted.root.unmount());
mounted.host.remove();
await flush(20);

console.log(`\n${passed} assertions passed.`);
