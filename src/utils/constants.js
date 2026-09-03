// Application-wide constants.

export const APP_NAME = 'Seedwel Hub';
export const APP_TAGLINE = 'Buy. Sell. Manage. Grow.';

export const DEFAULT_ROLE = 'user';
export const ADMIN_ROLE = 'admin';

// Supported display currencies for sellers. The *code* is stored on the
// business/entity and used by Intl formatting everywhere. Amounts are never
// auto-converted — changing the currency changes the displayed code only.
export const DEFAULT_CURRENCY = 'UGX';

export const CURRENCIES = [
  { code: 'UGX', label: 'Ugandan Shilling (UGX)' },
  { code: 'ZMW', label: 'Zambian Kwacha (ZMW)' },
  { code: 'USD', label: 'US Dollar (USD)' },
  { code: 'EUR', label: 'Euro (EUR)' },
  { code: 'GBP', label: 'British Pound (GBP)' },
  { code: 'KES', label: 'Kenyan Shilling (KES)' },
  { code: 'NGN', label: 'Nigerian Naira (NGN)' },
  { code: 'TZS', label: 'Tanzanian Shilling (TZS)' },
  { code: 'RWF', label: 'Rwandan Franc (RWF)' },
  { code: 'ZAR', label: 'South African Rand (ZAR)' },
];

export function currencyLabel(code = DEFAULT_CURRENCY) {
  const item = CURRENCIES.find((c) => c.code === code);
  return item ? item.code : code;
}

export function currencyCode(value = DEFAULT_CURRENCY) {
  const code = String(value || '').trim().toUpperCase();
  return CURRENCIES.some((c) => c.code === code) ? code : DEFAULT_CURRENCY;
}

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
  PAYMENT_CONFIRMATION: 'payment_confirmation',
  ORDER_CONFIRMATION: 'order_confirmation',
};

// ---------------------------------------------------------------------------
// Document identity — every generated document carries a Seedwel Hub number
// using the same `SH-<TYPE>-<000001>` shape so receipts, invoices, quotations
// and confirmations are visually and structurally consistent.
// ---------------------------------------------------------------------------
export const DOCUMENT_PREFIXES = {
  [DOCUMENT_TYPES.QUOTATION]: 'SH-QUO',
  [DOCUMENT_TYPES.INVOICE]: 'SH-INV',
  [DOCUMENT_TYPES.RECEIPT]: 'SH-RCP',
  [DOCUMENT_TYPES.PAYMENT_CONFIRMATION]: 'SH-PAY',
  [DOCUMENT_TYPES.ORDER_CONFIRMATION]: 'SH-ORD',
};

export const DOCUMENT_TITLES = {
  [DOCUMENT_TYPES.QUOTATION]: 'QUOTATION',
  [DOCUMENT_TYPES.INVOICE]: 'INVOICE',
  [DOCUMENT_TYPES.RECEIPT]: 'PAYMENT RECEIPT',
  [DOCUMENT_TYPES.PAYMENT_CONFIRMATION]: 'PAYMENT CONFIRMATION',
  [DOCUMENT_TYPES.ORDER_CONFIRMATION]: 'ORDER CONFIRMATION',
};

// ---------------------------------------------------------------------------
// Quotation workflow
// Buyer requests → seller accepts / declines / asks for clarification →
// seller drafts and sends a quotation → buyer accepts or declines.
// ---------------------------------------------------------------------------
export const QUOTATION_STATUS = {
  REQUESTED: 'requested',
  CLARIFICATION: 'clarification',
  DECLINED: 'declined',
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  INVOICED: 'invoiced',
};

export const QUOTATION_STATUS_LABELS = {
  [QUOTATION_STATUS.REQUESTED]: 'Requested',
  [QUOTATION_STATUS.CLARIFICATION]: 'Clarification requested',
  [QUOTATION_STATUS.DECLINED]: 'Declined by seller',
  [QUOTATION_STATUS.DRAFT]: 'Draft',
  [QUOTATION_STATUS.SENT]: 'Sent',
  [QUOTATION_STATUS.VIEWED]: 'Viewed',
  [QUOTATION_STATUS.ACCEPTED]: 'Accepted',
  [QUOTATION_STATUS.REJECTED]: 'Rejected by buyer',
  [QUOTATION_STATUS.EXPIRED]: 'Expired',
  [QUOTATION_STATUS.INVOICED]: 'Invoiced',
};

// ---------------------------------------------------------------------------
// Invoice workflow
// DRAFT → SENT → VIEWED → PARTIALLY PAID → PAID → OVERDUE → CANCELLED
// ---------------------------------------------------------------------------
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  VIEWED: 'viewed',
  PARTIALLY_PAID: 'partially_paid',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
};

