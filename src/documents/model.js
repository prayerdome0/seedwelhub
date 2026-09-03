import {
  DOCUMENT_TYPES,
  DOCUMENT_TITLES,
  INVOICE_STATUS,
  INVOICE_STATUS_LABELS,
  LEGACY_INVOICE_STATUS_MAP,
  QUOTATION_STATUS_LABELS,
  DEFAULT_CURRENCY,
  currencyCode,
} from '../utils/constants';

// ---------------------------------------------------------------------------
// One document shape to rule them all.
//
// Receipts, invoices, quotations, payment confirmations and order
// confirmations are stored in different collections with slightly different
// field names (amount vs total, customerName vs buyerName, …). Rather than
// teaching every renderer about every collection, each entity is normalised
// here into a single `SeedwelDocument` shape. The on-screen document, the PDF
// writer and the print stylesheet then all consume exactly the same object,
// which is what makes the branding identical across all five document types.
// ---------------------------------------------------------------------------

function num(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstOf(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

// Line items arrive as order items (name/price/quantity) or as document line
// items (description/unitPrice/quantity). Normalise both, and keep any tax or
// discount that was recorded.
function normalizeItems(rawItems, { priceKeys = ['unitPrice', 'price', 'amount'] } = {}) {
  return (rawItems || []).map((item, index) => {
    const quantity = num(firstOf(item.quantity, item.qty, 1)) || 1;
    let unitPrice = 0;
    for (const key of priceKeys) {
      if (item[key] !== undefined && item[key] !== null && item[key] !== '') {
        unitPrice = num(item[key]);
        break;
      }
    }
    const discount = num(item.discount);
    const taxRate = num(item.tax ?? item.taxRate);
    const base = unitPrice * quantity - discount;
    const tax = (base * taxRate) / 100;
    return {
      id: item.id || `item-${index}`,
      name: firstOf(item.name, item.description, item.title, `Item ${index + 1}`),
      description: item.description && item.description !== item.name ? item.description : '',
      unit: item.unit || '',
      quantity,
      unitPrice,
      discount,
      taxRate,
      tax,
      amount: base + tax,
    };
  });
}

function sumItems(items) {
  return items.reduce(
    (acc, item) => {
      acc.subtotal += item.unitPrice * item.quantity;
      acc.discount += item.discount;
      acc.tax += item.tax;
      return acc;
    },
    { subtotal: 0, discount: 0, tax: 0 }
  );
}

function party({ name, subtitle, email, phone, address, extra } = {}) {
  return {
    name: name || '',
    subtitle: subtitle || '',
    email: email || '',
    phone: phone || '',
    address: address || '',
    extra: (extra || []).filter(Boolean),
  };
}

/**
 * Normalises the invoice status, mapping the legacy `unpaid` value onto the
 * current workflow so historic invoices still render a valid status.
 */
export function normalizeInvoiceStatus(status) {
  const value = String(status || '').toLowerCase();
  if (Object.values(INVOICE_STATUS).includes(value)) return value;
  return LEGACY_INVOICE_STATUS_MAP[value] || INVOICE_STATUS.DRAFT;
}

/**
 * Builds the shared document object.
 *
 * @param {string} type       one of DOCUMENT_TYPES
 * @param {object} source     the raw Firestore entity
 * @param {object} context    { business, buyer, order, payment } lookups
 * @returns {object} SeedwelDocument
 */
export function buildDocument(type, source, context = {}) {
  const { business = null, buyer = null, order = null, payment = null } = context;
  const currency = currencyCode(
    firstOf(source?.currency, order?.currency, business?.currency, DEFAULT_CURRENCY)
  );

  const seller = party({
    name: firstOf(business?.name, source?.businessName, order?.businessName, 'Seller'),
    subtitle: firstOf(business?.ownerName, business?.contactName, source?.sellerName),
    email: firstOf(business?.email, source?.businessEmail),
    phone: firstOf(business?.phone, business?.contactPhone, source?.businessPhone),
    address: firstOf(
      business?.address,
      [business?.city, business?.country].filter(Boolean).join(', '),
      source?.businessAddress
    ),
    extra: [
      business?.registrationNumber && `Reg. No: ${business.registrationNumber}`,
      business?.taxNumber && `TIN: ${business.taxNumber}`,
    ],
  });

  const customer = party({
    name: firstOf(
      source?.customerName,
      source?.buyerName,
      order?.buyerName,
      buyer?.name,
      'Customer'
    ),
    email: firstOf(source?.customerEmail, buyer?.email, order?.buyerEmail),
    phone: firstOf(source?.customerPhone, order?.buyerPhone, buyer?.phone),
    address: firstOf(source?.customerAddress, order?.address, buyer?.location),
  });

  const base = {
    type,
    title: DOCUMENT_TITLES[type] || 'DOCUMENT',
    currency,
    seller,
    customer,
    verificationCode: source?.verificationCode || '',
    notes: firstOf(source?.notes, source?.note, source?.sellerNotes),
    terms: source?.terms || '',
    meta: [],
    items: [],
    totals: [],
    statusLabel: '',
    status: source?.status || '',
    footnote: '',
  };

  if (type === DOCUMENT_TYPES.RECEIPT) {
    const items = normalizeItems(
      source?.items?.length ? source.items : order?.items || [],
      { priceKeys: ['unitPrice', 'price'] }
    );
    const sums = sumItems(items);
    const paid = num(firstOf(source?.amount, source?.total, order?.total));
    const subtotal = items.length ? sums.subtotal : paid;
    const delivery = num(firstOf(source?.deliveryFee, order?.deliveryFee));

    return {
      ...base,
      number: firstOf(source?.receiptNumber, source?.number, '—'),
      date: firstOf(source?.paidAt, source?.createdAt),
      items,
      meta: [
        { label: 'Receipt No', value: firstOf(source?.receiptNumber, '—'), strong: true },
        { label: 'Date', value: firstOf(source?.paidAt, source?.createdAt), isDate: true },
        source?.orderNumber || order?.orderNumber
          ? { label: 'Order', value: firstOf(source?.orderNumber, order?.orderNumber) }
          : null,
        source?.invoiceNumber ? { label: 'Invoice', value: source.invoiceNumber } : null,
        { label: 'Payment method', value: firstOf(source?.paymentMethod, payment?.method, '—') },
        {
          label: 'Reference',
          value: firstOf(source?.paymentReference, payment?.reference, '—'),
        },
      ].filter(Boolean),
      totals: [
        { label: 'Subtotal', value: subtotal },
        delivery ? { label: 'Delivery', value: delivery } : null,
        sums.discount ? { label: 'Discount', value: -sums.discount } : null,
        sums.tax ? { label: 'Tax', value: sums.tax } : null,
        { label: 'Total Paid', value: paid, strong: true },
      ].filter(Boolean),
      statusLabel: 'PAID',
      statusTone: 'success',
      footnote: 'Thank you for doing business with SEEDWEL HUB.',
    };
  }

  if (type === DOCUMENT_TYPES.INVOICE) {
    const items = normalizeItems(source?.items || []);
    const sums = sumItems(items);
    const delivery = num(source?.deliveryFee);
    const total = num(firstOf(source?.total, sums.subtotal - sums.discount + sums.tax + delivery));
    const paidAmount = num(source?.amountPaid);
    const status = normalizeInvoiceStatus(source?.status);

    return {
      ...base,
      number: firstOf(source?.invoiceNumber, '—'),
      date: source?.createdAt,
      items,
      meta: [
        { label: 'Invoice No', value: firstOf(source?.invoiceNumber, '—'), strong: true },
        { label: 'Date', value: firstOf(source?.issuedAt, source?.createdAt), isDate: true },
        { label: 'Due date', value: source?.dueDate, isDate: true },
        source?.orderNumber ? { label: 'Order', value: source.orderNumber } : null,
        source?.quotationNumber ? { label: 'Quotation', value: source.quotationNumber } : null,
      ].filter(Boolean),
      totals: [
        { label: 'Subtotal', value: sums.subtotal },
        sums.discount ? { label: 'Discount', value: -sums.discount } : null,
        sums.tax ? { label: 'Tax', value: sums.tax } : null,
        delivery ? { label: 'Delivery', value: delivery } : null,
        { label: 'Total', value: total, strong: true },
        paidAmount ? { label: 'Amount paid', value: paidAmount } : null,
        { label: 'Balance due', value: num(firstOf(source?.balance, total - paidAmount)), strong: true },
      ].filter(Boolean),
      status,
      statusLabel: (INVOICE_STATUS_LABELS[status] || status).toUpperCase(),
      statusTone: status === INVOICE_STATUS.PAID ? 'success' : status === INVOICE_STATUS.OVERDUE ? 'danger' : 'info',
      terms: source?.terms || '',
      footnote: 'Please quote the invoice number on your payment reference.',
    };
  }

  if (type === DOCUMENT_TYPES.QUOTATION) {
    const items = normalizeItems(source?.items || []);
    const sums = sumItems(items);
    const delivery = num(source?.deliveryFee);
    const total = num(firstOf(source?.total, sums.subtotal - sums.discount + sums.tax + delivery));
    const status = String(source?.status || '');

    return {
      ...base,
      number: firstOf(source?.quotationNumber, '—'),
      date: source?.createdAt,
      items,
      meta: [
        { label: 'Quotation No', value: firstOf(source?.quotationNumber, '—'), strong: true },
        { label: 'Date', value: firstOf(source?.sentAt, source?.createdAt), isDate: true },
        { label: 'Valid until', value: source?.validUntil, isDate: true },
        source?.requestedDelivery
          ? { label: 'Preferred delivery', value: source.requestedDelivery }
          : null,
      ].filter(Boolean),
      totals: [
        { label: 'Subtotal', value: sums.subtotal },
        sums.discount ? { label: 'Discount', value: -sums.discount } : null,
        sums.tax ? { label: 'Taxes & fees', value: sums.tax } : null,
        delivery ? { label: 'Delivery', value: delivery } : null,
        { label: 'Total', value: total, strong: true },
      ].filter(Boolean),
      status,
      statusLabel: (QUOTATION_STATUS_LABELS[status] || status || 'Draft').toUpperCase(),
      statusTone: status === 'accepted' ? 'success' : status === 'declined' || status === 'rejected' ? 'danger' : 'info',
      terms: source?.terms || '',
      notes: source?.sellerNotes || source?.notes || '',
      footnote: 'This quotation is valid until the date shown above.',
    };
  }

  if (type === DOCUMENT_TYPES.PAYMENT_CONFIRMATION) {
    const amount = num(firstOf(source?.amount, payment?.amount));
    return {
      ...base,
      number: firstOf(source?.confirmationNumber, source?.reference, '—'),
      date: firstOf(source?.confirmedAt, source?.paidAt, source?.createdAt),
      items: [],
      meta: [
        { label: 'Reference', value: firstOf(source?.reference, '—'), strong: true },
        { label: 'Date', value: firstOf(source?.confirmedAt, source?.paidAt, source?.createdAt), isDate: true },
        { label: 'Method', value: firstOf(source?.method, '—') },
        source?.orderNumber || order?.orderNumber
          ? { label: 'Order', value: firstOf(source?.orderNumber, order?.orderNumber) }
          : null,
        source?.transactionReference
          ? { label: 'Transaction ref', value: source.transactionReference }
          : null,
      ].filter(Boolean),
      totals: [{ label: 'Amount confirmed', value: amount, strong: true }],
      statusLabel: 'CONFIRMED',
      statusTone: 'success',
      footnote: 'This confirmation certifies that the payment above was received and verified.',
    };
  }

  // Order confirmation
  const items = normalizeItems(source?.items || [], { priceKeys: ['price', 'unitPrice'] });
  const sums = sumItems(items);
  const delivery = num(source?.deliveryFee);
  const total = num(firstOf(source?.total, sums.subtotal + delivery));

  return {
    ...base,
    number: firstOf(source?.orderNumber, '—'),
    date: source?.createdAt,
    items,
    meta: [
      { label: 'Order No', value: firstOf(source?.orderNumber, '—'), strong: true },
      { label: 'Date', value: source?.createdAt, isDate: true },
      { label: 'Order status', value: firstOf(source?.status, '—') },
      { label: 'Payment status', value: firstOf(source?.paymentStatus, '—') },
      source?.address ? { label: 'Deliver to', value: source.address } : null,
    ].filter(Boolean),
    totals: [
      { label: 'Subtotal', value: firstOf(source?.subtotal, sums.subtotal) },
      delivery ? { label: 'Delivery', value: delivery } : null,
      { label: 'Total', value: total, strong: true },
    ].filter(Boolean),
    statusLabel: String(firstOf(source?.status, 'CONFIRMED')).toUpperCase(),
    statusTone: 'info',
    footnote: 'Thank you for your order with SEEDWEL HUB.',
  };
}

export { DOCUMENT_TYPES };
