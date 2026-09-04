import { createDoc, getById, patchDoc, removeDoc, queryOnce } from './_base';
import { where } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import {
  PROMOTION_TYPES,
  PROMOTION_STATUS,
  computePricing,
  resolvePromotion,
  activePromotions,
  promotionForProduct,
  applyPromotion,
  validatePromotion,
} from '../utils/promotions';

const COL = COLLECTIONS.PROMOTIONS;
const BANNERS = COLLECTIONS.PROMO_BANNERS;

// Every read goes through `resolvePromotion`, which recomputes the price and
// the schedule from scratch. Nothing downstream ever trusts the stored
// `status` / `promoPrice` / `savings` fields, so a seller who edits the
// document from the browser console cannot publish a price the rules of
// `utils/promotions.js` would reject.
function hydrate(docs, now = Date.now()) {
  return (Array.isArray(docs) ? docs : [])
    .map((d) => resolvePromotion(d, now))
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------

export async function getPromotion(id) {
  const promo = await getById(COL, id);
  return promo ? resolvePromotion(promo) : null;
}

export async function getPromotionsByBusiness(businessId) {
  if (!businessId) return [];
  const docs = await queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
  return hydrate(docs);
}

export async function getPromotionsByOwner(ownerId) {
  if (!ownerId) return [];
  const docs = await queryOnce(COL, [where('ownerId', '==', ownerId)], {
    orderBy: ['createdAt', 'desc'],
  });
  return hydrate(docs);
}

// Live promotions across the whole marketplace, newest first. Bounded so the
// homepage never pulls an unbounded collection.
export async function getActivePromotions(count = 24) {
  const docs = await queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: 100 });
  return activePromotions(docs).slice(0, count);
}

// Promotions covering a single product — used by the product detail page.
export async function getPromotionsForProduct(productId) {
  if (!productId) return null;
  const docs = await queryOnce(COL, [], { orderBy: ['createdAt', 'desc'], limit: 100 });
  return promotionForProduct(productId, docs);
}

/**
 * Creates a promotion.
 *
 * The payload is validated and the pricing recomputed here rather than in the
 * form, so a promotion written by any caller (dashboard, future API, import)
 * obeys the same rules. Rejected input throws before it reaches Firestore.
 */
export async function createPromotion(ownerId, data = {}) {
  const errors = validatePromotion(data);
  if (errors.length) throw new Error(errors[0]);

  const pricing = computePricing(data);
  return createDoc(COL, {
    ownerId,
    businessId: data.businessId || null,
    businessName: data.businessName || '',
    title: String(data.title).trim(),
    description: String(data.description || '').trim(),
    type: data.type === PROMOTION_TYPES.FIXED_PRICE
      ? PROMOTION_TYPES.FIXED_PRICE
      : PROMOTION_TYPES.PERCENTAGE,
    productIds: data.productIds || [],
    productNames: data.productNames || [],
    currency: data.currency || 'UGX',
    image: data.image || '',
    startAt: data.startAt,
    endAt: data.endAt,
    enabled: data.enabled !== false,
    // Stored for querying and for the seller's own records — never trusted on
    // read (see `hydrate`).
    originalPrice: pricing.originalPrice,
    promoPrice: pricing.promoPrice,
    savings: pricing.savings,
    discountPercent: pricing.discountPercent,
    status: PROMOTION_STATUS.SCHEDULED,
  });
}

export async function updatePromotion(id, data = {}) {
  const errors = validatePromotion(data);
  if (errors.length) throw new Error(errors[0]);
  const pricing = computePricing(data);
  return patchDoc(COL, id, {
    title: String(data.title).trim(),
    description: String(data.description || '').trim(),
    type: data.type,
    productIds: data.productIds || [],
    productNames: data.productNames || [],
    image: data.image || '',
    currency: data.currency,
    startAt: data.startAt,
    endAt: data.endAt,
    enabled: data.enabled !== false,
    originalPrice: pricing.originalPrice,
    promoPrice: pricing.promoPrice,
    savings: pricing.savings,
    discountPercent: pricing.discountPercent,
  });
}

// The seller's enable/disable switch. A disabled promotion resolves to `draft`
// and disappears from every shopper-facing surface immediately.
export function setPromotionEnabled(id, enabled) {
  return patchDoc(COL, id, { enabled: Boolean(enabled) });
}

export function deletePromotion(id) {
  return removeDoc(COL, id);
}

// ---------------------------------------------------------------------------
// Promotional banners
// ---------------------------------------------------------------------------

export async function getActiveBanners(count = 6) {
  const docs = await queryOnce(BANNERS, [], { orderBy: ['createdAt', 'desc'], limit: 50 });
  // Banners share the promotion schedule semantics, so they run through the
  // same resolver — an expired banner never reaches the homepage.
  return hydrate(docs.map((b) => ({ ...b, originalPrice: b.originalPrice || 1, discountPercent: b.discountPercent || 1 })))
    .filter((b) => b.isActive)
    .slice(0, count);
}

export function getBannersByBusiness(businessId) {
  if (!businessId) return Promise.resolve([]);
  return queryOnce(BANNERS, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function createBanner(ownerId, data = {}) {
  return createDoc(BANNERS, {
    ownerId,
    businessId: data.businessId || null,
    businessName: data.businessName || '',
    headline: String(data.headline || '').trim(),
    subline: String(data.subline || '').trim(),
    ctaLabel: data.ctaLabel || 'Shop now',
    ctaTo: data.ctaTo || '/marketplace',
    image: data.image || '',
    theme: data.theme || 'green',
    discountPercent: Number(data.discountPercent) || 0,
    productIds: data.productIds || [],
    promotionId: data.promotionId || null,
    startAt: data.startAt,
    endAt: data.endAt,
    enabled: data.enabled !== false,
  });
}

export function updateBanner(id, data) {
  return patchDoc(BANNERS, id, data);
}

export function deleteBanner(id) {
  return removeDoc(BANNERS, id);
}

// ---------------------------------------------------------------------------
// Product decoration
// ---------------------------------------------------------------------------

/**
 * Attaches live promotion pricing to a list of products in ONE extra read.
 *
 * Homepage sections call this so a promoted product shows its promotional
 * price everywhere it appears, without each card fetching for itself.
 */
export async function decorateProductsWithPromotions(products) {
  const list = Array.isArray(products) ? products : [];
  if (!list.length) return list;
  let promos = [];
  try {
    promos = await getActivePromotions(100);
  } catch {
    return list; // promotions are an enhancement — never break the listing
  }
  if (!promos.length) return list;
  return list.map((p) => applyPromotion(p, promotionForProduct(p.id, promos)));
}

export { applyPromotion, promotionForProduct };
