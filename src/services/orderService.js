import { createDoc, getById, patchDoc, queryOnce } from './_base';
import { where } from '../firebase/firestore';
import { COLLECTIONS, ORDER_STATUS } from '../utils/constants';
import { generateOrderNumber } from '../utils/ids';
import { createNotification } from './notificationService';
import { formatCurrency } from '../utils/format';
import { DEFAULT_CURRENCY, currencyCode } from '../utils/constants';

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

// Orders placed directly against a seller who may not have a business profile
// yet (product/service ownerId). The Firestore rules allow seller access via
// the ownerId field, so these are visible in the seller experience too.
export function getOrdersByOwner(ownerId, count = 50) {
  return queryOnce(COL, [where('ownerId', '==', ownerId)], {
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
    // Keep the item list on the order document too, so order detail pages do
    // not need a second read to show what was purchased.
    items: Array.isArray(items) ? items : [],
    total: data.total != null ? data.total : calculateTotal(items),
  });

  if (Array.isArray(items)) {
    for (const item of items) {
      await createDoc(ITEMS, {
        orderId: order.id,
        businessId,
        buyerId,
        ownerId: data.ownerId || null,
        ...item,
      });
    }
  }
  return order;
}

// Places an order and creates the in-app notifications for both the buyer and
// the seller/provider. Kept in the order service so every "buy" / "request"
// entry point gets the same behavior.
export async function placeOrder({
  buyerId,
  businessId,
  businessName,
  ownerId,
  items,
  buyerName = '',
  buyerPhone = '',
  address = '',
  paymentMethod = '',
  note = '',
  deliveryFee = 0,
  currency = 'UGX',
  ...extra
}) {
  const normalizedItems = (items || []).map((item) => ({
    ...item,
    price: Number(item.price) || 0,
    quantity: Math.max(1, Number(item.quantity) || 1),
  }));
  const delivery = Number(deliveryFee) || 0;
  const subtotal = calculateTotal(normalizedItems);
  const total = subtotal + delivery;
  const orderCurrency = currencyCode(currency) || DEFAULT_CURRENCY;

  const order = await createOrder({
    ...extra,
    buyerId,
    businessId,
    businessName,
    ownerId,
    buyerName,
    buyerPhone,
    address,
    paymentMethod,
    note,
    currency: currencyCode(currency),
    subtotal,
    deliveryFee: delivery,
    total,
    items: normalizedItems,
  });

  const quantity = normalizedItems.reduce((sum, item) => sum + item.quantity, 0);
  const itemLabel = normalizedItems[0]?.name || 'your item';
  const related = { orderId: order.id, orderNumber: order.orderNumber, businessId, businessName, buyerId, ownerId };

  if (ownerId && ownerId !== buyerId) {
    await createNotification({
      recipientId: ownerId,
      title: 'New order 🛒',
      message: `${buyerName || 'A buyer'} placed an order for ${itemLabel} (${quantity} item${quantity === 1 ? '' : 's'}). Total ${formatCurrency(total, orderCurrency)}.`,
      type: 'orders',
      related,
    }).catch(() => {});
  }

  await createNotification({
    recipientId: buyerId,
    title: 'Order placed ✅',
    message: `Your order ${order.orderNumber} was placed for ${quantity} item${quantity === 1 ? '' : 's'} — total ${formatCurrency(total, orderCurrency)}.`,
    type: 'orders',
    related,
  }).catch(() => {});

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
