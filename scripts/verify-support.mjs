import assert from 'node:assert/strict';
import { resetStore, store } from './firestore-mock.mjs';

let passed = 0;
const check = async (name, fn) => {
  try { await fn(); passed += 1; console.log(`  ✓ ${name}`); }
  catch (error) { console.error(`  ✗ ${name}\n    ${error.message}`); process.exitCode = 1; }
};

const constants = await import('../src/utils/constants.js');
const {
  createOrderSupportTicket,
  getOrderSupportTicket,
  getOrderSupportTicketsByOwner,
  getAllOrderSupportTickets,
  addOrderSupportReply,
  setOrderSupportStatus,
} = await import('../src/services/supportService.js');

console.log('\nORDER HELP & DISPUTE WORKFLOW');
resetStore();
const order = {
  id: 'order_1',
  orderNumber: 'ORD-20260925-0001',
  buyerId: 'buyer_1',
  ownerId: 'seller_1',
  businessId: 'business_1',
  businessName: 'Fresh Foods',
};

let ticket;
await check('buyer opens an order-linked support request', async () => {
  ticket = await createOrderSupportTicket({
    order,
    buyer: { uid: 'buyer_1', name: 'Jane Buyer' },
    topic: 'dispute',
    message: 'The order arrived damaged; please help.',
  });
  assert.equal(ticket.kind, 'order_help');
  assert.equal(ticket.orderId, order.id);
  assert.equal(ticket.uid, 'buyer_1');
  assert.equal(ticket.status, 'open');
  assert.equal(ticket.messages.length, 1);
});

await check('seller receives a notification with the order deep link', async () => {
  const notifications = [...(store.get(constants.COLLECTIONS.NOTIFICATIONS)?.values() || [])];
  assert.ok(notifications.some((notification) =>
    notification.recipientId === 'seller_1' && notification.related?.orderId === order.id
  ));
});

await check('buyer and seller can find their own order-help case', async () => {
  const buyerView = await getOrderSupportTicket({ orderId: order.id, uid: 'buyer_1', role: 'buyer' });
  const sellerView = await getOrderSupportTicket({ orderId: order.id, uid: 'seller_1', role: 'seller' });
  const sellerInbox = await getOrderSupportTicketsByOwner('seller_1');
  assert.equal(buyerView.id, ticket.id);
  assert.equal(sellerView.id, ticket.id);
  assert.equal(sellerInbox.length, 1);
});

await check('seller response appends a message and updates status', async () => {
  const updated = await addOrderSupportReply(ticket, {
    senderId: 'seller_1', senderName: 'Fresh Foods', senderRole: 'seller',
    text: 'We are reviewing this and will arrange a replacement.',
  });
  assert.equal(updated.messages.length, 2);
  const persisted = await getOrderSupportTicket({ orderId: order.id, uid: 'buyer_1', role: 'buyer' });
  assert.equal(persisted.status, 'awaiting_buyer');
  assert.equal(persisted.messages[1].senderRole, 'seller');
});

await check('seller can mark a case resolved and admin can see the queue', async () => {
  await setOrderSupportStatus(ticket.id, 'resolved');
  const adminQueue = await getAllOrderSupportTickets();
  assert.equal(adminQueue.length, 1);
  assert.equal(adminQueue[0].status, 'resolved');
});

await check('buyer follow-up reopens a closed case and notifies seller', async () => {
  await setOrderSupportStatus(ticket.id, 'closed');
  const closed = await getOrderSupportTicket({ orderId: order.id, uid: 'buyer_1', role: 'buyer' });
  await addOrderSupportReply(closed, {
    senderId: 'buyer_1', senderName: 'Jane Buyer', senderRole: 'buyer',
    text: 'I still need help with the replacement.',
  });
  const reopened = await getOrderSupportTicket({ orderId: order.id, uid: 'buyer_1', role: 'buyer' });
  assert.equal(reopened.status, 'open');
  assert.equal(reopened.messages.length, 3);
  const notifications = [...(store.get(constants.COLLECTIONS.NOTIFICATIONS)?.values() || [])];
  assert.ok(notifications.filter((notification) => notification.recipientId === 'seller_1').length >= 2);
});

console.log(`\n${passed} order-support checks passed.`);
