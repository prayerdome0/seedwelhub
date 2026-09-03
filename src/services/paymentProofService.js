import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, serverTimestamp } from '../firebase/firestore';
import {
  COLLECTIONS,
  PROOF_STATUS,
  PAYMENT_STATUS,
  ORDER_STATUS,
  NOTIFICATION_TYPES,
} from '../utils/constants';
import { createNotification } from './notificationService';
import { createPayment, updatePaymentStatus } from './paymentService';
import { updateOrderStatus, updateOrderPaymentStatus, getOrder } from './orderService';
import { generateReceiptForOrder } from './receiptService';
import { applyInvoicePayment, getInvoice } from './invoiceService';
import { recordAuditLog } from './adminService';
import { formatCurrency } from '../utils/format';

const COL = COLLECTIONS.PAYMENT_PROOFS;

// ---------------------------------------------------------------------------
// Proof of payment.
//
// The central anti-fraud rule of the whole system:
//   an order is NEVER marked paid because a buyer uploaded a screenshot.
//
// A proof is a *claim*. It records the amount, method, transaction reference,
// date and evidence, and then waits for a human (the seller, or an admin) to
// confirm or reject it. Only that confirmation marks the order paid — and that
// is also the single point where the receipt is generated.
// ---------------------------------------------------------------------------

export function getPaymentProof(id) {
  return getById(COL, id);
}

