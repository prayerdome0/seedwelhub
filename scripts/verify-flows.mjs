import assert from 'node:assert/strict';
import { resetStore, store } from './firestore-mock.mjs';

// ---------------------------------------------------------------------------
// End-to-end workflow verification.
//
// These run the REAL service layer against an in-memory Firestore, so the
// actual business rules execute: status transitions, receipt generation,
// notification fan-out and the anti-fraud invariants.
//
// Flow A: buyer -> order -> payment instructions -> proof -> seller
//         confirmation -> receipt -> notification
// Flow B: buyer -> quotation request -> seller response -> quotation ->
//         buyer notification -> acceptance
// ---------------------------------------------------------------------------

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

const C = await import('../src/utils/constants.js');
const { placeOrder, getOrder } = await import('../src/services/orderService.js');
const { submitPaymentProof, confirmPaymentProof, rejectPaymentProof, markProofUnderReview,
        getPendingProofsForBusiness } = await import('../src/services/paymentProofService.js');
const { getReceiptByOrder, getReceiptsByCustomer } = await import('../src/services/receiptService.js');
const { createPaymentMethod, getPaymentInstructionsForBuyer, getAcceptedMethodSummary } =
  await import('../src/services/sellerPaymentService.js');
const { requestQuotation, respondToQuotationRequest, sendQuotation, markQuotationViewed,
        decideQuotation, getQuotationsByBusiness } = await import('../src/services/quotationService.js');
const { createInvoiceFromOrder, sendInvoice, markInvoiceViewed, applyInvoicePayment,
        getInvoicesByCustomer } = await import('../src/services/invoiceService.js');

const BUYER = { uid: 'buyer_1', name: 'John Banda', email: 'john@test.com', phone: '+260961111111' };
const SELLER = { uid: 'seller_1' };
const BUSINESS = {
  id: 'biz_1', ownerId: SELLER.uid, name: 'Phiko Trading',
  email: 'sales@phiko.test', phone: '+260970000000', currency: 'ZMW',
};

const notifs = () => [...(store.get(C.COLLECTIONS.NOTIFICATIONS)?.values() || [])];
const notifsFor = (uid) => notifs().filter((n) => n.recipientId === uid);

// ===========================================================================
console.log('\nFLOW A — ORDER → PAYMENT → PROOF → CONFIRMATION → RECEIPT');
// ===========================================================================
resetStore();
store.set(C.COLLECTIONS.BUSINESSES, new Map([[BUSINESS.id, BUSINESS]]));

let order;
await check('buyer places an order', async () => {
  order = await placeOrder({
    buyerId: BUYER.uid, buyerName: BUYER.name, buyerPhone: BUYER.phone,
    businessId: BUSINESS.id, businessName: BUSINESS.name, ownerId: SELLER.uid,
    items: [{ productId: 'p1', name: 'Maize 50kg', quantity: 2, price: 300 }],
    deliveryFee: 50, currency: 'ZMW',
    address: 'Lusaka', paymentMethod: 'mobile_money',
  });
  assert.ok(order?.id, 'order was not created');
  assert.equal(order.total, 650, 'total should be items 600 + delivery 50');
});

await check('new order starts UNPAID (never assumed paid)', () => {
  assert.notEqual(order.paymentStatus, C.PAYMENT_STATUS.CONFIRMED);
});

await check('seller is notified of the new order', () => {
  assert.ok(notifsFor(SELLER.uid).length >= 1, 'seller received no notification');
});

// --- payment instructions gate --------------------------------------------
await check('seller configures a payment method', async () => {
  await createPaymentMethod(BUSINESS.id, SELLER.uid, {
    type: 'mobile_money', label: 'Airtel Money',
    details: { provider: 'Airtel', phoneNumber: '+260970000000', accountName: 'Phiko Trading' },
    instructions: 'Use your order number as the reference.',
    isActive: true,
  });
  const methods = await getAcceptedMethodSummary(BUSINESS.id);
  assert.equal(methods.length, 1);
});

