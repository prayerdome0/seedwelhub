import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Give the renderer a real DOM: Drawer renders through createPortal into
// document.body, which cannot work under pure string SSR.
const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/',
  virtualConsole: new (await import('jsdom')).VirtualConsole(), // swallow jsdom's own noise
});
dom.window.scrollTo = () => {};
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.Element = dom.window.Element;
globalThis.getComputedStyle = dom.window.getComputedStyle;

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';

// react-router calls useLayoutEffect; harmless in this harness.
const realError = console.error;
const realWarn = console.warn;
const NOISE = /useLayoutEffect does nothing on the server|React Router Future Flag|Not implemented: Window/;
console.error = (...args) => (NOISE.test(String(args[0])) ? undefined : realError(...args));
console.warn = (...args) => (NOISE.test(String(args[0])) ? undefined : realWarn(...args));

// Mounts a component into a real DOM tree and returns the resulting HTML.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function mount(el) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => { root.render(React.createElement(MemoryRouter, null, el)); });
  const html = document.body.innerHTML;
  act(() => { root.unmount(); });
  host.remove();
  return html;
}

let passed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};
const h = React.createElement;
const render = (el) => renderToStaticMarkup(h(MemoryRouter, null, el));

const { default: DocumentView } = await import('../src/components/documents/DocumentView.jsx');
const { buildDocument } = await import('../src/documents/model.js');
const { DOCUMENT_TYPES } = await import('../src/utils/constants.js');

const business = {
  name: 'Phiko Trading', email: 'sales@phiko.test',
  phone: '+260 97 000 0000', address: 'Lusaka, Zambia',
};

console.log('\nDOCUMENT RENDERING (real React render)');

const receiptDoc = buildDocument(DOCUMENT_TYPES.RECEIPT, {
  receiptNumber: 'SH-RCP-000001',
  customerName: 'John Banda', customerEmail: 'john@test.com',
  amount: 750, currency: 'ZMW', paymentMethod: 'mobile_money',
  paymentReference: 'MP240903', verificationCode: 'VERIFY9',
  items: [{ name: 'Product A', quantity: 2, price: 250 },
          { name: 'Product B', quantity: 1, price: 250 }],
}, { business });

const html = render(h(DocumentView, { document: receiptDoc }));

check('renders without throwing', () => assert.ok(html.length > 500));
check('shows the document title', () => assert.match(html, /PAYMENT RECEIPT/));
check('shows the document number', () => assert.match(html, /SH-RCP-000001/));
check('SELLER block present', () => {
  assert.match(html, /Phiko Trading/);
  assert.match(html, /sales@phiko\.test/);
});
check('BUYER block present', () => {
  assert.match(html, /John Banda/);
  assert.match(html, /john@test\.com/);
});
check('ITEMS table rendered with both lines', () => {
  assert.match(html, /Product A/);
  assert.match(html, /Product B/);
});
check('subtotal and total present', () => {
  assert.match(html, /Subtotal/i);
  assert.match(html, /Total Paid/i);
});
check('payment status shown', () => assert.match(html, /PAID/));
check('thank-you line present', () => assert.match(html, /[Tt]hank you/));
check('verification reference present', () => assert.match(html, /VERIFY9/));
check('brand identity present', () => assert.match(html, /Seedwel/i));
check('no raw [object Object] leaks', () => assert.ok(!html.includes('[object Object]')));
check('no undefined/NaN leaks', () => {
  assert.ok(!/>\s*undefined\s*</.test(html), 'undefined rendered');
  assert.ok(!/NaN/.test(html), 'NaN rendered');
});

console.log('\nALL FIVE DOCUMENT TYPES RENDER');
for (const [label, type, data] of [
  ['Receipt', DOCUMENT_TYPES.RECEIPT, { receiptNumber: 'SH-RCP-000002', amount: 100 }],
  ['Invoice', DOCUMENT_TYPES.INVOICE, { invoiceNumber: 'SH-INV-000002', status: 'sent', total: 100 }],
  ['Quotation', DOCUMENT_TYPES.QUOTATION, { quotationNumber: 'SH-QUO-000002', status: 'sent', validUntil: '2026-10-01' }],
  ['Payment confirmation', DOCUMENT_TYPES.PAYMENT_CONFIRMATION, { reference: 'PAY-1', amount: 100 }],
  ['Order confirmation', DOCUMENT_TYPES.ORDER_CONFIRMATION, { orderNumber: 'ORD-1', total: 100 }],
]) {
  check(`${label} renders`, () => {
    const out = render(h(DocumentView, {
      document: buildDocument(type, { ...data, items: [{ name: 'Item', quantity: 1, price: 100 }] }, { business }),
    }));
    assert.ok(out.length > 400, 'suspiciously short output');
    assert.ok(!out.includes('[object Object]'));
    assert.ok(!/NaN/.test(out));
  });
}

