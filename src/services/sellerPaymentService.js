import { createDoc, getById, patchDoc, queryOnce, removeDoc } from './_base';
import { where } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';

const COL = COLLECTIONS.PAYMENT_METHODS;

// ---------------------------------------------------------------------------
// Seller payment settings.
//
// Security note — payment details (account numbers, mobile money numbers) are
// deliberately NOT public profile data. They are only released to a buyer who
// has an active transaction with that seller. `getPaymentInstructionsForBuyer`
// is the only read path the buyer-facing UI uses, and it verifies the
// relationship first. The seller's own management screen uses
// `getSellerPaymentMethods`, which is scoped to the businesses they own.
// ---------------------------------------------------------------------------

export function getSellerPaymentMethods(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'asc'],
  });
}

export function getPaymentMethod(id) {
  return getById(COL, id);
}

export async function createPaymentMethod(businessId, ownerId, data) {
  return createDoc(COL, {
    businessId,
    ownerId,
    type: data.type,
    label: data.label || '',
    details: data.details || {},
    instructions: data.instructions || '',
    isActive: data.isActive !== false,
  });
}

export async function updatePaymentMethod(id, data) {
  return patchDoc(COL, id, data);
}

export async function deletePaymentMethod(id) {
  return removeDoc(COL, id);
}

export async function setPaymentMethodActive(id, isActive) {
  return patchDoc(COL, id, { isActive });
}

/**
 * Returns the seller's payment instructions for a buyer, but only when that
 * buyer has a genuine active transaction with the seller (an order they own,
 * or an invoice addressed to them). Anyone else gets an empty list.
 *
 * @param {object} options
 * @param {string} options.businessId
 * @param {string} options.buyerId
 * @param {object} [options.order]    the order being paid for
 * @param {object} [options.invoice]  the invoice being paid
 */
export async function getPaymentInstructionsForBuyer({
  businessId,
  buyerId,
  order = null,
  invoice = null,
}) {
  if (!businessId || !buyerId) return [];

  // Verify the requesting buyer actually owns the transaction they are
  // claiming. Without this the check would be trivially bypassable.
  const ownsOrder = Boolean(order) && order.buyerId === buyerId && order.businessId === businessId;
  const ownsInvoice =
    Boolean(invoice) && invoice.customerId === buyerId && invoice.businessId === businessId;

  if (!ownsOrder && !ownsInvoice) return [];

  const methods = await getSellerPaymentMethods(businessId).catch(() => []);
  return (methods || []).filter((method) => method.isActive !== false);
}

/**
 * A NON-SENSITIVE summary of the payment channels a seller accepts.
 *
 * Used at checkout, where no order exists yet and therefore no buyer/seller
 * relationship can be verified. It returns only the method type and label -
 * never `details`, so account numbers and mobile money numbers cannot leak to
 * someone merely browsing a product page. The full instructions are released
 * afterwards by getPaymentInstructionsForBuyer, once a real order exists.
 *
 * @param {string} businessId
 * @returns {Promise<Array<{id: string, type: string, label: string}>>}
 */
export async function getAcceptedMethodSummary(businessId) {
  if (!businessId) return [];
  const methods = await getSellerPaymentMethods(businessId).catch(() => []);
  return (methods || [])
    .filter((method) => method.isActive !== false)
    .map((method) => ({
      id: method.id,
      type: method.type,
      label: method.label || '',
    }));
}
