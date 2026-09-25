import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where, arrayUnion, increment } from '../firebase/firestore';
import { COLLECTIONS } from '../utils/constants';
import { createNotification } from './notificationService';

const COL = COLLECTIONS.SUPPORT_TICKETS;
export const ORDER_SUPPORT_KIND = 'order_help';
export const ORDER_SUPPORT_STATUSES = ['open', 'awaiting_seller', 'awaiting_buyer', 'resolved', 'closed'];

export function supportStatusLabel(status = '') {
  const labels = {
    open: 'Open',
    awaiting_seller: 'Awaiting seller',
    awaiting_buyer: 'Awaiting buyer',
    resolved: 'Resolved',
    closed: 'Closed',
  };
  return labels[status] || String(status).replaceAll('_', ' ');
}

function makeMessage({ senderId, senderName, senderRole, text }) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderId,
    senderName: senderName || (senderRole === 'seller' ? 'Seller' : 'Buyer'),
    senderRole,
    text: String(text || '').trim(),
    createdAt: new Date().toISOString(),
  };
}

export async function getOrderSupportTicket({ orderId, uid, role = 'buyer', isAdmin = false }) {
  if (!orderId) return null;
  const filters = [where('orderId', '==', orderId), where('kind', '==', ORDER_SUPPORT_KIND)];
  if (!isAdmin && uid) {
    filters.push(where(role === 'seller' ? 'ownerId' : 'uid', '==', uid));
  }
  const tickets = await queryOnce(COL, filters, { orderBy: ['updatedAt', 'desc'], limit: 20 });
  return tickets.find((ticket) => ticket.kind === ORDER_SUPPORT_KIND) || null;
}

export async function getOrderSupportTicketsByOwner(ownerId, count = 100) {
  if (!ownerId) return [];
  const tickets = await queryOnce(COL, [
    where('ownerId', '==', ownerId),
    where('kind', '==', ORDER_SUPPORT_KIND),
  ], {
    orderBy: ['updatedAt', 'desc'],
    limit: count,
  });
  return tickets.filter((ticket) => ticket.kind === ORDER_SUPPORT_KIND);
}

export async function getAllOrderSupportTickets(count = 300) {
  const tickets = await queryOnce(COL, [], { orderBy: ['updatedAt', 'desc'], limit: count });
  return tickets.filter((ticket) => ticket.kind === ORDER_SUPPORT_KIND);
}

export async function createOrderSupportTicket({ order, buyer, topic, message }) {
  const firstMessage = makeMessage({
    senderId: buyer.uid,
    senderName: buyer.name || buyer.displayName || 'Buyer',
    senderRole: 'buyer',
    text: message,
  });
  const ticket = await createDoc(COL, {
    kind: ORDER_SUPPORT_KIND,
    uid: buyer.uid,
    buyerId: order.buyerId,
    buyerName: order.buyerName || buyer.name || buyer.displayName || 'Buyer',
    ownerId: order.ownerId || null,
    businessId: order.businessId || null,
    businessName: order.businessName || '',
    orderId: order.id,
    orderNumber: order.orderNumber || '',
    topic,
    status: 'open',
    messages: [firstMessage],
    messageCount: 1,
    lastMessage: firstMessage.text,
    lastMessageBy: buyer.uid,
    lastMessageAt: firstMessage.createdAt,
    unreadForBuyer: false,
    unreadForSeller: true,
  });
  if (ticket.ownerId && ticket.ownerId !== buyer.uid) {
    await createNotification({
      recipientId: ticket.ownerId,
      title: 'Buyer needs help with an order',
      message: `${ticket.buyerName} asked for help with order ${ticket.orderNumber}.`,
      type: 'orders',
      related: { orderId: order.id, orderNumber: order.orderNumber, supportTicketId: ticket.id, businessId: ticket.businessId },
    }).catch(() => {});
  }
  return ticket;
}

export async function addOrderSupportReply(ticket, { senderId, senderName, senderRole, text }) {
  const message = makeMessage({ senderId, senderName, senderRole, text });
  const messages = [...(Array.isArray(ticket.messages) ? ticket.messages : []), message];
  const nextStatus = senderRole === 'buyer' ? 'awaiting_seller' : 'awaiting_buyer';
  const status = ticket.status === 'closed' ? 'open' : nextStatus;
  const updated = await patchDoc(COL, ticket.id, {
    messages: arrayUnion(message),
    messageCount: increment(1),
    lastMessage: message.text,
    lastMessageBy: senderId,
    lastMessageAt: message.createdAt,
    status,
    unreadForBuyer: senderRole !== 'buyer',
    unreadForSeller: senderRole === 'buyer',
  });

  const recipientId = senderRole === 'buyer' ? ticket.ownerId : ticket.uid;
  if (recipientId && recipientId !== senderId) {
    await createNotification({
      recipientId,
      title: senderRole === 'buyer' ? 'New buyer-help message' : 'Seller replied to your help request',
      message: `${message.senderName}: ${message.text.slice(0, 120)}`,
      type: 'orders',
      related: { orderId: ticket.orderId, orderNumber: ticket.orderNumber, supportTicketId: ticket.id, businessId: ticket.businessId },
    }).catch(() => {});
  }
  return { ...ticket, ...updated, messages, messageCount: messages.length, status };
}

export async function setOrderSupportStatus(ticketId, status) {
  if (!ORDER_SUPPORT_STATUSES.includes(status)) throw new Error('Choose a valid support status.');
  const ticket = await getById(COL, ticketId);
  if (!ticket || ticket.kind !== ORDER_SUPPORT_KIND) throw new Error('The order-help request could not be found.');
  const updated = await patchDoc(COL, ticketId, { status });
  return { ...ticket, ...updated };
}
