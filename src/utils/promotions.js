// Promotion domain logic.
//
// Every rule that decides whether a promotion is live, what it costs and what
// the buyer saves lives HERE — as pure functions with no Firestore and no React
// imports. The seller dashboard, the product pages and the service layer all
// call the same functions, so a promotion can never be "active" in one place
// and expired in another.
//
// IMPORTANT — trust boundary:
// These helpers are also used by `promotionService` to re-validate a promotion
// every time it is read back from Firestore. The seller's browser can put any
// numbers it likes into a document, so nothing that a buyer sees is taken from
// the stored `pricing` fields directly: the effective price is always
// recomputed from (originalPrice, type, value) and re-clamped, and the schedule
// is always re-checked against the reader's clock. Firestore rules
// (firestore.rules → /promotions) enforce ownership and the shape of the
// document; these functions enforce its meaning.

import { timestampMillis } from './format';

export const PROMOTION_TYPES = {
  PERCENTAGE: 'percentage',
  FIXED_PRICE: 'fixed_price',
};

export const PROMOTION_STATUS = {
  DRAFT: 'draft',       // disabled by the seller
  SCHEDULED: 'scheduled', // enabled, start time not reached yet
  ACTIVE: 'active',     // enabled and inside the window
  EXPIRED: 'expired',   // end time passed
};

// Discount tiers we offer ready-made banner artwork for.
export const DISCOUNT_TIERS = [10, 15, 20, 25, 30, 40, 50, 70];

// A percentage outside this range is almost always a typo (or an attempt to
// fake a "99% off" listing), so we refuse it rather than silently clamp.
export const MIN_PERCENT = 1;
export const MAX_PERCENT = 90;

function toMillis(value) {
  if (value === null || value === undefined || value === '') return null;
  const ms = timestampMillis(value);
  return ms || null;
}

// Combines the separate date + time inputs the seller fills in ("2026-09-12" +
// "18:30") into a single epoch-millisecond value in the *browser's* timezone,
// which is what the seller means when they type a local time.
export function combineDateTime(date, time = '00:00') {
  if (!date) return null;
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : '00:00';
  const parsed = new Date(`${date}T${safeTime}`);
  const ms = parsed.getTime();
  return Number.isNaN(ms) ? null : ms;
}