export const INVOICE_STATUS_LABELS = {
  [INVOICE_STATUS.DRAFT]: 'Draft',
  [INVOICE_STATUS.SENT]: 'Sent',
  [INVOICE_STATUS.VIEWED]: 'Viewed',
  [INVOICE_STATUS.PARTIALLY_PAID]: 'Partially paid',
  [INVOICE_STATUS.PAID]: 'Paid',
  [INVOICE_STATUS.OVERDUE]: 'Overdue',
  [INVOICE_STATUS.CANCELLED]: 'Cancelled',
};

export const INVOICE_STATUS_FLOW = [
  INVOICE_STATUS.DRAFT,
  INVOICE_STATUS.SENT,
  INVOICE_STATUS.VIEWED,
  INVOICE_STATUS.PARTIALLY_PAID,
  INVOICE_STATUS.PAID,
  INVOICE_STATUS.OVERDUE,
  INVOICE_STATUS.CANCELLED,
];

// Legacy invoice status values that predate the workflow above. Kept so old
// documents keep rendering with a sensible label instead of breaking.
export const LEGACY_INVOICE_STATUS_MAP = {
  unpaid: INVOICE_STATUS.SENT,
  partially_paid: INVOICE_STATUS.PARTIALLY_PAID,
  paid: INVOICE_STATUS.PAID,
  overdue: INVOICE_STATUS.OVERDUE,
  cancelled: INVOICE_STATUS.CANCELLED,
};

// ---------------------------------------------------------------------------
// Proof of payment — a buyer-submitted claim that is *reviewed*, never trusted
// on its own. An order is only marked paid after seller/admin confirmation.
// ---------------------------------------------------------------------------
export const PROOF_STATUS = {
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
};

export const PROOF_STATUS_LABELS = {
  [PROOF_STATUS.SUBMITTED]: 'Awaiting review',
  [PROOF_STATUS.UNDER_REVIEW]: 'Under review',
  [PROOF_STATUS.CONFIRMED]: 'Confirmed',
  [PROOF_STATUS.REJECTED]: 'Rejected',
};

// Seller-configurable payment channels. Each type declares the fields the
// seller fills in so checkout can render clean payment instructions.
export const SELLER_PAYMENT_METHOD_TYPES = [
  {
    id: 'bank_transfer',
    label: 'Bank transfer',
    icon: '🏦',
    fields: [
      { id: 'bankName', label: 'Bank name', required: true },
      { id: 'accountName', label: 'Account name', required: true },
      { id: 'accountNumber', label: 'Account number', required: true },
      { id: 'branch', label: 'Branch' },
      { id: 'swift', label: 'SWIFT / BIC' },
    ],
  },
  {
    id: 'mobile_money',
    label: 'Mobile money',
    icon: '📱',
    fields: [
      { id: 'provider', label: 'Provider (MTN, Airtel, …)', required: true },
      { id: 'accountName', label: 'Registered name', required: true },
      { id: 'phoneNumber', label: 'Mobile money number', required: true },
    ],
  },
  {
    id: 'cash',
    label: 'Cash on delivery / collection',
    icon: '💵',
    fields: [
      { id: 'location', label: 'Collection point / notes' },
    ],
  },
  {
    id: 'other',
    label: 'Other approved method',
    icon: '💳',
    fields: [
      { id: 'methodName', label: 'Method name', required: true },
      { id: 'details', label: 'Payment details', required: true },
    ],
  },
];

export function sellerPaymentMethodType(id) {
  return SELLER_PAYMENT_METHOD_TYPES.find((m) => m.id === id) || null;
}

// ---------------------------------------------------------------------------
// Account risk / trust lifecycle used by the admin anti-fraud tooling.
// Normal → Flagged → Under Review → Restricted → Suspended
// ---------------------------------------------------------------------------
export const RISK_STATUS = {
  NORMAL: 'normal',
  FLAGGED: 'flagged',
  UNDER_REVIEW: 'under_review',
  RESTRICTED: 'restricted',
  SUSPENDED: 'suspended',
};

export const RISK_STATUS_FLOW = [
  RISK_STATUS.NORMAL,
  RISK_STATUS.FLAGGED,
  RISK_STATUS.UNDER_REVIEW,
  RISK_STATUS.RESTRICTED,
  RISK_STATUS.SUSPENDED,
];

export const RISK_STATUS_LABELS = {
  [RISK_STATUS.NORMAL]: 'Normal',
  [RISK_STATUS.FLAGGED]: 'Flagged',
  [RISK_STATUS.UNDER_REVIEW]: 'Under review',
  [RISK_STATUS.RESTRICTED]: 'Restricted',
  [RISK_STATUS.SUSPENDED]: 'Suspended',
};

// Notification categories. `type` drives the filter tabs and the icon shown in
// the notification list; `related` on the document drives the deep link.
export const NOTIFICATION_TYPES = {
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  INVOICES: 'invoices',
  QUOTATIONS: 'quotations',
  RECEIPTS: 'receipts',
  MESSAGES: 'messages',
  BUSINESS: 'business',
  SECURITY: 'security',
  GENERAL: 'general',
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
