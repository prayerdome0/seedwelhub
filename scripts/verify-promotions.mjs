// Promotion rules verification.
//
// Promotions decide what a buyer is charged, so the rules that govern them are
// locked down here: pricing maths, schedule transitions, the "deepest discount
// wins" tie-break, and — most importantly — the anti-tamper guards that stop a
// seller-controlled document from inflating a "Was" price or publishing a
// discount outside the allowed band.
import assert from 'node:assert/strict';

const {
  PROMOTION_TYPES,
  PROMOTION_STATUS,
  computePricing,
  validatePromotion,
  resolvePromotion,
  activePromotions,
  promotionForProduct,
  applyPromotion,
  formatCountdown,
  combineDateTime,
  splitDateTime,
} = await import('../src/utils/promotions.js');

let passed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const HOUR = 3600 * 1000;
const NOW = Date.UTC(2026, 0, 15, 12, 0, 0);

console.log('\nPRICING MATHS (Was / Now / Save / %)');

check('15% off 500 → now 425, save 75', () => {
  const p = computePricing({ originalPrice: 500, type: PROMOTION_TYPES.PERCENTAGE, value: 15 });
  assert.equal(p.originalPrice, 500);
  assert.equal(p.promoPrice, 425);
  assert.equal(p.savings, 75);
  assert.equal(p.discountPercent, 15);
});

check('a fixed new price derives the percentage', () => {
  const p = computePricing({ originalPrice: 500, type: PROMOTION_TYPES.FIXED_PRICE, value: 425 });
  assert.equal(p.promoPrice, 425);
  assert.equal(p.savings, 75);
  assert.equal(p.discountPercent, 15);
});

check('Was − Now always equals Save (rounded money stays consistent)', () => {
  for (const original of [333, 999, 1250, 47, 19999]) {
    for (const pct of [10, 15, 20, 33, 50]) {
      const p = computePricing({ originalPrice: original, type: PROMOTION_TYPES.PERCENTAGE, value: pct });
      assert.equal(p.originalPrice - p.promoPrice, p.savings, `${original} @ ${pct}%`);
    }
  }
});

console.log('\nANTI-TAMPER GUARDS (a seller must not be able to fake a deal)');

check('a "new price" above the original is rejected', () => {
  assert.equal(computePricing({ originalPrice: 500, type: PROMOTION_TYPES.FIXED_PRICE, value: 600 }), null);
});
check('a "new price" equal to the original is rejected (no saving)', () => {
  assert.equal(computePricing({ originalPrice: 500, type: PROMOTION_TYPES.FIXED_PRICE, value: 500 }), null);
});
check('0% and negative discounts are rejected', () => {
  assert.equal(computePricing({ originalPrice: 500, type: PROMOTION_TYPES.PERCENTAGE, value: 0 }), null);
  assert.equal(computePricing({ originalPrice: 500, type: PROMOTION_TYPES.PERCENTAGE, value: -20 }), null);
});
check('a discount above 90% is rejected', () => {
  assert.equal(computePricing({ originalPrice: 500, type: PROMOTION_TYPES.PERCENTAGE, value: 99 }), null);
});
check('a non-numeric / missing original price is rejected', () => {
  assert.equal(computePricing({ originalPrice: 'free', type: PROMOTION_TYPES.PERCENTAGE, value: 10 }), null);
  assert.equal(computePricing({ originalPrice: 0, type: PROMOTION_TYPES.PERCENTAGE, value: 10 }), null);
});

check('an inflated "Was" price cannot beat the product\'s real list price', () => {
  // Seller claims the product used to be 1000 to fake a 50% saving, while the
  // product is actually listed at 500.
  const product = { id: 'p1', price: 500 };
  const promo = resolvePromotion({
    id: 'x', productIds: ['p1'], originalPrice: 1000, discountPercent: 50,
    type: PROMOTION_TYPES.PERCENTAGE, enabled: true,
    startAt: NOW - HOUR, endAt: NOW + HOUR,
  }, NOW);
  const decorated = applyPromotion(product, promo);
  // The saving is computed off the genuine 500 list price, not the claimed 1000.
  assert.equal(decorated.oldPrice, 500);
  assert.equal(decorated.price, 250);
  assert.equal(decorated.savings, 250);
});

check('a stored status of "active" cannot resurrect an expired promotion', () => {
  const resolved = resolvePromotion({
    status: 'active', enabled: true, originalPrice: 500, discountPercent: 20,
    type: PROMOTION_TYPES.PERCENTAGE,
    startAt: NOW - 5 * HOUR, endAt: NOW - HOUR, // ended an hour ago
  }, NOW);
  assert.equal(resolved.status, PROMOTION_STATUS.EXPIRED);
  assert.equal(resolved.isActive, false);
});

check('stored promoPrice/savings are recomputed, never trusted', () => {
  const resolved = resolvePromotion({
    enabled: true, type: PROMOTION_TYPES.PERCENTAGE,
    originalPrice: 500, discountPercent: 10,
    promoPrice: 1, savings: 499, // tampered
    startAt: NOW - HOUR, endAt: NOW + HOUR,
  }, NOW);
  assert.equal(resolved.promoPrice, 450);
  assert.equal(resolved.savings, 50);
});

console.log('\nSCHEDULING (auto start / auto stop)');

