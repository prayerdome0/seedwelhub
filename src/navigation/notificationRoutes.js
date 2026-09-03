import { NOTIFICATION_TYPES } from '../utils/constants';

// ---------------------------------------------------------------------------
// Notification → destination mapping.
//
// Clicking a notification must land the user on the exact item it refers to.
// The `related` object carried on each notification document is resolved here,
// most specific id first, so a "payment proof submitted" notification opens the
// order review rather than a generic list.
// ---------------------------------------------------------------------------
export function notificationRoute(notification) {
  const related = notification?.related || {};

  if (related.route) return related.route;
  if (related.receiptId) return `/receipt/${related.receiptId}`;
  if (related.invoiceId) return `/invoice/${related.invoiceId}`;
  if (related.quotationId) return `/quotation/${related.quotationId}`;
  if (related.quotationRequestId) return `/quotation-request/${related.quotationRequestId}`;
  if (related.paymentProofId && related.orderId) return `/order/${related.orderId}`;
  if (related.paymentId) return `/payment/${related.paymentId}`;
  if (related.orderId) return `/order/${related.orderId}`;
  if (related.conversationId) return `/messages/${related.conversationId}`;
  if (related.groupId) return `/group/${related.groupId}`;
  if (related.productId) return `/product/${related.productId}`;
  if (related.serviceId) return `/service/${related.serviceId}`;
  if (related.businessId) return `/business/${related.businessId}`;

  // Fall back to the section that matches the notification category.
  switch (notification?.type) {
    case NOTIFICATION_TYPES.ORDERS:
      return '/orders';
    case NOTIFICATION_TYPES.PAYMENTS:
      return '/payments';
    case NOTIFICATION_TYPES.INVOICES:
      return '/invoices';
    case NOTIFICATION_TYPES.QUOTATIONS:
      return '/quotations';
    case NOTIFICATION_TYPES.RECEIPTS:
      return '/receipts';
    case NOTIFICATION_TYPES.MESSAGES:
      return '/messages';
    case NOTIFICATION_TYPES.SECURITY:
      return '/settings';
    default:
      return null;
  }
}

const ICONS = {
  [NOTIFICATION_TYPES.ORDERS]: '📦',
  [NOTIFICATION_TYPES.PAYMENTS]: '💳',
  [NOTIFICATION_TYPES.INVOICES]: '📄',
  [NOTIFICATION_TYPES.QUOTATIONS]: '📝',
  [NOTIFICATION_TYPES.RECEIPTS]: '🧾',
  [NOTIFICATION_TYPES.MESSAGES]: '💬',
  [NOTIFICATION_TYPES.BUSINESS]: '🏢',
  [NOTIFICATION_TYPES.SECURITY]: '🔒',
};

export function notificationIcon(notification) {
  return ICONS[notification?.type] || '🔔';
}
