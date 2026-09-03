// Application-wide constants.

export const APP_NAME = 'Seedwel Hub';
export const APP_TAGLINE = 'Buy. Sell. Manage. Grow.';

export const DEFAULT_ROLE = 'user';
export const ADMIN_ROLE = 'admin';

export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  BANNED: 'banned',
  PENDING: 'pending',
};

// Collection names — mirror the Firestore schema so services stay consistent.
export const COLLECTIONS = {
  USERS: 'users',
  PROFILES: 'profiles',
  BUSINESSES: 'businesses',
  BUSINESS_MEMBERS: 'businessMembers',
  PRODUCTS: 'products',
  PRODUCT_VARIANTS: 'productVariants',
  SERVICES: 'services',
  CATEGORIES: 'categories',
  STORES: 'stores',
  ORDERS: 'orders',
  ORDER_ITEMS: 'orderItems',
  CUSTOMERS: 'customers',
  QUOTATIONS: 'quotations',
  QUOTATION_ITEMS: 'quotationItems',
  INVOICES: 'invoices',
  INVOICE_ITEMS: 'invoiceItems',
  RECEIPTS: 'receipts',
  PAYMENTS: 'payments',
  PAYMENT_METHODS: 'paymentMethods',
  PAYMENT_PROOFS: 'paymentProofs',
  PAYMENT_DISPUTES: 'paymentDisputes',
  INVENTORY: 'inventory',
  INVENTORY_MOVEMENTS: 'inventoryMovements',
  WAREHOUSES: 'warehouses',
  CONVERSATIONS: 'conversations',
  MESSAGES: 'messages',
  GROUPS: 'groups',
  GROUP_MEMBERS: 'groupMembers',
  NOTIFICATIONS: 'notifications',
  DEVICE_TOKENS: 'deviceTokens',
  DEVICE_SESSIONS: 'deviceSessions',
  REVIEWS: 'reviews',
  WISHLISTS: 'wishlists',
  FOLLOWS: 'follows',
  DOCUMENTS: 'documents',
  SUBSCRIPTIONS: 'subscriptions',
  REPORTS: 'reports',
  AUDIT_LOGS: 'auditLogs',
  SECURITY_EVENTS: 'securityEvents',
  ADMIN_ACTIONS: 'adminActions',
  SUPPORT_TICKETS: 'supportTickets',
};

export const ORDER_STATUS = {
  PLACED: 'Order Placed',
  PAYMENT_SUBMITTED: 'Payment Submitted',
  PAYMENT_CONFIRMED: 'Payment Confirmed',
  PROCESSING: 'Processing',
  READY: 'Ready',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for Delivery',
  DELIVERED: 'Delivered',
};

export const ORDER_STATUS_FLOW = [
  ORDER_STATUS.PLACED,
  ORDER_STATUS.PAYMENT_SUBMITTED,
  ORDER_STATUS.PAYMENT_CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.READY,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.OUT_FOR_DELIVERY,
  ORDER_STATUS.DELIVERED,
];

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
};

export const PAYMENT_METHODS = [
  { id: 'mobile_money', label: 'Mobile Money' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'cash', label: 'Cash' },
  { id: 'card', label: 'Card' },
  { id: 'other', label: 'Other' },
];

export const DOCUMENT_TYPES = {
  QUOTATION: 'quotation',
  INVOICE: 'invoice',
  RECEIPT: 'receipt',
};

export const BUSINESS_CATEGORIES = [
  'Retail',
  'Wholesale',
  'Services',
  'Agriculture',
  'Fashion',
  'Electronics',
  'Food & Beverage',
  'Beauty & Health',
  'Construction',
  'Transport & Logistics',
  'Finance',
  'Other',
];