const base = {
  enabled: true, type: PROMOTION_TYPES.PERCENTAGE,
  originalPrice: 500, discountPercent: 15,
};

check('before the start time the promotion is scheduled, not active', () => {
  const r = resolvePromotion({ ...base, startAt: NOW + HOUR, endAt: NOW + 5 * HOUR }, NOW);
  assert.equal(r.status, PROMOTION_STATUS.SCHEDULED);
  assert.equal(r.isActive, false);
});
check('inside the window it is active', () => {
  const r = resolvePromotion({ ...base, startAt: NOW - HOUR, endAt: NOW + HOUR }, NOW);
  assert.equal(r.status, PROMOTION_STATUS.ACTIVE);
  assert.equal(r.isActive, true);
});
check('at the exact end millisecond it has already stopped', () => {
  const r = resolvePromotion({ ...base, startAt: NOW - HOUR, endAt: NOW }, NOW);
  assert.equal(r.status, PROMOTION_STATUS.EXPIRED);
});
check('a disabled promotion never goes live, even inside its window', () => {
  const r = resolvePromotion({ ...base, enabled: false, startAt: NOW - HOUR, endAt: NOW + HOUR }, NOW);
  assert.equal(r.status, PROMOTION_STATUS.DRAFT);
  assert.equal(r.isActive, false);
});
check('expired promotions drop out of the active list', () => {
  const list = [
    { id: 'a', ...base, startAt: NOW - HOUR, endAt: NOW + HOUR },
    { id: 'b', ...base, startAt: NOW - 5 * HOUR, endAt: NOW - HOUR },
    { id: 'c', ...base, startAt: NOW + HOUR, endAt: NOW + 5 * HOUR },
  ];
  assert.deepEqual(activePromotions(list, NOW).map((p) => p.id), ['a']);
});
check('endsInMs counts down toward the end time', () => {
  const r = resolvePromotion({ ...base, startAt: NOW - HOUR, endAt: NOW + 2 * HOUR }, NOW);
  assert.equal(r.endsInMs, 2 * HOUR);
});

console.log('\nPRODUCT MATCHING');

check('the deepest discount wins when a product is in two campaigns', () => {
  const promos = [
    { id: 'small', ...base, discountPercent: 10, productIds: ['p1'], startAt: NOW - HOUR, endAt: NOW + HOUR },
    { id: 'big', ...base, discountPercent: 30, productIds: ['p1'], startAt: NOW - HOUR, endAt: NOW + HOUR },
  ];
  assert.equal(promotionForProduct('p1', promos, NOW).id, 'big');
});
check('a product in no campaign gets no promotion', () => {
  const promos = [{ id: 'a', ...base, productIds: ['other'], startAt: NOW - HOUR, endAt: NOW + HOUR }];
  assert.equal(promotionForProduct('p1', promos, NOW), null);
  assert.equal(applyPromotion({ id: 'p1', price: 100 }, null).promotion, null);
});
check('an expired campaign leaves the product at full price', () => {
  const promo = resolvePromotion({ ...base, productIds: ['p1'], startAt: NOW - 5 * HOUR, endAt: NOW - HOUR }, NOW);
  const product = applyPromotion({ id: 'p1', price: 500 }, promo);
  assert.equal(product.price, 500);
  assert.equal(product.promotion, null);
});

console.log('\nFORM VALIDATION');

const goodForm = {
  title: 'Weekend Sale', productIds: ['p1'],
  originalPrice: 500, type: PROMOTION_TYPES.PERCENTAGE, value: 15,
  startAt: NOW, endAt: NOW + HOUR,
};

check('a complete promotion passes validation', () => {
  assert.deepEqual(validatePromotion(goodForm), []);
});
check('a missing title is caught', () => {
  assert.ok(validatePromotion({ ...goodForm, title: '  ' }).some((e) => /title/i.test(e)));
});
check('a promotion with no products is caught', () => {
  assert.ok(validatePromotion({ ...goodForm, productIds: [] }).some((e) => /product/i.test(e)));
});
check('an end time before the start is caught', () => {
  assert.ok(validatePromotion({ ...goodForm, endAt: NOW - HOUR }).some((e) => /after the start/i.test(e)));
});
check('a 200% discount is caught', () => {
  assert.ok(validatePromotion({ ...goodForm, value: 200 }).length > 0);
});

console.log('\nCOUNTDOWN + DATE HELPERS');

check('formatCountdown renders "2h 35m"', () => {
  assert.equal(formatCountdown(2 * HOUR + 35 * 60 * 1000), '2h 35m');
});
check('formatCountdown uses days beyond 24 hours', () => {
  assert.equal(formatCountdown(50 * HOUR), '2d 2h');
});
check('formatCountdown shows seconds under a minute, and "Ended" at zero', () => {
  assert.equal(formatCountdown(45 * 1000), '45s');
  assert.equal(formatCountdown(0), 'Ended');
  assert.equal(formatCountdown(-5000), 'Ended');
});
check('date + time round-trips through the form helpers', () => {
  const ms = combineDateTime('2026-03-08', '18:30');
  assert.deepEqual(splitDateTime(ms), { date: '2026-03-08', time: '18:30' });
});
check('an empty date yields no timestamp', () => {
  assert.equal(combineDateTime('', '10:00'), null);
});

console.log(`\n${passed} promotion checks passed.`);
