import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS, PAYMENT_STATUS } from '../utils/constants';

const COL = COLLECTIONS.PAYMENTS;

export function getPayment(id) {
  return getById(COL, id);
}

export function getPaymentsByBuyer(buyerId) {
  return queryOnce(COL, [where('buyerId', '==', buyerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getPaymentsByBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function createPayment(data) {
  return createDoc(COL, {
    ...data,
    status: PAYMENT_STATUS.PENDING,
  });
}

export async function updatePaymentStatus(id, status) {
  return patchDoc(COL, id, { status });
}

export async function countPayments() {
  const all = await queryOnce(COL, []);
  return all.length;
}

export function getPendingPayments() {
  return queryOnce(COL, [where('status', '==', PAYMENT_STATUS.PENDING)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function getPaymentInstructions(businessId) {
  const methods = await queryOnce(
    COLLECTIONS.PAYMENT_METHODS,
    [where('businessId', '==', businessId)],
    { orderBy: ['createdAt', 'asc'] }
  );
  return methods;
}

export function getPaymentsByOwner(ownerId) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getPaymentsByOrder(orderId) {
  return queryOnce(COL, [where('orderId', '==', orderId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getPayment_ByReference(reference) {
  return queryOnce(COL, [where('transactionReference', '==', reference)]);
}

/**
 * Duplicate transaction-reference detection.
 *
 * The same bank/mobile-money reference being submitted against more than one
 * order is one of the strongest signals of a recycled payment screenshot, so
 * the reference is checked before a seller confirms a proof.
 */
export async function findDuplicateReferences(reference, excludeOrderId = null) {
  if (!reference) return [];
  const matches = await queryOnce(COL, [
    where('transactionReference', '==', String(reference).trim()),
  ]).catch(() => []);
  return (matches || []).filter((payment) => payment.orderId !== excludeOrderId);
}
