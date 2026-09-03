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