await check('checkout summary exposes NO account numbers', async () => {
  const summary = await getAcceptedMethodSummary(BUSINESS.id);
  const blob = JSON.stringify(summary);
  assert.ok(!blob.includes('+260970000000'), 'phone number leaked at checkout');
  assert.ok(!blob.includes('details'), 'raw details leaked at checkout');
  assert.match(blob, /Airtel Money/);
});

await check('the real buyer on the order DOES get full instructions', async () => {
  const methods = await getPaymentInstructionsForBuyer({
    businessId: BUSINESS.id, buyerId: BUYER.uid, order,
  });
  assert.equal(methods.length, 1);
  assert.equal(methods[0].details.phoneNumber, '+260970000000');
});

await check('an unrelated user gets NOTHING', async () => {
  const methods = await getPaymentInstructionsForBuyer({
    businessId: BUSINESS.id, buyerId: 'random_user', order,
  });
  assert.deepEqual(methods, []);
});

// --- proof of payment ------------------------------------------------------
let proof;
await check('buyer submits proof of payment', async () => {
  proof = await submitPaymentProof({
    order, buyerId: BUYER.uid, buyerName: BUYER.name,
    amount: 650, currency: 'ZMW', method: 'mobile_money',
    transactionReference: 'MP240903.1423.A1',
    paymentDate: '2026-09-03', proofUrl: 'https://cdn.test/proof.jpg',
    note: 'Paid in full.',
  });
  assert.ok(proof?.id, 'proof was not stored');
});

await check('ANTI-FRAUD: uploading proof does NOT mark the order paid', async () => {
  const after = await getOrder(order.id);
  assert.notEqual(after.paymentStatus, C.PAYMENT_STATUS.CONFIRMED,
    'CRITICAL: a screenshot alone marked the order paid');
  assert.equal(proof.status, C.PROOF_STATUS.SUBMITTED);
});

await check('ANTI-FRAUD: no receipt is issued before verification', async () => {
  const found = await getReceiptByOrder(order.id);
  assert.equal(found.length, 0, 'CRITICAL: receipt issued before the seller verified payment');
});

await check('the transaction reference is recorded for audit', () => {
  assert.equal(proof.transactionReference, 'MP240903.1423.A1');
});

await check('order moves to a "payment submitted" state', async () => {
  const after = await getOrder(order.id);
  assert.notEqual(after.status, order.status, 'order status did not advance');
});

await check('seller is notified of the submitted proof', () => {
  assert.ok(notifsFor(SELLER.uid).length >= 2);
});

await check('proof appears in the seller review queue', async () => {
  const queue = await getPendingProofsForBusiness(BUSINESS.id);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].transactionReference, 'MP240903.1423.A1');
});

await check('seller can mark the proof under review', async () => {
  await markProofUnderReview(proof, SELLER.uid);
  const updated = store.get(C.COLLECTIONS.PAYMENT_PROOFS).get(proof.id);
  assert.equal(updated.status, C.PROOF_STATUS.UNDER_REVIEW);
});

// --- seller confirmation ---------------------------------------------------
await check('seller confirms the payment', async () => {
  await confirmPaymentProof({ ...proof, status: C.PROOF_STATUS.UNDER_REVIEW },
    { reviewerId: SELLER.uid, business: BUSINESS, note: 'Verified against statement.' });
  const updated = store.get(C.COLLECTIONS.PAYMENT_PROOFS).get(proof.id);
  assert.equal(updated.status, C.PROOF_STATUS.CONFIRMED);
});

await check('order is now marked PAID', async () => {
  const after = await getOrder(order.id);
  assert.equal(after.paymentStatus, C.PAYMENT_STATUS.CONFIRMED);
});

let receipt;
await check('a receipt is generated automatically', async () => {
  // getReceiptByOrder is a limit-1 query, so it resolves to an array.
  const found = await getReceiptByOrder(order.id);
  assert.ok(Array.isArray(found), 'getReceiptByOrder should resolve to an array');
  receipt = found[0];
  assert.ok(receipt, 'no receipt was generated after confirmation');
});

