import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { generateReceiptNumber, generateVerificationCode } from '../utils/ids';

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

export async function createReceipt({ businessId, customerId, ...data }) {
  return createDoc(COL, {
    receiptNumber: generateReceiptNumber(),
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