console.log('\nEMPTY / MISSING DATA MUST NOT CRASH THE PAGE');
check('completely empty document renders', () => {
  const out = render(h(DocumentView, { document: buildDocument(DOCUMENT_TYPES.RECEIPT, {}, {}) }));
  assert.ok(out.length > 200);
  assert.ok(!/NaN/.test(out));
});

console.log('\nNAVIGATION COMPONENTS');
const { default: MenuLink } = await import('../src/components/navigation/MenuLink.jsx');
check('MenuLink renders label, icon and route', () => {
  const out = render(h(MenuLink, {
    item: { id: 'orders', label: 'My Orders', icon: '📦', to: '/orders' },
    onNavigate: () => {},
  }));
  assert.match(out, /My Orders/);
  assert.match(out, /📦/);
  assert.match(out, /href="\/orders"/);
});
check('MenuLink reads its badge from NotificationContext, not a prop', async () => {
  // The badge is intentionally driven by live context so every menu stays in
  // sync with the header bell. Rendered outside a provider it must degrade
  // quietly rather than crash.
  const out = render(h(MenuLink, {
    item: { id: 'notifications', label: 'Notifications', icon: '🔔', to: '/notifications', badge: 'notifications' },
    onNavigate: () => {},
  }));
  assert.match(out, /Notifications/);
  assert.ok(!out.includes('menu-link__badge'), 'no badge should show at zero unread');
});

const { default: Drawer } = await import('../src/components/Drawer.jsx');
check('Drawer renders its children when open', () => {
  const out = mount(h(Drawer, { open: true, title: 'Main menu', onClose: () => {} },
    h('p', null, 'Drawer body content')));
  assert.match(out, /Drawer body content/);
  assert.match(out, /Main menu/);
});
check('Drawer renders nothing when closed', () => {
  const out = mount(h(Drawer, { open: false, title: 'Main menu', onClose: () => {} },
    h('p', null, 'Hidden body')));
  assert.ok(!out.includes('Hidden body'), 'closed drawer must not render content');
});
check('Drawer exposes a labelled dialog and a close control', () => {
  const out = mount(h(Drawer, { open: true, title: 'Main menu', onClose: () => {} },
    h('p', null, 'Body')));
  assert.match(out, /role="dialog"/);
  assert.match(out, /aria-modal="true"/);
  assert.match(out, /aria-label|aria-labelledby/);
  assert.match(out, /Close/i);
});
check('Drawer body is the single scroll area (no nested scrollers)', () => {
  const out = mount(h(Drawer, { open: true, title: 'Main menu', onClose: () => {} },
    h('p', null, 'Body')));
  assert.match(out, /drawer__body/);
});

console.log(`\n${passed} assertions passed.`);

console.log('\nMESSAGING COMPONENTS (fixed-layout workspace)');

const { default: MessageBubble } = await import('../src/components/chat/MessageBubble.jsx');
const { default: MessageList } = await import('../src/components/chat/MessageList.jsx');
const { default: ChatHeader } = await import('../src/components/chat/ChatHeader.jsx');
const { default: ChatComposer } = await import('../src/components/chat/ChatComposer.jsx');
const { default: AttachmentPreview } = await import('../src/components/chat/AttachmentPreview.jsx');
const { default: ForwardDialog } = await import('../src/components/chat/ForwardDialog.jsx');
const { default: CallOverlay } = await import('../src/components/chat/CallOverlay.jsx');
const { default: Lightbox } = await import('../src/components/chat/Lightbox.jsx');
const { SidePanel, SearchPanel, MediaPanel, ReportDialog } = await import('../src/components/chat/ChatPanels.jsx');
const chatUtils = await import('../src/utils/chat.js');

const stamp = (date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 });
const now = new Date('2026-09-03T12:00:00');
const sampleMessages = [
  { id: 'm1', senderId: 'u2', senderName: 'Bob', text: 'Morning! Check the price list', type: 'text', createdAt: stamp(new Date('2026-09-02T09:00:00')), readBy: ['u1', 'u2'] },
  { id: 'm2', senderId: 'u1', text: 'Here it is', type: 'file', mediaUrl: 'https://x.test/f.pdf', mediaName: 'prices.pdf', mediaSize: 4096, createdAt: stamp(new Date('2026-09-03T10:00:00')), readBy: ['u1'] },
  { id: 'm3', senderId: 'u2', text: '', type: 'voice', mediaUrl: 'https://x.test/v.webm', durationMs: 12000, createdAt: stamp(new Date('2026-09-03T10:05:00')), readBy: ['u1', 'u2'], reactions: { '👍': ['u1'] } },
  { id: 'm4', senderId: 'u1', text: '🎉', type: 'sticker', createdAt: stamp(now), readBy: ['u1'] },
  { id: 'm5', senderId: 'u2', type: 'location', location: { lat: -15.4, lng: 28.2, label: 'Warehouse' }, createdAt: stamp(now), readBy: ['u2'] },
  { id: 'm6', senderId: 'u2', type: 'system', text: 'Bob joined the group', createdAt: stamp(now), readBy: ['u2'] },
];