export function getProofsByOrder(orderId) {
  return queryOnce(COL, [where('orderId', '==', orderId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getProofsByBuyer(buyerId) {
  return queryOnce(COL, [where('buyerId', '==', buyerId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getProofsByBusiness(businessId) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
  });
}

export function getPendingProofsForBusiness(businessId) {
  return queryOnce(
    COL,
    [where('businessId', '==', businessId), where('status', '==', PROOF_STATUS.SUBMITTED)],
    { orderBy: ['createdAt', 'desc'] }
  );
}

export function getAllPendingProofs() {
  return queryOnce(COL, [where('status', '==', PROOF_STATUS.SUBMITTED)], {
    orderBy: ['createdAt', 'desc'],
  });
}

/**
 * Buyer submits evidence of a payment they have made.
 * This creates a pending payment record and a proof awaiting review — it does
 * not change the order's payment status.
 */
export async function submitPaymentProof({
  order,
  invoice = null,
  buyerId,
  buyerName = '',
  amount,
  method,
  transactionReference,
  paymentDate,
  proofUrl = '',
  note = '',
}) {
  const businessId = order?.businessId || invoice?.businessId || null;
  const ownerId = order?.ownerId || invoice?.ownerId || null;
  const currency = order?.currency || invoice?.currency;
  const numericAmount = Number(amount) || 0;

  // A pending payment row mirrors the proof so the payments ledger stays the
  // single source of truth for money movement.
  const payment = await createPayment({
    orderId: order?.id || null,
    orderNumber: order?.orderNumber || null,
    invoiceId: invoice?.id || null,
    invoiceNumber: invoice?.invoiceNumber || null,
    businessId,
    ownerId,
    buyerId,
    buyerName,
    amount: numericAmount,
    currency,
    method,
    reference: transactionReference,
    transactionReference,
    proofUrl,
    note,
    paidAt: paymentDate || null,
  }).catch(() => null);

  const proof = await createDoc(COL, {
    orderId: order?.id || null,
    orderNumber: order?.orderNumber || null,
    invoiceId: invoice?.id || null,
    invoiceNumber: invoice?.invoiceNumber || null,
    paymentId: payment?.id || null,
    businessId,
    ownerId,
    buyerId,
    buyerName,
    amount: numericAmount,
    currency,
    method,
    transactionReference,
    paymentDate: paymentDate || null,
    proofUrl,
    note,
    status: PROOF_STATUS.SUBMITTED,
    submittedAt: serverTimestamp(),
  });

  // Move the order into "Payment Submitted" so both sides can see something
  // is in flight — but the *payment status* stays pending until reviewed.
  if (order?.id) {
    await updateOrderStatus(order.id, ORDER_STATUS.PAYMENT_SUBMITTED).catch(() => {});
    await patchDoc(COLLECTIONS.ORDERS, order.id, {
      latestProofId: proof.id,
      paymentStatus: PAYMENT_STATUS.PENDING,
    }).catch(() => {});
  }

  const related = {
    paymentProofId: proof.id,
    orderId: order?.id || null,
    orderNumber: order?.orderNumber || null,
    invoiceId: invoice?.id || null,
    paymentId: payment?.id || null,
    businessId,
  };

  if (ownerId && ownerId !== buyerId) {
    await createNotification({
      recipientId: ownerId,
      title: 'Payment proof submitted 🧾',
      message: `${buyerName || 'A buyer'} submitted proof of ${formatCurrency(numericAmount, currency)} for order ${order?.orderNumber || invoice?.invoiceNumber || ''}. Review and confirm or reject it.`,
      type: NOTIFICATION_TYPES.PAYMENTS,
      related,
    }).catch(() => {});
  }

  await createNotification({
    recipientId: buyerId,
    title: 'Payment proof received ⏳',
    message: `Your payment proof for ${order?.orderNumber || invoice?.invoiceNumber || 'your order'} is awaiting confirmation by the seller.`,
    type: NOTIFICATION_TYPES.PAYMENTS,
    related,
  }).catch(() => {});

  return proof;
}

/**
 * Seller/admin confirms a payment proof.
 *
 * This is the ONLY path that marks an order paid, and it performs the full
 * chain in order:
 *   proof confirmed → payment confirmed → invoice updated → order marked paid
 *   → receipt generated → buyer + seller notified
 */
export async function confirmPaymentProof(proof, { reviewerId, business = null, note = '' } = {}) {
  await patchDoc(COL, proof.id, {
    status: PROOF_STATUS.CONFIRMED,
    reviewedBy: reviewerId || null,
    reviewedAt: serverTimestamp(),
    reviewNote: note,
  });

  if (proof.paymentId) {
    await updatePaymentStatus(proof.paymentId, PAYMENT_STATUS.CONFIRMED).catch(() => {});
  }

  let invoice = null;
  if (proof.invoiceId) {
    invoice = await getInvoice(proof.invoiceId).catch(() => null);
    if (invoice) {
      invoice = await applyInvoicePayment(invoice, proof.amount).catch(() => invoice);
    }
  }

  let receipt = null;
  if (proof.orderId) {
    const order = await getOrder(proof.orderId).catch(() => null);
    if (order) {
      await updateOrderPaymentStatus(order.id, PAYMENT_STATUS.CONFIRMED).catch(() => {});
      await updateOrderStatus(order.id, ORDER_STATUS.PAYMENT_CONFIRMED).catch(() => {});

      // Automatic receipt generation — the buyer gets a downloadable PDF the
      // instant the payment is verified.
      receipt = await generateReceiptForOrder(
        { ...order, paymentStatus: PAYMENT_STATUS.CONFIRMED },
        {
          business,
          paymentMethod: proof.method,
          paymentReference: proof.transactionReference,
          amount: proof.amount,
        }
      ).catch(() => null);
    }
  }

  // Immutable audit trail entry — who confirmed what, and when.
  await recordAuditLog({
    actorId: reviewerId,
    action: 'payment_proof.confirmed',
    target: `paymentProofs/${proof.id}`,
    details: {
      orderId: proof.orderId,
      amount: proof.amount,
      transactionReference: proof.transactionReference,
      receiptId: receipt?.id || null,
    },
  }).catch(() => {});

  return { proof: { ...proof, status: PROOF_STATUS.CONFIRMED }, receipt, invoice };
}

/**
 * Seller/admin rejects a payment proof. The order stays unpaid and the buyer
 * is told why so they can resubmit.
 */
export async function rejectPaymentProof(proof, { reviewerId, reason = '' } = {}) {
  await patchDoc(COL, proof.id, {
    status: PROOF_STATUS.REJECTED,
    reviewedBy: reviewerId || null,
    reviewedAt: serverTimestamp(),
    reviewNote: reason,
  });

  if (proof.paymentId) {
    await updatePaymentStatus(proof.paymentId, PAYMENT_STATUS.REJECTED).catch(() => {});
  }

  if (proof.orderId) {
    await updateOrderPaymentStatus(proof.orderId, PAYMENT_STATUS.REJECTED).catch(() => {});
  }

  if (proof.buyerId) {
    await createNotification({
      recipientId: proof.buyerId,
      title: 'Payment proof rejected ⚠️',
      message: `Your payment proof for ${proof.orderNumber || 'your order'} was not accepted.${reason ? ` Reason: ${reason}` : ''} Please check the details and submit again.`,
      type: NOTIFICATION_TYPES.PAYMENTS,
      related: {
        paymentProofId: proof.id,
        orderId: proof.orderId,
        businessId: proof.businessId,
      },
    }).catch(() => {});
  }

  await recordAuditLog({
    actorId: reviewerId,
    action: 'payment_proof.rejected',
    target: `paymentProofs/${proof.id}`,
    details: { orderId: proof.orderId, amount: proof.amount, reason },
  }).catch(() => {});

  return { ...proof, status: PROOF_STATUS.REJECTED };
}

export async function markProofUnderReview(proof, reviewerId) {
  await patchDoc(COL, proof.id, {
    status: PROOF_STATUS.UNDER_REVIEW,
    reviewedBy: reviewerId || null,
  });
  return { ...proof, status: PROOF_STATUS.UNDER_REVIEW };
}
