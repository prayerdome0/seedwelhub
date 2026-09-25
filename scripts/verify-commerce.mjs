import assert from 'node:assert/strict';
import { groupCartItems, getFulfillmentOptions } from '../src/utils/cart.js';
import { supportStatusLabel } from '../src/services/supportService.js';
import shareHandler from '../api/share.js';

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (error) { console.error(`  ✗ ${name}\n    ${error.message}`); process.exitCode = 1; }
};

console.log('\nPERSISTENT CART ORDER GROUPING');
const cartItems = [
  { productId: 'p1', businessId: 'biz1', ownerId: 'seller1', currency: 'ZMW', price: 25, quantity: 2 },
  { productId: 'p2', businessId: 'biz1', ownerId: 'seller1', currency: 'ZMW', price: 10, quantity: 1 },
  { productId: 'p3', businessId: 'biz2', ownerId: 'seller2', currency: 'ZMW', price: 8, quantity: 3 },
  { productId: 'p4', businessId: 'biz1', ownerId: 'seller1', currency: 'USD', price: 4, quantity: 1 },
  { productId: 'p5', ownerId: 'seller3', currency: 'ZMW', price: 3, quantity: 2 },
];
const groups = groupCartItems(cartItems);
await check('same seller and currency become one order group', () => {
  assert.equal(groups.find((group) => group.businessId === 'biz1' && group.currency === 'ZMW').items.length, 2);
});
await check('seller boundaries never merge', () => {
  assert.equal(groups.length, 4);
});
await check('different currencies are never totalled together', () => {
  const usd = groups.find((group) => group.currency === 'USD');
  assert.equal(usd.subtotal, 4);
  assert.equal(usd.items.length, 1);
});
await check('seller subtotals include line quantities', () => {
  const zmw = groups.find((group) => group.businessId === 'biz1' && group.currency === 'ZMW');
  assert.equal(zmw.subtotal, 60);
});
await check('owner-only sellers still form a separate order group', () => {
  const owner = groups.find((group) => group.key.startsWith('owner:seller3::'));
  assert.equal(owner.subtotal, 6);
});
await check('unsupported fulfillment methods are filtered', () => {
  assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: ['delivery', 'drone', 'pickup'] }), ['delivery', 'pickup']);
});
await check('legacy businesses default to pickup', () => {
  assert.deepEqual(getFulfillmentOptions({}), ['pickup']);
});
await check('empty or invalid seller options cannot block checkout', () => {
  assert.deepEqual(getFulfillmentOptions({ fulfillmentOptions: ['drone'] }), ['pickup']);
});
await check('support status labels are human readable', () => {
  assert.equal(supportStatusLabel('awaiting_seller'), 'Awaiting seller');
  assert.equal(supportStatusLabel('resolved'), 'Resolved');
});

console.log('\nSERVER-RENDERED SOCIAL PREVIEWS');
const originalFetch = globalThis.fetch;
const makeResponse = () => ({
  headers: {},
  code: 200,
  body: '',
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  status(code) { this.code = code; return this; },
  send(body) { this.body = body; return this; },
});
try {
  await check('product shares include escaped Open Graph, Twitter and canonical metadata', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ fields: {
        name: { stringValue: 'Green <Tea>' },
        description: { stringValue: 'Fresh & fragrant tea' },
        price: { integerValue: '120' },
        currency: { stringValue: 'ZMW' },
        image: { stringValue: 'https://images.example/tea.jpg' },
        businessName: { stringValue: 'Leaf House' },
      } }),
    });
    const response = makeResponse();
    await shareHandler({
      query: { type: 'product', id: 'tea_1' },
      headers: { host: 'preview.example', 'x-forwarded-proto': 'https' },
    }, response);
    assert.equal(response.code, 200);
    assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
    assert.match(response.body, /property="og:title" content="Green &lt;Tea&gt; \| Seedwel Hub"/);
    assert.match(response.body, /twitter:card" content="summary_large_image"/);
    assert.match(response.body, /canonical" href="https:\/\/preview\.example\/share\/product\/tea_1"/);
    assert.match(response.body, /https:\/\/images\.example\/tea\.jpg/);
    assert.match(response.body, /href="https:\/\/preview\.example\/product\/tea_1"/);
    assert.doesNotMatch(response.body, /<Tea>/);
  });
  await check('business preview uses the Seedwel fallback image when no logo exists', async () => {
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ fields: {
      name: { stringValue: 'Market Corner' },
      city: { stringValue: 'Lusaka' },
    } }) });
    const response = makeResponse();
    await shareHandler({ query: { type: 'business', id: 'shop1' }, headers: { host: 'share.example' } }, response);
    assert.equal(response.code, 200);
    assert.match(response.body, /https:\/\/share\.example\/seedwel-og\.png/);
    assert.match(response.body, /Market Corner/);
    assert.match(response.body, /Open on Seedwel Hub/);
  });
  await check('invalid share types are rejected before Firestore is queried', async () => {
    let fetched = false;
    globalThis.fetch = async () => { fetched = true; throw new Error('should not fetch'); };
    const response = makeResponse();
    await shareHandler({ query: { type: 'orders', id: 'order1' }, headers: { host: 'share.example' } }, response);
    assert.equal(response.code, 404);
    assert.equal(fetched, false);
  });
} finally {
  globalThis.fetch = originalFetch;
}

console.log(`\n${passed} commerce checks passed.`);
