import { createDoc, getById, patchDoc, queryOnce, docRef } from './_base';
import { where, orderBy, limit } from '../firebase/firestore';
import { COLLECTIONS, ORDER_STATUS } from '../utils/constants';
import { generateOrderNumber } from '../utils/ids';

const COL = COLLECTIONS.ORDERS;
const ITEMS = COLLECTIONS.ORDER_ITEMS;

export function getOrder(id) {
  return getById(COL, id);
}

export function getOrdersByBuyer(buyerId, count = 50) {
  return queryOnce(COL, [where('buyerId', '==', buyerId)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export function getOrdersByBusiness(businessId, count = 50) {
  return queryOnce(COL, [where('businessId', '==', businessId)], {
    orderBy: ['createdAt', 'desc'],
    limit: count,
  });
}

export async function createOrder({ buyerId, businessId, items, ...data }) {
  const orderNumber = generateOrderNumber();
  const order = await createDoc(COL, {
    orderNumber,
    buyerId,
    businessId,
    ...data,
    status: ORDER_STATUS.PLACED,
    paymentStatus: 'pending',
    total: data.total || calculateTotal(items),
  });

  if (Array.isArray(items)) {
    for (const item of items) {
      await createDoc(ITEMS, {
        orderId: order.id,
        businessId,
        buyerId,
        ...item,
      });
    }
  }
  return order;
}

export async function updateOrderStatus(id, status) {
  return patchDoc(COL, id, { status });
}

export async function updateOrderPaymentStatus(id, paymentStatus) {
  return patchDoc(COL, id, { paymentStatus });
}

export function getOrderItems(orderId) {
  return queryOnce(ITEMS, [where('orderId', '==', orderId)]);
}

function calculateTotal(items) {
  return (items || []).reduce(
    (sum, it) => sum + (Number(it.price) || 0) * (Number(it.quantity) || 0),
    0
  );
}

export async function countOrders() {
  const all = await queryOnce(COL, []);
  return all.length;
}