await check('receipt carries a SH-RCP document number', () => {
  assert.match(receipt.receiptNumber, /^SH-RCP-\d{6}$/);
});

await check('receipt records amount, method and reference', () => {
  assert.equal(Number(receipt.amount), 650);
  assert.equal(receipt.paymentReference, 'MP240903.1423.A1');
});

await check('receipt has a verification code', () => {
  assert.ok(receipt.verificationCode, 'no verification reference on the receipt');
});

await check('receipt is linked to the order', () => {
  assert.equal(receipt.orderId, order.id);
});

await check('buyer can find the receipt in their list', async () => {
  const list = await getReceiptsByCustomer(BUYER.uid);
  assert.equal(list.length, 1);
});

await check('buyer is notified that payment was confirmed', () => {
  const buyerNotifs = notifsFor(BUYER.uid);
  assert.ok(buyerNotifs.length >= 1, 'buyer never notified');
  const text = JSON.stringify(buyerNotifs).toLowerCase();
  assert.ok(/confirm|receipt|paid/.test(text), 'no payment-confirmed notification');
});

await check('receipt renders as a PDF-ready document', async () => {
  const { buildDocument } = await import('../src/documents/model.js');
  const doc = buildDocument(C.DOCUMENT_TYPES.RECEIPT, receipt, { business: BUSINESS });
  assert.equal(doc.title, 'PAYMENT RECEIPT');
  assert.match(doc.number, /^SH-RCP-/);
  assert.equal(doc.statusLabel, 'PAID');
});

// --- rejection path --------------------------------------------------------
console.log('\nFLOW A2 — REJECTED PROOF MUST NOT PAY THE ORDER');
resetStore();
store.set(C.COLLECTIONS.BUSINESSES, new Map([[BUSINESS.id, BUSINESS]]));

let order2, proof2;
await check('a second order with a bad proof is set up', async () => {
  order2 = await placeOrder({
    buyerId: BUYER.uid, buyerName: BUYER.name, businessId: BUSINESS.id,
    businessName: BUSINESS.name, ownerId: SELLER.uid,
    items: [{ productId: 'p2', name: 'Fertiliser', quantity: 1, price: 400 }],
    deliveryFee: 0, currency: 'ZMW',
  });
  proof2 = await submitPaymentProof({
    order: order2, buyerId: BUYER.uid, buyerName: BUYER.name,
    amount: 400, currency: 'ZMW', method: 'bank_transfer',
    transactionReference: 'FAKE-REF', proofUrl: 'https://cdn.test/fake.jpg',
  });
  assert.ok(proof2?.id);
});

await check('seller rejects the proof', async () => {
  await rejectPaymentProof(proof2, { reviewerId: SELLER.uid, reason: 'No matching deposit.' });
  const updated = store.get(C.COLLECTIONS.PAYMENT_PROOFS).get(proof2.id);
  assert.equal(updated.status, C.PROOF_STATUS.REJECTED);
});

await check('ANTI-FRAUD: rejected proof leaves the order unpaid', async () => {
  const after = await getOrder(order2.id);
  assert.notEqual(after.paymentStatus, C.PAYMENT_STATUS.CONFIRMED);
});

await check('ANTI-FRAUD: no receipt exists for a rejected payment', async () => {
  assert.equal((await getReceiptByOrder(order2.id)).length, 0);
});

await check('buyer is told the payment was rejected', () => {
  const text = JSON.stringify(notifsFor(BUYER.uid)).toLowerCase();
  assert.ok(/reject|not.*confirm|declin/.test(text), 'buyer not told about rejection');
});

// ===========================================================================
console.log('\nFLOW B — QUOTATION REQUEST → SELLER → QUOTATION → BUYER → PDF');
// ===========================================================================
resetStore();
store.set(C.COLLECTIONS.BUSINESSES, new Map([[BUSINESS.id, BUSINESS]]));

