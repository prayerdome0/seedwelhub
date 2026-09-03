import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, serverTimestamp } from '../firebase/firestore';
import { COLLECTIONS, QUOTATION_STATUS, DOCUMENT_TYPES, NOTIFICATION_TYPES } from '../utils/constants';
import { generateVerificationCode } from '../utils/ids';
import { nextDocumentNumber } from './documentNumberService';
import { createNotification } from './notificationService';

const COL = COLLECTIONS.QUOTATIONS;

export function getQuotation(id) {
  return getById(COL, id);
}

export function getQuotationsByBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getQuotationsByCustomer(customerId) {
  return queryOnce(COL, [where('customerId', '==', customerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

// Quotation requests addressed to a seller who may not have a business record
// yet — mirrors the ownerId pattern already used for orders.
export function getQuotationsByOwner(ownerId) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

function totalOf(items = [], deliveryFee = 0) {
  const itemsTotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.unitPrice ?? item.price) || 0;
    const discount = Number(item.discount) || 0;
    const taxRate = Number(item.tax ?? item.taxRate) || 0;
    const base = quantity * price - discount;
    return sum + base + (base * taxRate) / 100;
  }, 0);
  return itemsTotal + (Number(deliveryFee) || 0);
}

export async function createQuotation({ businessId, customerId, items = [], ...data }) {
  const { number } = await nextDocumentNumber(DOCUMENT_TYPES.QUOTATION);
  return createDoc(COL, {
    quotationNumber: number,
    verificationCode: generateVerificationCode(),
    businessId,
    customerId,
    status: QUOTATION_STATUS.DRAFT,
    ...data,
    items,
    total: data.total != null ? data.total : totalOf(items, data.deliveryFee),
  });
}

export async function updateQuotation(id, data) {
  return patchDoc(COL, id, data);
}

export function getQuotationByVerificationCode(code) {
  return queryOnce(COL, [where('verificationCode', '==', code)], { limit: 1 });
}

// ---------------------------------------------------------------------------
// Quotation workflow
//
// 1. Buyer submits a request       → status: requested
// 2. Seller triages the request    → accepted for quoting / declined /
//                                    clarification requested
// 3. Seller prepares and sends     → status: sent
// 4. Buyer opens it                → status: viewed
// 5. Buyer decides                 → accepted / rejected
//
// Each transition notifies the other party and deep-links back to the
// quotation, so neither side has to go hunting for it.
// ---------------------------------------------------------------------------

/**
 * Step 1 — the buyer asks a seller for a quotation.
 */
export async function requestQuotation({
  businessId,
  businessName,
  ownerId,
  customerId,
  customerName,
  customerEmail,
  customerPhone,
  productService,
  quantity,
  requirements = '',
  message = '',
  preferredDelivery = '',
  productId = null,
  serviceId = null,
  currency,
}) {
  const { number } = await nextDocumentNumber(DOCUMENT_TYPES.QUOTATION);

  const quotation = await createDoc(COL, {
    quotationNumber: number,
    verificationCode: generateVerificationCode(),
    businessId: businessId || null,
    businessName: businessName || '',
    ownerId: ownerId || null,
    customerId,
    customerName: customerName || '',
    customerEmail: customerEmail || '',
    customerPhone: customerPhone || '',
    status: QUOTATION_STATUS.REQUESTED,
    // The buyer's original brief is preserved verbatim for the whole lifetime
    // of the quotation, so the seller can always see what was actually asked.
    request: {
      productService,
      quantity: Number(quantity) || 1,
      requirements,
      message,
      preferredDelivery,
      productId,
      serviceId,
    },
    requestedDelivery: preferredDelivery,
    currency: currency || null,
    items: [],
    total: 0,
    requestedAt: serverTimestamp(),
    timeline: [],
  });

  const related = {
    quotationId: quotation.id,
    quotationNumber: number,
    businessId: businessId || null,
    customerId,
  };

  if (ownerId && ownerId !== customerId) {
    await createNotification({
      recipientId: ownerId,
      title: 'New quotation request 📝',
      message: `${customerName || 'A buyer'} requested a quotation for ${productService} (qty ${Number(quantity) || 1}).`,
      type: NOTIFICATION_TYPES.QUOTATIONS,
      related,
    }).catch(() => {});
  }

  await createNotification({
    recipientId: customerId,
    title: 'Quotation request sent ✅',
    message: `Your request ${number} was sent to ${businessName || 'the seller'}. You'll be notified when they respond.`,
    type: NOTIFICATION_TYPES.QUOTATIONS,
    related,
  }).catch(() => {});

  return quotation;
}

/**
 * Step 2 — the seller triages an incoming request.
 * @param {'accept'|'decline'|'clarify'} action
 */
export async function respondToQuotationRequest(quotation, action, { note = '' } = {}) {
  const statusByAction = {
    accept: QUOTATION_STATUS.DRAFT,
    decline: QUOTATION_STATUS.DECLINED,
    clarify: QUOTATION_STATUS.CLARIFICATION,
  };
  const status = statusByAction[action];
  if (!status) throw new Error('Unknown quotation action.');

  await patchDoc(COL, quotation.id, {
    status,
    sellerResponse: note,
    respondedAt: serverTimestamp(),
  });

  const messages = {
    accept: `${quotation.businessName || 'The seller'} accepted your request ${quotation.quotationNumber} and is preparing your quotation.`,
    decline: `${quotation.businessName || 'The seller'} declined quotation request ${quotation.quotationNumber}.${note ? ` Reason: ${note}` : ''}`,
    clarify: `${quotation.businessName || 'The seller'} needs more information for ${quotation.quotationNumber}.${note ? ` "${note}"` : ''}`,
  };
  const titles = {
    accept: 'Quotation request accepted ✅',
    decline: 'Quotation request declined',
    clarify: 'Clarification requested 💬',
  };

  if (quotation.customerId) {
    await createNotification({
      recipientId: quotation.customerId,
      title: titles[action],
      message: messages[action],
      type: NOTIFICATION_TYPES.QUOTATIONS,
      related: {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        businessId: quotation.businessId,
      },
    }).catch(() => {});
  }

  return { ...quotation, status };
}

/**
 * Step 3 — the seller sends the prepared quotation to the buyer.
 */
export async function sendQuotation(quotation, payload = {}) {
  const items = payload.items || quotation.items || [];
  const deliveryFee = Number(payload.deliveryFee ?? quotation.deliveryFee) || 0;
  const total = payload.total != null ? payload.total : totalOf(items, deliveryFee);

  await patchDoc(COL, quotation.id, {
    ...payload,
    items,
    deliveryFee,
    total,
    status: QUOTATION_STATUS.SENT,
    sentAt: serverTimestamp(),
  });

  if (quotation.customerId) {
    await createNotification({
      recipientId: quotation.customerId,
      title: 'Quotation received 📝',
      message: `${quotation.businessName || 'A seller'} sent you quotation ${quotation.quotationNumber}. Open it to review, download the PDF or accept.`,
      type: NOTIFICATION_TYPES.QUOTATIONS,
      related: {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        businessId: quotation.businessId,
      },
    }).catch(() => {});
  }

  return { ...quotation, ...payload, items, total, status: QUOTATION_STATUS.SENT };
}

/**
 * Step 4 — records that the buyer opened a sent quotation. Silent: it only
 * moves `sent` → `viewed` and never overwrites a later status.
 */
export async function markQuotationViewed(quotation, viewerId) {
  if (!quotation || quotation.status !== QUOTATION_STATUS.SENT) return quotation;
  if (quotation.customerId !== viewerId) return quotation;
  await patchDoc(COL, quotation.id, {
    status: QUOTATION_STATUS.VIEWED,
    viewedAt: serverTimestamp(),
  }).catch(() => {});
  return { ...quotation, status: QUOTATION_STATUS.VIEWED };
}

/**
 * Step 5 — the buyer accepts or rejects the quotation.
 */
export async function decideQuotation(quotation, accepted, { note = '' } = {}) {
  const status = accepted ? QUOTATION_STATUS.ACCEPTED : QUOTATION_STATUS.REJECTED;
  await patchDoc(COL, quotation.id, {
    status,
    buyerResponse: note,
    decidedAt: serverTimestamp(),
  });

  const sellerId = quotation.ownerId;
  if (sellerId) {
    await createNotification({
      recipientId: sellerId,
      title: accepted ? 'Quotation accepted 🎉' : 'Quotation declined',
      message: accepted
        ? `${quotation.customerName || 'The buyer'} accepted quotation ${quotation.quotationNumber}. You can now raise an invoice.`
        : `${quotation.customerName || 'The buyer'} declined quotation ${quotation.quotationNumber}.${note ? ` "${note}"` : ''}`,
      type: NOTIFICATION_TYPES.QUOTATIONS,
      related: {
        quotationId: quotation.id,
        quotationNumber: quotation.quotationNumber,
        businessId: quotation.businessId,
      },
    }).catch(() => {});
  }

  return { ...quotation, status };
}