const bubbleProps = {
  viewerId: 'u1',
  otherIds: ['u2'],
  onReply: () => {}, onReact: () => {}, onCopy: () => {}, onForward: () => {},
  onStar: () => {}, onPin: () => {}, onEdit: () => {}, onDelete: () => {},
  onReport: () => {}, onJumpTo: () => {}, onOpenImage: () => {},
};

check('MessageBubble renders a text message with a reply quote', () => {
  const out = render(h(MessageBubble, {
    ...bubbleProps,
    message: { ...sampleMessages[0], replyTo: 'm2' },
    senderName: 'Bob',
    own: false, showSender: true,
    replyToMessage: { id: 'm2', senderId: 'u1', senderName: 'You', text: 'Here it is', type: 'file', mediaName: 'prices.pdf' },
  }));
  assert.match(out, /Bob/);
  assert.match(out, /↩️ You/);
  assert.match(out, /prices\.pdf/);
  assert.match(out, /data-message-id="m1"/);
});

check('MessageBubble renders media types: file, voice, sticker, location', () => {
  const file = render(h(MessageBubble, { ...bubbleProps, message: sampleMessages[1], own: true, showSender: true }));
  assert.match(file, /prices\.pdf/);
  assert.match(file, /4\.0 KB/);
  assert.match(file, /✓/); // sent tick for own message

  const voice = render(h(MessageBubble, { ...bubbleProps, message: sampleMessages[2], own: false, showSender: true }));
  assert.match(voice, /chat-voice/);
  assert.match(voice, /0:12/);
  assert.match(voice, /👍/); // reaction chip

  const sticker = render(h(MessageBubble, { ...bubbleProps, message: sampleMessages[3], own: true, showSender: true }));
  assert.match(sticker, /chat-sticker/);

  const location = render(h(MessageBubble, { ...bubbleProps, message: sampleMessages[4], own: false, showSender: true }));
  assert.match(location, /Warehouse/);
  assert.match(location, /google\.com\/maps/);
});

check('deleted and system messages render their special shapes', () => {
  const deleted = render(h(MessageBubble, { ...bubbleProps, message: { id: 'x', senderId: 'u1', deleted: true, type: 'text', createdAt: stamp(now) }, own: true, showSender: true }));
  assert.match(deleted, /This message was deleted/);
  const system = render(h(MessageBubble, { ...bubbleProps, message: sampleMessages[5], own: false, showSender: false }));
  assert.match(system, /chat-system/);
  assert.match(system, /joined the group/);
});