let quotation;
await check('buyer submits a quotation request', async () => {
  quotation = await requestQuotation({
    businessId: BUSINESS.id, businessName: BUSINESS.name, ownerId: SELLER.uid,
    customerId: BUYER.uid, customerName: BUYER.name,
    customerEmail: BUYER.email, customerPhone: BUYER.phone,
    productService: 'Maize 50kg bags', quantity: '100',
    requirements: 'Grade A, delivered to Lusaka.',
    message: 'Need pricing for a bulk order.',
    preferredDelivery: '2026-10-01',
  });
  assert.ok(quotation?.id);
});

await check('request starts in REQUESTED status', () => {
  assert.equal(quotation.status, C.QUOTATION_STATUS.REQUESTED);
});

await check('the buyer brief is captured in full', () => {
  assert.match(JSON.stringify(quotation), /Maize 50kg bags/);
  assert.equal(quotation.request.quantity, 100);
  assert.match(JSON.stringify(quotation), /Grade A/);
});

await check('seller is notified of the request', () => {
  const text = JSON.stringify(notifsFor(SELLER.uid)).toLowerCase();
  assert.ok(notifsFor(SELLER.uid).length >= 1, 'seller not notified');
  assert.ok(/quotation|quote|request/.test(text));
});

await check('request appears in the seller quotation list', async () => {
  const list = await getQuotationsByBusiness(BUSINESS.id);
  assert.equal(list.length, 1);
  assert.equal(list[0].status, C.QUOTATION_STATUS.REQUESTED);
});

await check('seller can request clarification', async () => {
  await respondToQuotationRequest(quotation, 'clarify', { note: 'Delivery to which depot?' });
  const updated = store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id);
  assert.equal(updated.status, C.QUOTATION_STATUS.CLARIFICATION);
});

await check('buyer is notified of the clarification request', () => {
  assert.ok(notifsFor(BUYER.uid).length >= 1);
});

await check('seller accepts the request', async () => {
  const current = { id: quotation.id, ...store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id) };
  await respondToQuotationRequest(current, 'accept', { note: 'Preparing your quote.' });
  const updated = store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id);
  assert.ok([C.QUOTATION_STATUS.DRAFT, C.QUOTATION_STATUS.ACCEPTED].includes(updated.status),
    `unexpected status ${updated.status}`);
});

await check('seller prices it and sends the quotation', async () => {
  const current = { id: quotation.id, ...store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id) };
  await sendQuotation(current, {
    items: [{ name: 'Maize 50kg', quantity: 100, unitPrice: 280 }],
    deliveryFee: 1500, taxTotal: 0, validUntil: '2026-10-15',
    terms: '50% deposit required.', sellerNotes: 'Bulk rate applied.',
  });
  const updated = store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id);
  assert.equal(updated.status, C.QUOTATION_STATUS.SENT);
});

await check('quotation has a SH-QUO document number', () => {
  const updated = store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id);
  assert.match(updated.quotationNumber, /^SH-QUO-\d{6}$/);
});

await check('buyer is notified the quotation is ready', () => {
  const text = JSON.stringify(notifsFor(BUYER.uid)).toLowerCase();
  assert.ok(/quotation|quote/.test(text));
});

await check('quotation renders as a complete PDF-ready document', async () => {
  const { buildDocument } = await import('../src/documents/model.js');
  const updated = { id: quotation.id, ...store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id) };
  const doc = buildDocument(C.DOCUMENT_TYPES.QUOTATION, updated, { business: BUSINESS });
  assert.equal(doc.title, 'QUOTATION');
  assert.match(doc.number, /^SH-QUO-/);
  assert.equal(doc.seller.name, 'Phiko Trading');       // seller info
  assert.equal(doc.customer.name, 'John Banda');        // buyer info
  assert.ok(doc.items.length > 0);                      // items + qty + unit price
  assert.ok(doc.meta.some((m) => m.label === 'Valid until'));
  assert.ok(doc.totals.some((t) => t.label === 'Delivery'));
  const total = doc.totals.find((t) => t.label === 'Total');
  assert.equal(total.value, 100 * 280 + 1500);          // subtotal + delivery
  assert.equal(doc.terms, '50% deposit required.');
  assert.equal(doc.notes, 'Bulk rate applied.');
});

