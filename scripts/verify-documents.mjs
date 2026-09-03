// Verifies the shared document model normalises every entity type correctly.
// Run with: node scripts/verify-documents.mjs
import assert from 'node:assert/strict';

// Stub the browser-only asset imports the model tree pulls in.
const { buildDocument, normalizeInvoiceStatus } = await import('../src/documents/model.js');
const { DOCUMENT_TYPES, INVOICE_STATUS } = await import('../src/utils/constants.js');

let passed = 0;
const check = (name, fn) => {
  try { fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (err) { console.error(`  ✗ ${name}\n    ${err.message}`); process.exitCode = 1; }
};

const business = {
  id: 'b1', name: 'Phiko Trading', ownerName: 'A. Phiri',
  email: 'sales@phiko.test', phone: '+260 97 000 0000',
  address: 'Lusaka, Zambia', currency: 'ZMW',
};

console.log('\nRECEIPT');
const receipt = buildDocument(DOCUMENT_TYPES.RECEIPT, {
  receiptNumber: 'SH-RCP-000001',
  customerName: 'John Banda', customerPhone: '+260 96 111 1111',
  amount: 750, currency: 'ZMW', paymentMethod: 'mobile_money',
  paymentReference: 'MP240903.1423.A1', orderNumber: 'ORD-1',
  verificationCode: 'ABC123',
  items: [
    { name: 'Product A', quantity: 2, price: 250 },
    { name: 'Product B', quantity: 1, price: 250 },
  ],
}, { business });

check('title is PAYMENT RECEIPT', () => assert.equal(receipt.title, 'PAYMENT RECEIPT'));
check('number carries SH-RCP prefix', () => assert.match(receipt.number, /^SH-RCP-\d{6}$/));
check('seller resolved from business', () => assert.equal(receipt.seller.name, 'Phiko Trading'));
check('buyer resolved', () => assert.equal(receipt.customer.name, 'John Banda'));
check('items normalised', () => assert.equal(receipt.items.length, 2));
check('line amount = qty x price', () => assert.equal(receipt.items[0].amount, 500));
check('subtotal computed', () => {
  const sub = receipt.totals.find(t => t.label === 'Subtotal');
  assert.equal(sub.value, 750);
});
check('total paid marked strong', () => {
  const total = receipt.totals.find(t => t.label === 'Total Paid');
  assert.equal(total.value, 750); assert.equal(total.strong, true);
});
check('status PAID', () => assert.equal(receipt.statusLabel, 'PAID'));
check('currency inherited', () => assert.equal(receipt.currency, 'ZMW'));
check('verification preserved', () => assert.equal(receipt.verificationCode, 'ABC123'));

console.log('\nINVOICE');
const invoice = buildDocument(DOCUMENT_TYPES.INVOICE, {
  invoiceNumber: 'SH-INV-000001', status: 'sent',
  customerName: 'Jane Zulu', currency: 'ZMW',
  total: 1150, amountPaid: 150, balance: 1000, deliveryFee: 50,
  dueDate: '2026-10-01',
  items: [{ name: 'Consulting', quantity: 10, unitPrice: 100, tax: 10 }],
}, { business });

check('title is INVOICE', () => assert.equal(invoice.title, 'INVOICE'));
check('tax computed per line', () => assert.equal(invoice.items[0].tax, 100));
check('line amount includes tax', () => assert.equal(invoice.items[0].amount, 1100));
check('balance due present', () => {
  const bal = invoice.totals.find(t => t.label === 'Balance due');
  assert.equal(bal.value, 1000);
});
check('delivery shown', () => assert.ok(invoice.totals.some(t => t.label === 'Delivery')));
check('status label uppercased', () => assert.equal(invoice.statusLabel, 'SENT'));

console.log('\nLEGACY INVOICE STATUS');
check('unpaid maps to sent', () => assert.equal(normalizeInvoiceStatus('unpaid'), INVOICE_STATUS.SENT));
check('paid stays paid', () => assert.equal(normalizeInvoiceStatus('paid'), INVOICE_STATUS.PAID));
check('unknown falls back to draft', () => assert.equal(normalizeInvoiceStatus('zzz'), INVOICE_STATUS.DRAFT));
check('legacy invoice still renders', () => {
  const legacy = buildDocument(DOCUMENT_TYPES.INVOICE, {
    invoiceNumber: 'INV-1', status: 'unpaid', total: 100, items: [],
  }, { business });
  assert.equal(legacy.statusLabel, 'SENT');
});

console.log('\nQUOTATION');
const quotation = buildDocument(DOCUMENT_TYPES.QUOTATION, {
  quotationNumber: 'SH-QUO-000001', status: 'sent',
  customerName: 'Mary Mwale', currency: 'ZMW',
  validUntil: '2026-10-15', deliveryFee: 200,
  terms: 'Payment on delivery.', sellerNotes: 'Bulk discount applied.',
  items: [{ name: 'Maize (50kg)', quantity: 20, unitPrice: 300 }],
}, { business });

check('title is QUOTATION', () => assert.equal(quotation.title, 'QUOTATION'));
check('prepared-for heading data', () => assert.equal(quotation.customer.name, 'Mary Mwale'));
check('valid until in meta', () => assert.ok(quotation.meta.some(m => m.label === 'Valid until')));
check('delivery included in totals', () => {
  const d = quotation.totals.find(t => t.label === 'Delivery');
  assert.equal(d.value, 200);
});
check('total = items + delivery', () => {
  const t = quotation.totals.find(x => x.label === 'Total');
  assert.equal(t.value, 6200);
});
check('terms carried', () => assert.equal(quotation.terms, 'Payment on delivery.'));
check('seller notes carried', () => assert.equal(quotation.notes, 'Bulk discount applied.'));

console.log('\nORDER CONFIRMATION');
const order = buildDocument(DOCUMENT_TYPES.ORDER_CONFIRMATION, {
  orderNumber: 'ORD-20260903-0001', status: 'Order Placed',
  paymentStatus: 'pending', buyerName: 'Peter N', currency: 'ZMW',
  subtotal: 500, deliveryFee: 50, total: 550, address: 'Kabulonga',
  items: [{ name: 'Chair', quantity: 5, price: 100 }],
}, { business });
check('title is ORDER CONFIRMATION', () => assert.equal(order.title, 'ORDER CONFIRMATION'));
check('order total correct', () => {
  const t = order.totals.find(x => x.label === 'Total');
  assert.equal(t.value, 550);
});

console.log('\nPAYMENT CONFIRMATION');
const pay = buildDocument(DOCUMENT_TYPES.PAYMENT_CONFIRMATION, {
  reference: 'PAY-XY12-3456', amount: 750, method: 'bank_transfer',
  transactionReference: 'TRX99', currency: 'ZMW',
}, { business });
check('title is PAYMENT CONFIRMATION', () => assert.equal(pay.title, 'PAYMENT CONFIRMATION'));
check('amount confirmed', () => assert.equal(pay.totals[0].value, 750));

console.log('\nEDGE CASES');
check('missing data never throws', () => {
  const d = buildDocument(DOCUMENT_TYPES.RECEIPT, {}, {});
  assert.equal(d.number, '—');
  assert.equal(d.seller.name, 'Seller');
  assert.equal(d.customer.name, 'Customer');
});
check('null items handled', () => {
  const d = buildDocument(DOCUMENT_TYPES.INVOICE, { items: null }, {});
  assert.deepEqual(d.items, []);
});
check('string numbers coerced', () => {
  const d = buildDocument(DOCUMENT_TYPES.INVOICE, {
    items: [{ name: 'X', quantity: '3', unitPrice: '25.50' }],
  }, {});
  assert.equal(d.items[0].amount, 76.5);
});
check('discount reduces line amount', () => {
  const d = buildDocument(DOCUMENT_TYPES.INVOICE, {
    items: [{ name: 'X', quantity: 2, unitPrice: 100, discount: 50 }],
  }, {});
  assert.equal(d.items[0].amount, 150);
});

console.log(`\n${passed} assertions passed.`);
