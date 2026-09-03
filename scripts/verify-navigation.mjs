import assert from 'node:assert/strict';
const { MAIN_MENU, visibleItems, accountMenuFor } = await import('../src/navigation/menus.js');
const { notificationRoute, notificationIcon } = await import('../src/navigation/notificationRoutes.js');
const { NOTIFICATION_TYPES } = await import('../src/utils/constants.js');

let passed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const guest = { isAuthenticated: false, isSeller: false, isVerifiedSeller: false, isAdmin: false };
const buyer = { isAuthenticated: true, isSeller: false, isVerifiedSeller: false, isAdmin: false };
const unverifiedSeller = { isAuthenticated: true, isSeller: true, isVerifiedSeller: false, isAdmin: false };
const verifiedSeller = { isAuthenticated: true, isSeller: true, isVerifiedSeller: true, isAdmin: false };
const admin = { isAuthenticated: true, isSeller: true, isVerifiedSeller: true, isAdmin: true };

const flat = (viewer) => MAIN_MENU.flatMap(g => visibleItems(g.items, viewer)).map(i => i.id);

console.log('\nMAIN MENU GATING');
check('guest sees Home + Marketplace', () => {
  const ids = flat(guest);
  assert.ok(ids.includes('home')); assert.ok(ids.includes('marketplace'));
});
check('guest does NOT see orders/saved/account', () => {
  const ids = flat(guest);
  ['orders','saved','account','notifications','settings'].forEach(id =>
    assert.ok(!ids.includes(id), `${id} leaked to guest`));
});
check('guest does not see admin', () => assert.ok(!flat(guest).includes('admin')));
check('buyer sees orders, saved, notifications, account', () => {
  const ids = flat(buyer);
  ['orders','saved','notifications','account','settings'].forEach(id =>
    assert.ok(ids.includes(id), `${id} missing for buyer`));
});
check('buyer sees Start Selling, not dashboard', () => {
  const ids = flat(buyer);
  assert.ok(ids.includes('sell'));
  assert.ok(!ids.includes('seller'));
});
check('seller sees dashboard, not Start Selling', () => {
  const ids = flat(verifiedSeller);
  assert.ok(ids.includes('seller'));
  assert.ok(!ids.includes('sell'));
});
check('non-admin never sees admin console', () => {
  [buyer, verifiedSeller].forEach(v => assert.ok(!flat(v).includes('admin')));
});
check('admin sees admin console', () => assert.ok(flat(admin).includes('admin')));
check('About Us always present', () => {
  [guest, buyer, admin].forEach(v => {
    const ids = flat(v);
    assert.ok(ids.includes('about-company'));
    assert.ok(ids.includes('about-services'));
  });
});
check('Account group is last and separated', () => {
  const group = MAIN_MENU[MAIN_MENU.length - 1];
  assert.equal(group.id, 'account');
  assert.equal(group.separated, true);
  assert.ok(group.items.some(i => i.id === 'account'));
});

console.log('\nACCOUNT MENU BY ROLE');
check('buyer gets buyer menu', () => {
  const groups = accountMenuFor(buyer);
  const ids = groups.flatMap(g => g.items.map(i => i.id));
  ['profile','orders','receipts','invoices','quotations','payments','notifications','settings']
    .forEach(id => assert.ok(ids.includes(id), `${id} missing`));
});
check('buyer menu has no seller dashboard', () => {
  const ids = accountMenuFor(buyer).flatMap(g => g.items.map(i => i.id));
  assert.ok(!ids.includes('dashboard'));
});
check('UNVERIFIED seller: no Seller Dashboard entry', () => {
  const ids = accountMenuFor(unverifiedSeller).flatMap(g => g.items.map(i => i.id));
  assert.ok(!ids.includes('dashboard'), 'dashboard must be gated on verification');
});
check('unverified seller still gets products/orders', () => {
  const ids = accountMenuFor(unverifiedSeller).flatMap(g => g.items.map(i => i.id));
  assert.ok(ids.includes('products'));
  assert.ok(ids.includes('seller-orders'));
});
check('VERIFIED seller gets Seller Dashboard', () => {
  const ids = accountMenuFor(verifiedSeller).flatMap(g => g.items.map(i => i.id));
  assert.ok(ids.includes('dashboard'));
});
check('seller menu covers required sections', () => {
  const ids = accountMenuFor(verifiedSeller).flatMap(g => g.items.map(i => i.id));
  ['profile','dashboard','products','seller-orders','seller-quotations','seller-invoices',
   'seller-receipts','seller-payments','customers','notifications','settings']
    .forEach(id => assert.ok(ids.includes(id), `${id} missing from seller menu`));
});
check('seller also keeps buyer-side purchases', () => {
  const ids = accountMenuFor(verifiedSeller).flatMap(g => g.items.map(i => i.id));
  assert.ok(ids.includes('my-orders'));
});

console.log('\nNOTIFICATION DEEP LINKS');
const cases = [
  ['receipt', { related: { receiptId: 'r1' } }, '/receipt/r1'],
  ['invoice', { related: { invoiceId: 'i1' } }, '/invoice/i1'],
  ['quotation', { related: { quotationId: 'q1' } }, '/quotation/q1'],
  ['order', { related: { orderId: 'o1' } }, '/order/o1'],
  ['payment', { related: { paymentId: 'p1' } }, '/payment/p1'],
  ['proof -> order', { related: { paymentProofId: 'pp1', orderId: 'o9' } }, '/order/o9'],
  ['message', { related: { conversationId: 'c1' } }, '/messages/c1'],
  ['product', { related: { productId: 'pr1' } }, '/product/pr1'],
  ['business', { related: { businessId: 'b1' } }, '/business/b1'],
];
for (const [label, notif, expected] of cases) {
  check(`${label} → ${expected}`, () => assert.equal(notificationRoute(notif), expected));
}
check('receipt wins over order (most specific)', () => {
  assert.equal(notificationRoute({ related: { receiptId: 'r1', orderId: 'o1' } }), '/receipt/r1');
});
check('type fallback when no ids', () => {
  assert.equal(notificationRoute({ type: NOTIFICATION_TYPES.PAYMENTS, related: {} }), '/payments');
  assert.equal(notificationRoute({ type: NOTIFICATION_TYPES.QUOTATIONS }), '/quotations');
});
check('unknown notification returns null', () => {
  assert.equal(notificationRoute({ type: 'nope', related: {} }), null);
});
check('icons resolve per type', () => {
  assert.equal(notificationIcon({ type: NOTIFICATION_TYPES.PAYMENTS }), '💳');
  assert.equal(notificationIcon({ type: NOTIFICATION_TYPES.RECEIPTS }), '🧾');
  assert.equal(notificationIcon({}), '🔔');
});

console.log(`\n${passed} assertions passed.`);