await check('viewing the quotation marks it VIEWED', async () => {
  const current = { id: quotation.id, ...store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id) };
  await markQuotationViewed(current, BUYER.uid);
  const updated = store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id);
  assert.equal(updated.status, C.QUOTATION_STATUS.VIEWED);
});

await check('buyer accepts the quotation', async () => {
  const current = { id: quotation.id, ...store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id) };
  await decideQuotation(current, true, { note: 'Please proceed.' });
  const updated = store.get(C.COLLECTIONS.QUOTATIONS).get(quotation.id);
  assert.equal(updated.status, C.QUOTATION_STATUS.ACCEPTED);
});

await check('seller is notified of the acceptance', () => {
  const text = JSON.stringify(notifsFor(SELLER.uid)).toLowerCase();
  assert.ok(/accept/.test(text), 'seller not told the quote was accepted');
});

// ===========================================================================
console.log('\nFLOW C — INVOICE LIFECYCLE');
// ===========================================================================
resetStore();
store.set(C.COLLECTIONS.BUSINESSES, new Map([[BUSINESS.id, BUSINESS]]));

let invoice, invOrder;
await check('seller raises an invoice from an order', async () => {
  invOrder = await placeOrder({
    buyerId: BUYER.uid, buyerName: BUYER.name, businessId: BUSINESS.id,
    businessName: BUSINESS.name, ownerId: SELLER.uid,
    items: [{ productId: 'p1', name: 'Maize 50kg', quantity: 4, price: 300 }],
    deliveryFee: 100, currency: 'ZMW',
  });
  invoice = await createInvoiceFromOrder(invOrder, { business: BUSINESS });
  assert.ok(invoice?.id, 'invoice was not created');
});

await check('new invoice starts as DRAFT', () => {
  assert.equal(invoice.status, C.INVOICE_STATUS.DRAFT);
});

await check('invoice has a SH-INV number and copies the order items', () => {
  assert.match(invoice.invoiceNumber, /^SH-INV-\d{6}$/);
  assert.equal(invoice.items.length, 1);
});

await check('sending moves it to SENT and notifies the buyer', async () => {
  await sendInvoice(invoice);
  const updated = store.get(C.COLLECTIONS.INVOICES).get(invoice.id);
  assert.equal(updated.status, C.INVOICE_STATUS.SENT);
  const text = JSON.stringify(notifsFor(BUYER.uid)).toLowerCase();
  assert.ok(/invoice/.test(text), 'buyer not notified of the invoice');
});

await check('buyer opening it marks VIEWED', async () => {
  const current = { id: invoice.id, ...store.get(C.COLLECTIONS.INVOICES).get(invoice.id) };
  await markInvoiceViewed(current, BUYER.uid);
  assert.equal(store.get(C.COLLECTIONS.INVOICES).get(invoice.id).status, C.INVOICE_STATUS.VIEWED);
});

await check('a part payment moves it to PARTIALLY PAID', async () => {
  const current = { id: invoice.id, ...store.get(C.COLLECTIONS.INVOICES).get(invoice.id) };
  await applyInvoicePayment(current, 500);
  const updated = store.get(C.COLLECTIONS.INVOICES).get(invoice.id);
  assert.equal(updated.status, C.INVOICE_STATUS.PARTIALLY_PAID);
  assert.equal(Number(updated.amountPaid), 500);
});

await check('paying the balance moves it to PAID', async () => {
  const current = { id: invoice.id, ...store.get(C.COLLECTIONS.INVOICES).get(invoice.id) };
  await applyInvoicePayment(current, 800);
  const updated = store.get(C.COLLECTIONS.INVOICES).get(invoice.id);
  assert.equal(updated.status, C.INVOICE_STATUS.PAID);
});

await check('buyer sees the invoice in their list', async () => {
  const list = await getInvoicesByCustomer(BUYER.uid);
  assert.equal(list.length, 1);
});

console.log(`\n${passed} assertions passed.`);