// Splits an epoch value back into the `<input type="date">` /
// `<input type="time">` pair used by the Create Promotion form.
export function splitDateTime(value) {
  const ms = toMillis(value);
  if (!ms) return { date: '', time: '' };
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * The single source of truth for promotional pricing.
 *
 * Returns `null` when the inputs cannot produce a genuine saving — a promotion
 * that does not actually reduce the price is not a promotion, and showing
 * "Save K0" (or a negative saving) would be misleading.
 */
export function computePricing({ originalPrice, type, value }) {
  const original = Number(originalPrice);
  if (!Number.isFinite(original) || original <= 0) return null;

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  let promoPrice;
  let percent;

  if (type === PROMOTION_TYPES.FIXED_PRICE) {
    promoPrice = amount;
    if (promoPrice >= original) return null; // not a discount
    percent = Math.round(((original - promoPrice) / original) * 100);
  } else {
    percent = amount;
    if (percent < MIN_PERCENT || percent > MAX_PERCENT) return null;
    promoPrice = original - (original * percent) / 100;
  }

  // Money is rounded to whole units: every currency the app supports is
  // displayed with `maximumFractionDigits: 0`, so carrying cents here would
  // make "Was − Now ≠ Save" on screen.
  promoPrice = Math.round(promoPrice);
  const rounded = Math.round(original);
  const savings = rounded - promoPrice;
  if (savings <= 0) return null;

  return {
    originalPrice: rounded,
    promoPrice,
    savings,
    // Recomputed from the rounded figures so the badge always agrees with the
    // "Was / Now / Save" numbers printed next to it.
    discountPercent: Math.round((savings / rounded) * 100),
  };
}

// Validates the Create Promotion form. Returns a list of human-readable
// problems — empty means the promotion is publishable.
export function validatePromotion(input = {}) {
  const errors = [];
  const title = String(input.title || '').trim();
  if (!title) errors.push('Give the promotion a title.');

  const productIds = input.productIds || [];
  if (!productIds.length) errors.push('Choose at least one product.');

  const pricing = computePricing(input);
  if (!pricing) {
    if (input.type === PROMOTION_TYPES.FIXED_PRICE) {
      errors.push('The promotional price must be a positive amount below the original price.');
    } else {
      errors.push(`Enter a discount between ${MIN_PERCENT}% and ${MAX_PERCENT}%.`);
    }
  }

  const startAt = toMillis(input.startAt);
  const endAt = toMillis(input.endAt);
  if (!startAt) errors.push('Choose a start date and time.');
  if (!endAt) errors.push('Choose an end date and time.');
  if (startAt && endAt && endAt <= startAt) {
    errors.push('The end date and time must be after the start.');
  }

  return errors;
}

/**
 * Recomputes a stored promotion against the clock.
 *
 * `promotionService` runs every document through this on read, so an expired
 * promotion is inert even if its stored `status` still says "active" (for
 * example when nothing has written to the document since it lapsed).
 */
export function resolvePromotion(promotion, now = Date.now()) {
  if (!promotion) return null;

  const pricing = computePricing({
    originalPrice: promotion.originalPrice,
    type: promotion.type,
    value: promotion.type === PROMOTION_TYPES.FIXED_PRICE
      ? promotion.promoPrice
      : promotion.discountPercent,
  });

  const startAt = toMillis(promotion.startAt);
  const endAt = toMillis(promotion.endAt);
  const enabled = promotion.enabled !== false;

  let status;
  if (!pricing || !startAt || !endAt) status = PROMOTION_STATUS.DRAFT;
  else if (!enabled) status = PROMOTION_STATUS.DRAFT;
  else if (now >= endAt) status = PROMOTION_STATUS.EXPIRED;
  else if (now < startAt) status = PROMOTION_STATUS.SCHEDULED;
  else status = PROMOTION_STATUS.ACTIVE;

  const isActive = status === PROMOTION_STATUS.ACTIVE;

  return {
    ...promotion,
    // Recomputed values always win over whatever was stored.
    ...(pricing || {}),
    startAtMs: startAt,
    endAtMs: endAt,
    status,
    isActive,
    isExpired: status === PROMOTION_STATUS.EXPIRED,
    isScheduled: status === PROMOTION_STATUS.SCHEDULED,
    // Milliseconds until the promotion ends (active) or starts (scheduled).
    endsInMs: isActive && endAt ? Math.max(0, endAt - now) : 0,
    startsInMs: status === PROMOTION_STATUS.SCHEDULED && startAt ? Math.max(0, startAt - now) : 0,
  };
}

// Keeps only the promotions a shopper should ever see.
export function activePromotions(promotions, now = Date.now()) {
  return (promotions || [])
    .map((p) => resolvePromotion(p, now))
    .filter((p) => p && p.isActive);
}

/**
 * Picks the promotion that applies to a product — the deepest discount wins
 * when a product is (deliberately or accidentally) in more than one campaign.
 */
export function promotionForProduct(productId, promotions, now = Date.now()) {
  if (!productId) return null;
  const candidates = activePromotions(promotions, now).filter((p) =>
    (p.productIds || []).includes(productId)
  );
  if (!candidates.length) return null;
  return candidates.reduce((best, p) => (p.discountPercent > best.discountPercent ? p : best));
}

/**
 * Merges a product with its live promotion so cards, the detail page and the
 * order flow all read the same `price`.
 *
 * The promotion's `originalPrice` is ignored in favour of the product's own
 * current price when the two disagree and the product is cheaper, so a seller
 * cannot inflate the "Was" figure after the fact to fake a bigger saving.
 */
export function applyPromotion(product, promotion) {
  if (!product) return product;
  if (!promotion || !promotion.isActive) return { ...product, promotion: null };

  const listPrice = Number(product.price);
  const claimed = Number(promotion.originalPrice);
  const original = Number.isFinite(listPrice) && listPrice > 0
    ? Math.min(listPrice, Number.isFinite(claimed) && claimed > 0 ? claimed : listPrice)
    : claimed;

  const pricing = computePricing({
    originalPrice: original,
    type: promotion.type,
    value: promotion.type === PROMOTION_TYPES.FIXED_PRICE
      ? promotion.promoPrice
      : promotion.discountPercent,
  });

  if (!pricing) return { ...product, promotion: null };

  return {
    ...product,
    price: pricing.promoPrice,
    oldPrice: pricing.originalPrice,
    savings: pricing.savings,
    discountPercent: pricing.discountPercent,
    promotion: {
      id: promotion.id,
      title: promotion.title,
      endAt: promotion.endAt,
      endsInMs: promotion.endsInMs,
      ...pricing,
    },
  };
}

// "Ends in 2h 35m" — the coarse, human countdown used on cards and banners.
export function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0) / 1000);
  if (total <= 0) return 'Ended';

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = Math.floor(total % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}
