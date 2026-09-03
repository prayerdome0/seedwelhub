import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, serverTimestamp } from '../firebase/firestore';
import {
  COLLECTIONS,
  DOCUMENT_TYPES,
  INVOICE_STATUS,
  NOTIFICATION_TYPES,
} from '../utils/constants';
import { generateVerificationCode } from '../utils/ids';
import { nextDocumentNumber } from './documentNumberService';
import { createNotification } from './notificationService';
import { formatCurrency } from '../utils/format';

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

export function getInvoicesByOwner(ownerId) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getInvoiceByOrder(orderId) {
  return queryOnce(COL, [where('orderId', '==', orderId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

function calculateTotal(items) {
  return (items || []).reduce((sum, it) => {
    const qty = Number(it.quantity) || 0;
    const price = Number(it.unitPrice ?? it.price) || 0;
    const discount = Number(it.discount) || 0;
    const tax = Number(it.tax ?? it.taxRate) || 0;
    const sub = qty * price - discount;
    return sum + sub + (sub * tax) / 100;
  }, 0);
}

export async function createInvoice({ businessId, customerId, items = [], ...data }) {
  const itemsTotal = calculateTotal(items);
  const delivery = Number(data.deliveryFee) || 0;
  const total = data.total != null ? Number(data.total) : itemsTotal + delivery;
  const { number } = await nextDocumentNumber(DOCUMENT_TYPES.INVOICE);

  return createDoc(COL, {
    invoiceNumber: number,
    verificationCode: generateVerificationCode(),
    businessId,
    customerId,
    // New invoices start as a draft so the seller can review before sending.
    status: INVOICE_STATUS.DRAFT,
    ...data,
    items,
    total,
    amountPaid: Number(data.amountPaid) || 0,
    balance: total - (Number(data.amountPaid) || 0),
  });
}

export async function updateInvoice(id, data) {
  return patchDoc(COL, id, data);
}

export function getInvoiceByVerificationCode(code) {
  return queryOnce(COL, [where('verificationCode', '==', code)], { limit: 1 });
}

export { calculateTotal as calculateInvoiceTotal };

// ---------------------------------------------------------------------------
// Invoice workflow
// DRAFT → SENT → VIEWED → PARTIALLY PAID → PAID → OVERDUE → CANCELLED
// ---------------------------------------------------------------------------

/**
 * Builds a draft invoice from an existing (unpaid) order so the seller can
 * review it before sending. Nothing is sent to the buyer at this stage.
 */
export async function createInvoiceFromOrder(order, { business, dueDate, terms, notes } = {}) {
  const items = (order.items || []).map((item) => ({
    name: item.name,
    description: item.description || '',
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.price ?? item.unitPrice) || 0,
    unit: item.unit || '',
    discount: 0,
    tax: 0,
  }));

  return createInvoice({
    businessId: order.businessId || business?.id || null,
    businessName: order.businessName || business?.name || '',
    ownerId: order.ownerId || business?.ownerId || null,
    customerId: order.buyerId,
    customerName: order.buyerName || '',
    customerPhone: order.buyerPhone || '',
    customerAddress: order.address || '',
    orderId: order.id,
    orderNumber: order.orderNumber,
    currency: order.currency,
    deliveryFee: Number(order.deliveryFee) || 0,
    items,
    dueDate: dueDate || null,
    terms: terms || '',
    notes: notes || '',
  });
}

/**
 * Sends a reviewed invoice to the buyer and notifies them.
 */
export async function sendInvoice(invoice, updates = {}) {
  const items = updates.items || invoice.items || [];
  const delivery = Number(updates.deliveryFee ?? invoice.deliveryFee) || 0;
  const total = updates.total != null ? Number(updates.total) : calculateTotal(items) + delivery;
  const amountPaid = Number(updates.amountPaid ?? invoice.amountPaid) || 0;

  await patchDoc(COL, invoice.id, {
    ...updates,
    items,
    deliveryFee: delivery,
    total,
    balance: total - amountPaid,
    status: INVOICE_STATUS.SENT,
    sentAt: serverTimestamp(),
    issuedAt: invoice.issuedAt || serverTimestamp(),
  });

  if (invoice.customerId) {
    await createNotification({
      recipientId: invoice.customerId,
      title: `New invoice from ${invoice.businessName || 'seller'} 📄`,
      message: `Invoice ${invoice.invoiceNumber} for ${formatCurrency(total, invoice.currency)} is ready. View it, download the PDF or pay.`,
      type: NOTIFICATION_TYPES.INVOICES,
      related: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        businessId: invoice.businessId,
        orderId: invoice.orderId || null,
      },
    }).catch(() => {});
  }

  return { ...invoice, ...updates, items, total, status: INVOICE_STATUS.SENT };
}

/**
 * Records that the buyer opened a sent invoice (SENT → VIEWED only).
 */
export async function markInvoiceViewed(invoice, viewerId) {
  if (!invoice || invoice.status !== INVOICE_STATUS.SENT) return invoice;
  if (invoice.customerId !== viewerId) return invoice;
  await patchDoc(COL, invoice.id, {
    status: INVOICE_STATUS.VIEWED,
    viewedAt: serverTimestamp(),
  }).catch(() => {});
  return { ...invoice, status: INVOICE_STATUS.VIEWED };
}

/**
 * Applies a confirmed payment to an invoice, moving it to PARTIALLY PAID or
 * PAID depending on the remaining balance.
 */
export async function applyInvoicePayment(invoice, amount) {
  const paid = (Number(invoice.amountPaid) || 0) + (Number(amount) || 0);
  const total = Number(invoice.total) || 0;
  const balance = Math.max(0, total - paid);
  const status = balance <= 0.009 ? INVOICE_STATUS.PAID : INVOICE_STATUS.PARTIALLY_PAID;

  await patchDoc(COL, invoice.id, {
    amountPaid: paid,
    balance,
    status,
    ...(status === INVOICE_STATUS.PAID ? { paidAt: serverTimestamp() } : {}),
  });

  return { ...invoice, amountPaid: paid, balance, status };
}

export async function setInvoiceStatus(invoice, status) {
  await patchDoc(COL, invoice.id, {
    status,
    ...(status === INVOICE_STATUS.CANCELLED ? { cancelledAt: serverTimestamp() } : {}),
  });
  return { ...invoice, status };
}
