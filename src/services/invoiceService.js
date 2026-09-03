import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { generateInvoiceNumber, generateVerificationCode } from '../utils/ids';

const COL = COLLECTIONS.INVOICES;

export function getInvoice(id) {
  return getById(COL, id);
}

export function getInvoicesByBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getInvoicesByCustomer(customerId) {
  return queryOnce(COL, [where('customerId', '==', customerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export async function createInvoice({ businessId, customerId, items = [], ...data }) {
  const total = calculateTotal(items);
  const invoice = await createDoc(COL, {
    invoiceNumber: generateInvoiceNumber(),
    verificationCode: generateVerificationCode(),
    businessId,
    customerId,
    status: 'unpaid',
    ...data,
    items,
    total,
    amountPaid: 0,
    balance: total,
  });
  return invoice;
}

export async function updateInvoice(id, data) {
  return patchDoc(COL, id, data);
}

export function getInvoiceByVerificationCode(code) {
  return queryOnce(COL, [where('verificationCode', '==', code)], { limit: 1 });
}

function calculateTotal(items) {
  return (items || []).reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice ?? it.price) || 0;
    const discount = Number(it.discount) || 0;
    const tax = Number(it.tax) || 0;
    const sub = qty * price - discount;
    return sum + sub + (sub * tax) / 100;
  }, 0);
}

export { calculateTotal as calculateInvoiceTotal };