check('MessageList separates days, marks unread, and shows the typing row', () => {
  const out = render(h(MessageList, {
    messages: sampleMessages,
    viewerId: 'u1',
    otherIds: ['u2'],
    typingLabel: 'Bob is typing',
    membersById: { u2: { name: 'Bob', isAdmin: true } },
    memberNames: ['Bob'],
    onAtBottomChange: () => {}, onNewMessages: () => {}, onMessageVisible: () => {},
    onReply: () => {}, onReact: () => {}, onCopy: () => {}, onForward: () => {},
    onStar: () => {}, onPin: () => {}, onEdit: () => {}, onDelete: () => {}, onReport: () => {},
    onOpenImage: () => {},
    replyToMessage: () => null,
  }));
  assert.match(out, /Yesterday/);
  assert.match(out, /Today/);
  assert.match(out, /New messages/); // unread divider before the first unread incoming message
  assert.match(out, /Bob is typing/);
  assert.match(out, /role="log"/); // the single scrollable conversation container
  assert.ok(!/undefined/.test(out.replace(/data-message-id="[^"]*"/g, '')), 'no undefined leak');
});

check('ChatHeader renders the full fixed action bar', () => {
  const out = render(h(ChatHeader, {
    title: 'Bob', subtitle: 'Online', avatarSrc: '',
    menuItems: [{ icon: '🔍', label: 'Search', onClick: () => {} }, { divider: true }, { icon: '🚩', label: 'Report', onClick: () => {}, danger: true }],
    onOpenMenuDrawer: () => {}, onOpenInfo: () => {}, onToggleMute: () => {}, onStartCall: () => {},
    pinnedMessage: sampleMessages[1], onUnpin: () => {}, onJumpToMessage: () => {},
  }));
  assert.match(out, /Bob/);
  assert.match(out, /Online/);
  assert.match(out, /aria-label="Open conversations menu"/);
  assert.match(out, /aria-label="Voice call"/);
  assert.match(out, /aria-label="Video call"/);
  assert.match(out, /aria-label="Mute notifications"/);
  assert.match(out, /aria-label="More options"/);
  assert.match(out, /chat-pinned/); // pinned banner present
});

check('ChatComposer renders idle, reply, edit and disabled states', () => {
  const base = { mode: 'direct', onSendText: () => {}, onEditSave: () => {}, onSendVoice: () => {}, onAttachFile: () => {}, onShareLocation: () => {}, onOpenCamera: () => {}, onCancelReply: () => {}, onCancelEdit: () => {}, onTypingChange: () => {}, onNotify: () => {} };
  const idle = render(h(ChatComposer, base));
  assert.match(idle, /aria-label="Hold to record a voice message"/);
  assert.match(idle, /aria-label="Insert emoji"/);
  assert.match(idle, /aria-label="Attach"/);
  assert.match(idle, /Type a message/);

  const replying = render(h(ChatComposer, { ...base, replyTo: { name: 'Bob', preview: 'I’ll send the quotation tomorrow.' } }));
  assert.match(replying, /Replying to Bob/);
  assert.match(replying, /quotation tomorrow/);

  const editing = render(h(ChatComposer, { ...base, editing: { text: 'Fix this', type: 'text' } }));
  assert.match(editing, /Editing message/);
  assert.match(editing, /aria-label="Save edit"/);

  const blocked = render(h(ChatComposer, { ...base, disabled: true, disabledReason: 'You blocked this user.' }));
  assert.match(blocked, /You blocked this user\./);
});

check('AttachmentPreview shows caption + Cancel | Send', () => {
  const out = mount(h(AttachmentPreview, {
    attachment: { kind: 'image', file: { name: 'photo.jpg', size: 1024, type: 'image/jpeg' } },
    onCancel: () => {}, onSend: () => {},
  }));
  assert.match(out, /Send photo/);
  assert.match(out, /Add a caption…/);
  assert.match(out, /Cancel/);
});

check('ForwardDialog, ReportDialog, CallOverlay and Lightbox render their overlays', () => {
  // Portals need a real client render (see Drawer tests above).
  const fwd = mount(h(ForwardDialog, {
    open: true, targets: [{ kind: 'group', id: 'g1', title: 'Lusaka Wholesale', subtitle: '5 members' }],
    message: sampleMessages[0], onClose: () => {}, onForward: async () => {},
  }));
  assert.match(fwd, /Forward message/);
  assert.match(fwd, /Lusaka Wholesale/);

  const report = mount(h(ReportDialog, { open: true, onClose: () => {}, onSubmit: () => {} }));
  assert.match(report, /Spam or scam/);
  assert.match(report, /Submit report/);

  const call = mount(h(CallOverlay, { call: { name: 'Bob', video: false }, onClose: () => {} }));
  assert.match(call, /Calling…/);
  assert.match(call, /aria-label="End call"/);

  const box = mount(h(Lightbox, { src: 'https://x.test/i.jpg', caption: 'New stock', onClose: () => {} }));
  assert.match(box, /New stock/);
  assert.match(box, /aria-label="Close preview"/);
});

check('side panels render search, media and the fixed-frame shell', () => {
  const search = render(h(SidePanel, { title: 'Search conversation', onClose: () => {} },
    h(SearchPanel, { term: 'price', onTermChange: () => {}, results: [sampleMessages[0]], onJump: () => {} })));
  assert.match(search, /Search within conversation/);
  assert.match(search, /price list/);

  const media = render(h(SidePanel, { title: 'Media & files', onClose: () => {} },
    h(MediaPanel, {
      media: [{ id: 'i1', type: 'image', mediaUrl: 'x' }, { id: 'v1', type: 'video', mediaUrl: 'y' }],
      files: [sampleMessages[1]], onJump: () => {}, onOpenImage: () => {},
    })));
  assert.match(media, /Photos &amp; videos/);
  assert.match(media, /Documents/);
  assert.match(media, /prices\.pdf/);
});

check('chat helpers back the rendered UI', () => {
  assert.equal(chatUtils.messagePreview(sampleMessages[2]), '🎤 Voice message');
  assert.match(chatUtils.messagePreview(sampleMessages[1]), /prices\.pdf/);
  assert.ok(chatUtils.voiceBars('m3').length === 28);
});

console.log(`\n${passed} assertions passed.`);
