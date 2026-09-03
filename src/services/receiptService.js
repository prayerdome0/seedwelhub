import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, serverTimestamp } from '../firebase/firestore';
import { COLLECTIONS, DOCUMENT_TYPES, NOTIFICATION_TYPES } from '../utils/constants';
import { generateVerificationCode } from '../utils/ids';
import { nextDocumentNumber } from './documentNumberService';
import { createNotification } from './notificationService';
import { formatCurrency } from '../utils/format';

const COL = COLLECTIONS.RECEIPTS;

export function getReceipt(id) {
  return getById(COL, id);
}

export function getReceiptsByBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getReceiptsByCustomer(customerId) {
  return queryOnce(COL, [where('customerId', '==', customerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getReceiptsByOwner(ownerId) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getReceiptByOrder(orderId) {
  return queryOnce(COL, [where('orderId', '==', orderId)], { limit: 1 });
}

export async function createReceipt({ businessId, customerId, ...data }) {
  const { number } = await nextDocumentNumber(DOCUMENT_TYPES.RECEIPT);
  return createDoc(COL, {
    receiptNumber: number,
    verificationCode: generateVerificationCode(),
    businessId,
    customerId,
    status: 'paid',
    ...data,
  });
}

export async function updateReceipt(id, data) {
  return patchDoc(COL, id, data);
}

export function getReceiptByVerificationCode(code) {
  return queryOnce(COL, [where('verificationCode', '==', code)], { limit: 1 });
}

/**
 * Automatic receipt generation.
 *
 * Called the moment a payment is verified and the order is marked paid:
 *   payment → verified → order marked paid → receipt generated → PDF available
 *
 * Idempotent: if a receipt already exists for the order it is returned as-is,
 * so a double-confirmation can never produce two receipts for one payment.
 * Both the buyer and the seller are notified, and both can reach the receipt.
 */
export async function generateReceiptForOrder(order, {
  business = null,
  payment = null,
  paymentMethod = '',
  paymentReference = '',
  amount = null,
  notify = true,
} = {}) {
  const existing = await getReceiptByOrder(order.id).catch(() => []);
  if (existing && existing.length) return existing[0];

  const paidAmount = amount != null ? Number(amount) : Number(order.total) || 0;

  const receipt = await createReceipt({
    businessId: order.businessId || business?.id || null,
    businessName: order.businessName || business?.name || '',
    ownerId: order.ownerId || business?.ownerId || null,
    customerId: order.buyerId,
    customerName: order.buyerName || '',
    customerPhone: order.buyerPhone || '',
    customerAddress: order.address || '',
    orderId: order.id,
    orderNumber: order.orderNumber,
    invoiceId: order.invoiceId || null,
    invoiceNumber: order.invoiceNumber || null,
    paymentId: payment?.id || null,
    items: order.items || [],
    subtotal: Number(order.subtotal) || paidAmount,
    deliveryFee: Number(order.deliveryFee) || 0,
    amount: paidAmount,
    total: paidAmount,
    currency: order.currency,
    paymentMethod: paymentMethod || payment?.method || order.paymentMethod || '',
    paymentReference: paymentReference || payment?.transactionReference || payment?.reference || '',
    paidAt: serverTimestamp(),
    status: 'paid',
  });

  if (notify) {
    const related = {
      receiptId: receipt.id,
      receiptNumber: receipt.receiptNumber,
      orderId: order.id,
      orderNumber: order.orderNumber,
      businessId: order.businessId || null,
    };

    if (order.buyerId) {
      await createNotification({
        recipientId: order.buyerId,
        title: 'Payment confirmed ✅',
        message: `Your receipt ${receipt.receiptNumber} for order ${order.orderNumber} (${formatCurrency(paidAmount, order.currency)}) is ready to download.`,
        type: NOTIFICATION_TYPES.RECEIPTS,
        related,
      }).catch(() => {});
    }

    const sellerId = order.ownerId || business?.ownerId;
    if (sellerId && sellerId !== order.buyerId) {
      await createNotification({
        recipientId: sellerId,
        title: 'Payment received 💰',
        message: `Payment of ${formatCurrency(paidAmount, order.currency)} confirmed for order ${order.orderNumber}. Receipt ${receipt.receiptNumber} was issued.`,
        type: NOTIFICATION_TYPES.PAYMENTS,
        related,
      }).catch(() => {});
    }
  }

  return receipt;
}
