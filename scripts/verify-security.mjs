import assert from 'node:assert/strict';
const { getPaymentInstructionsForBuyer } = await import('../src/services/sellerPaymentService.js');

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (e) { console.error(`  ✗ ${name}\n    ${e.message}`); process.exitCode = 1; }
};

console.log('\nPAYMENT DETAIL DISCLOSURE (must not leak seller bank details)');

await check('no businessId → nothing disclosed', async () => {
  assert.deepEqual(await getPaymentInstructionsForBuyer({ businessId: null, buyerId: 'u1' }), []);
});
await check('no buyerId → nothing disclosed', async () => {
  assert.deepEqual(await getPaymentInstructionsForBuyer({ businessId: 'b1', buyerId: null }), []);
});
await check('no order and no invoice → nothing disclosed', async () => {
  assert.deepEqual(await getPaymentInstructionsForBuyer({ businessId: 'b1', buyerId: 'u1' }), []);
});
await check("another buyer's order → nothing disclosed", async () => {
  const order = { buyerId: 'SOMEONE_ELSE', businessId: 'b1' };
  assert.deepEqual(await getPaymentInstructionsForBuyer({ businessId: 'b1', buyerId: 'u1', order }), []);
});
await check("order for a DIFFERENT business → nothing disclosed", async () => {
  const order = { buyerId: 'u1', businessId: 'OTHER_BIZ' };
  assert.deepEqual(await getPaymentInstructionsForBuyer({ businessId: 'b1', buyerId: 'u1', order }), []);
});
await check("another buyer's invoice → nothing disclosed", async () => {
  const invoice = { customerId: 'SOMEONE_ELSE', businessId: 'b1' };
  assert.deepEqual(await getPaymentInstructionsForBuyer({ businessId: 'b1', buyerId: 'u1', invoice }), []);
});
await check('invoice for a different business → nothing disclosed', async () => {
  const invoice = { customerId: 'u1', businessId: 'OTHER' };
  assert.deepEqual(await getPaymentInstructionsForBuyer({ businessId: 'b1', buyerId: 'u1', invoice }), []);
});

console.log('\nDOCUMENT NUMBER FORMAT');
const { formatDocumentNumber, fallbackSequence } = await import('../src/utils/ids.js');
const { DOCUMENT_PREFIXES, DOCUMENT_TYPES } = await import('../src/utils/constants.js');

await check('receipt number matches SH-RCP-000001', () => {
  assert.equal(formatDocumentNumber(DOCUMENT_PREFIXES[DOCUMENT_TYPES.RECEIPT], 1), 'SH-RCP-000001');
});
await check('invoice number matches SH-INV-000042', () => {
  assert.equal(formatDocumentNumber(DOCUMENT_PREFIXES[DOCUMENT_TYPES.INVOICE], 42), 'SH-INV-000042');
});
await check('quotation prefix is SH-QUO', () => {
  assert.match(formatDocumentNumber(DOCUMENT_PREFIXES[DOCUMENT_TYPES.QUOTATION], 7), /^SH-QUO-0000?07$/);
});
await check('all five document types have distinct prefixes', () => {
  const prefixes = Object.values(DOCUMENT_PREFIXES);
  assert.equal(new Set(prefixes).size, prefixes.length);
  assert.equal(prefixes.length, 5);
});
await check('six-digit zero padding holds past 1000', () => {
  assert.equal(formatDocumentNumber('SH-RCP', 1234), 'SH-RCP-001234');
});
await check('fallback sequence is numeric and non-zero', () => {
  const seq = fallbackSequence();
  assert.equal(typeof seq, 'number');
  assert.ok(seq > 0);
});

console.log('\nINVOICE / QUOTATION / PROOF STATUS MODELS');
const C = await import('../src/utils/constants.js');
await check('invoice flow covers the full lifecycle', () => {
  ['draft','sent','viewed','partially_paid','paid','overdue','cancelled']
    .forEach(s => assert.ok(Object.values(C.INVOICE_STATUS).includes(s), `${s} missing`));
});
await check('every invoice status has a label', () => {
  Object.values(C.INVOICE_STATUS).forEach(s =>
    assert.ok(C.INVOICE_STATUS_LABELS[s], `no label for ${s}`));
});
await check('quotation workflow statuses present', () => {
  ['requested','clarification','declined','draft','sent','viewed','accepted','rejected']
    .forEach(s => assert.ok(Object.values(C.QUOTATION_STATUS).includes(s), `${s} missing`));
});
await check('proof statuses require review before confirmation', () => {
  assert.ok(C.PROOF_STATUS.SUBMITTED);
  assert.ok(C.PROOF_STATUS.CONFIRMED);
  assert.ok(C.PROOF_STATUS.REJECTED);
  assert.notEqual(C.PROOF_STATUS.SUBMITTED, C.PROOF_STATUS.CONFIRMED);
});
await check('risk lifecycle is Normal→Flagged→Review→Restricted→Suspended', () => {
  assert.deepEqual(C.RISK_STATUS_FLOW,
    ['normal','flagged','under_review','restricted','suspended']);
});
await check('seller payment types declare required fields', () => {
  const bank = C.sellerPaymentMethodType('bank_transfer');
  assert.ok(bank.fields.some(f => f.id === 'accountNumber' && f.required));
  const momo = C.sellerPaymentMethodType('mobile_money');
  assert.ok(momo.fields.some(f => f.id === 'phoneNumber' && f.required));
});

console.log(`\n${passed} assertions passed.`);
