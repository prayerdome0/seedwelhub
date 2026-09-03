import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { generateQuoteNumber, generateVerificationCode } from '../utils/ids';

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

export async function createQuotation({ businessId, customerId, items = [], ...data }) {
  const quotation = await createDoc(COL, {
    quotationNumber: generateQuoteNumber(),
    verificationCode: generateVerificationCode(),
    businessId,
    customerId,
    status: 'draft',
    ...data,
    items,
  });
  return quotation;
}

export async function updateQuotation(id, data) {
  return patchDoc(COL, id, data);
}

export function getQuotationByVerificationCode(code) {
  return queryOnce(COL, [where('verificationCode', '==', code)], { limit: 1 });
}
