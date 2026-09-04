import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import useAsync from '../hooks/useAsync';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { EmptyState, ErrorState } from '../components/PageState';
import { getBusinessesByOwner, updateBusiness } from '../services/businessService';
import {
  getOrdersByBusiness,
  getOrdersByOwner,
  updateOrderStatus,
  updateOrderPaymentStatus,
} from '../services/orderService';
import {
  getQuotationsByBusiness,
  getQuotationsByOwner,
  createQuotation,
  updateQuotation,
  respondToQuotationRequest,
  sendQuotation,
} from '../services/quotationService';
import {
  getInvoicesByBusiness,
  createInvoice,
  updateInvoice,
  calculateInvoiceTotal,
  createInvoiceFromOrder,
  sendInvoice,
} from '../services/invoiceService';
import {
  getReceiptsByBusiness,
  createReceipt,
  generateReceiptForOrder,
} from '../services/receiptService';
import { getProofsByBusiness } from '../services/paymentProofService';
import { createNotification } from '../services/notificationService';
import {
  getProductsByBusiness,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkCreateProducts,
} from '../services/productService';
import {
  getInventoryByBusiness,
  createInventoryItem,
  updateInventoryItem,
  adjustStock,
  deleteInventoryItem,
  bulkCreateInventory,
  isLowStock,
} from '../services/inventoryService';
import { getServicesByBusiness, updateService } from '../services/serviceService';
import PaymentSettingsTab from './seller/PaymentSettingsTab';
import PaymentsTab from './seller/PaymentsTab';
import CustomersTab from './seller/CustomersTab';
import PromotionsTab from './seller/PromotionsTab';
import { uploadImageToCloudinary } from '../cloudinary/upload';
import {
  BUSINESS_CATEGORIES,
  CURRENCIES,
  DEFAULT_CURRENCY,
  currencyCode,
  currencyLabel,
  ORDER_STATUS_FLOW,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  QUOTATION_STATUS,
  QUOTATION_STATUS_LABELS,
  INVOICE_STATUS,
  INVOICE_STATUS_LABELS,
} from '../utils/constants';
import { normalizeInvoiceStatus } from '../documents/model';
import { formatCurrency, formatDate, formatNumber, relativeTime, slugify } from '../utils/format';
import {
  parseCsv,
  readFileAsText,
  downloadCsv,
  productSampleCsv,
  inventorySampleCsv,
  isValidImageUrl,
  PRODUCT_CSV_HEADERS,
  INVENTORY_CSV_HEADERS,
} from '../utils/csv';

const TABS = [
  { id: 'channels', label: 'Where you sell' },
  { id: 'orders', label: 'Orders' },
  { id: 'quotations', label: 'Quotations' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'payments', label: 'Payments' },
  { id: 'customers', label: 'Customers' },
  { id: 'products', label: 'Products' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'import', label: 'Bulk import (CSV)' },
  { id: 'currency', label: 'Currency' },
  { id: 'payment-settings', label: 'Payment details' },
];

const QUOTATION_STATUSES = ['draft', 'sent', 'accepted', 'declined', 'invoiced'];
const INVOICE_STATUSES = ['unpaid', 'partially_paid', 'paid', 'overdue', 'cancelled'];

function emptyProduct(currency = DEFAULT_CURRENCY) {
  return {
    name: '',
    category: '',
    description: '',
    price: '',
    currency: currencyCode(currency),
    sku: '',
    stock: '',
    unit: 'piece',
    location: '',
    image: '',
  };
}

function emptyInventory(currency = DEFAULT_CURRENCY) {
  return {
    sku: '',
    productName: '',
    quantity: '',
    unit: 'piece',
    lowStockAlert: '',
    costPrice: '',
    currency: currencyCode(currency),
    warehouse: 'Main Store',
    image: '',
  };
}

function num(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyLineItem() {
  return { name: '', quantity: '', unitPrice: '', discount: '', tax: '' };
}

function emptyQuotation(currency = DEFAULT_CURRENCY) {
  return {
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    validUntil: '',
    notes: '',
    currency: currencyCode(currency),
    items: [emptyLineItem()],
  };
}

function emptyInvoice(currency = DEFAULT_CURRENCY) {
  return {
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    dueDate: '',
    notes: '',
    currency: currencyCode(currency),
    items: [emptyLineItem()],
  };
}

function emptyReceipt(currency = DEFAULT_CURRENCY) {
  return {
    customerId: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    amount: '',
    currency: currencyCode(currency),
    paymentMethod: 'mobile_money',
    paymentReference: '',
    orderId: '',
    invoiceId: '',
    notes: '',
  };
}

function deriveCustomerId({ customerId, customerEmail, customerName }) {
  if (customerId && customerId.trim()) return customerId.trim();
  if (customerEmail && customerEmail.trim()) return customerEmail.trim().toLowerCase();
  return `guest-${slugify(customerName) || 'customer'}`;
}

// Shared customer fields for the quotation / invoice / receipt forms.
function CustomerFields({ form, set }) {
  return (
    <>
      <div className="form__row">
        <div className="form__group">
          <label className="form__label" htmlFor="c-name">Customer name *</label>
          <input
            id="c-name"
            className="form__input"
            value={form.customerName}
            onChange={set('customerName')}
            placeholder="e.g. Jane Mwansa"
          />
        </div>
        <div className="form__group">
          <label className="form__label" htmlFor="c-phone">Customer phone</label>
          <input
            id="c-phone"
            className="form__input"
            value={form.customerPhone}
            onChange={set('customerPhone')}
            placeholder="+260 …"
          />
        </div>
      </div>
      <div className="form__group">
        <label className="form__label" htmlFor="c-email">Customer email</label>
        <input
          id="c-email"
          type="email"
          className="form__input"
          value={form.customerEmail}
          onChange={set('customerEmail')}
          placeholder="customer@example.com"
        />
      </div>
    </>
  );
}

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = TABS.map((t) => t.id);
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(
    validTabs.includes(tabParam) ? tabParam : 'channels'
  );
  const [businessId, setBusinessId] = useState('');

  // Keep the active tab in the URL so deep links (e.g. from the "Where you
  // sell" channels) can jump straight to a tab.
  useEffect(() => {
    if (validTabs.includes(tabParam)) setTab(tabParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabParam]);

  const changeTab = (next) => {
    setTab(next);
    setSearchParams(next === 'channels' ? {} : { tab: next }, { replace: true });
  };

  const businesses = useAsync(
    () => (user ? getBusinessesByOwner(user.uid) : Promise.resolve([])),
    [user]
  );

  useEffect(() => {
    const list = businesses.data || [];
    if (list.length && !list.some((b) => b.id === businessId)) {
      setBusinessId(list[0].id);
    }
  }, [businesses.data, businessId]);

  const business = (businesses.data || []).find((b) => b.id === businessId) || null;

  const products = useAsync(
    () => (businessId ? getProductsByBusiness(businessId) : Promise.resolve([])),
    [businessId]
  );
  const inventory = useAsync(
    () => (businessId ? getInventoryByBusiness(businessId) : Promise.resolve([])),
    [businessId]
  );

  const productList = products.data || [];
  const inventoryList = inventory.data || [];

  const stats = useMemo(() => {
    const stockUnits = inventoryList.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
    const stockValue = inventoryList.reduce(
      (sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.costPrice) || 0),
      0
    );
    return {
      live: productList.filter((p) => p.status !== 'hidden').length,
      hidden: productList.filter((p) => p.status === 'hidden').length,
      skus: inventoryList.length,
      stockUnits,
      stockValue,
      lowStock: inventoryList.filter(isLowStock).length,
    };
  }, [productList, inventoryList]);

  if (!user) return null;

  if (businesses.loading) {
    return (
      <div className="container page">
        <Spinner size="large" label="Loading your business…" />
      </div>
    );
  }

  if (businesses.error) {
    return (
      <div className="container page">
        <ErrorState message={businesses.error} onRetry={businesses.retry} />
      </div>
    );
  }

  if (!businesses.data?.length) {
    return (
      <div className="container page page--narrow">
        <EmptyState
          title="No business yet"
          message="Register your business first — then you can list products, manage stock and import from CSV."
          action={
            <Link to="/sell" className="btn btn--primary">
              Set up my business
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="container page">
      <div className="page__header">
        <h1 className="page__title">Seller dashboard</h1>
        <p className="page__subtitle">
          Manage where you sell, your product listings and your stock — all in one place.
        </p>
      </div>

      {businesses.data.length > 1 && (
        <div className="form__group" style={{ maxWidth: 380 }}>
          <label className="form__label" htmlFor="dash-business">Business</label>
          <select
            id="dash-business"
            className="form__select"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
          >
            {businesses.data.map((b) => (
              <option key={b.id} value={b.id}>{b.name || 'Unnamed business'}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid--4 mt-16">
        <StatCard label="Live listings" value={formatNumber(stats.live)} hint={`${stats.hidden} hidden`} />
        <StatCard label="Stock keeping units" value={formatNumber(stats.skus)} hint={`${formatNumber(stats.stockUnits)} units`} />
        <StatCard label="Stock value" value={formatCurrency(stats.stockValue, currencyCode(business?.currency))} hint="at cost price" />
        <StatCard label="Low stock alerts" value={formatNumber(stats.lowStock)} hint={stats.lowStock ? 'Needs restocking' : 'All healthy'} />
      </div>

      <div className="tabs mt-16">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tabs__tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => changeTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'channels' && <ChannelsTab business={business} stats={stats} />}
      {tab === 'orders' && <OrdersTab user={user} business={business} />}
      {tab === 'quotations' && <QuotationsTab business={business} user={user} />}
      {tab === 'invoices' && <InvoicesTab business={business} />}
      {tab === 'receipts' && <ReceiptsTab business={business} />}
      {tab === 'payments' && <PaymentsTab business={business} />}
      {tab === 'customers' && <CustomersTab business={business} />}
      {tab === 'promotions' && <PromotionsTab user={user} business={business} />}
      {tab === 'payment-settings' && <PaymentSettingsTab user={user} business={business} />}
      {tab === 'products' && (
        <ProductsTab
          user={user}
          business={business}
          products={products}
          showToast={showToast}
        />
      )}
      {tab === 'inventory' && (
        <InventoryTab
          user={user}
          business={business}
          inventory={inventory}
          showToast={showToast}
        />
      )}
      {tab === 'import' && (
        <ImportTab
          user={user}
          business={business}
          showToast={showToast}
          onImported={() => {
            products.retry();
            inventory.retry();
          }}
        />
      )}
      {tab === 'currency' && (
        <CurrencyTab
          user={user}
          business={business}
          products={products}
          inventory={inventory}
          showToast={showToast}
          onSaved={() => businesses.retry()}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- currency */

function CurrencyTab({ user, business, products, inventory, showToast, onSaved }) {
  const [selectedCurrency, setSelectedCurrency] = useState(business?.currency || DEFAULT_CURRENCY);
  const [applyExisting, setApplyExisting] = useState(true);
  const [saving, setSaving] = useState(false);

  const services = useAsync(
    () => (business?.id ? getServicesByBusiness(business.id) : Promise.resolve([])),
    [business?.id]
  );

  useEffect(() => {
    setSelectedCurrency(currencyCode(business?.currency));
  }, [business?.id, business?.currency]);

  if (!business) return null;

  const currentCurrency = currencyCode(business.currency);
  const targetCurrency = currencyCode(selectedCurrency);

  const updateInBatches = async (items, updater) => {
    let updated = 0;
    for (const item of items || []) {
      if (currencyCode(item.currency) === targetCurrency) continue;
      // eslint-disable-next-line no-await-in-loop
      await updater(item.id, { currency: targetCurrency });
      updated += 1;
    }
    return updated;
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!targetCurrency || targetCurrency === currentCurrency) {
      showToast('Choose a different currency to update.', 'info');
      return;
    }
    setSaving(true);
    try {
      await updateBusiness(business.id, { currency: targetCurrency });

      let updatedListings = 0;
      if (applyExisting) {
        const productList = products.data || [];
        const serviceList = services.data || [];
        const inventoryList = inventory.data || [];

        const updatedProducts = await updateInBatches(productList, updateProduct);
        const updatedServices = await updateInBatches(serviceList, updateService);
        const updatedInventory = await updateInBatches(inventoryList, updateInventoryItem);
        updatedListings = updatedProducts + updatedServices + updatedInventory;

        products.retry();
        inventory.retry();
      }

      showToast(
        `Currency updated to ${currencyLabel(targetCurrency)}${updatedListings ? ` · ${updatedListings} listing${updatedListings === 1 ? '' : 's'} updated` : ''}.`,
        'success'
      );
      if (onSaved) onSaved();
    } catch (err) {
      showToast(err.message || 'Could not update the currency. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const currencyOptions = CURRENCIES.map((c) => c.code);

  return (
    <div className="panel mt-16">
      <h2 className="panel__title">Currency &amp; pricing</h2>
      <p className="text-muted">
        Choose the currency used for {business.name} prices. New products, services and stock
        items default to this currency, and it is shown in the seller dashboard and on your
        storefront.
      </p>

      <form onSubmit={handleSave}>
        <div className="form__row">
          <div className="form__group">
            <label className="form__label" htmlFor="business-currency">Default currency</label>
            <select
              id="business-currency"
              className="form__select"
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency.code} value={currency.code}>{currency.label}</option>
              ))}
            </select>
            <p className="form__hint">
              Current: <strong>{currencyLabel(currentCurrency)}</strong>
            </p>
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="currency-preview">Preview</label>
            <input
              id="currency-preview"
              className="form__input"
              value={formatCurrency(1200, targetCurrency)}
              readOnly
              disabled
            />
          </div>
        </div>

        <div className="form__group">
          <label className="form__checkbox-label checkbox-row">
            <input
              type="checkbox"
              checked={applyExisting}
              onChange={(e) => setApplyExisting(e.target.checked)}
            />
            <span>
              Apply this currency to existing products, services and stock items
            </span>
          </label>
          <p className="form__hint">
            Amounts are <strong>not</strong> converted or rounded — only the currency code changes
            on the selected listings.
          </p>
        </div>

        <div className="dash-actions">
          <Button type="submit" variant="primary" loading={saving}>
            Save Currency
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelectedCurrency(currentCurrency)}>
            Reset
          </Button>
        </div>
      </form>

      <div className="mt-16">
        <h3 className="panel__title">Availability</h3>
        <p className="text-muted">
          {currencyOptions.length} currencies available.
        </p>
        <div className="flex flex-wrap gap-8 mt-8">
          {CURRENCIES.map((currency) => (
            <span
              key={currency.code}
              className={`badge ${currency.code === currentCurrency ? 'badge--success' : 'badge--neutral'}`}
            >
              {currency.code}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="panel stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      {hint && <span className="stat-card__hint">{hint}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ orders */

function OrdersTab({ user, business }) {
  const { showToast } = useToast();
  const [invoicing, setInvoicing] = useState('');
  const businessOrders = useAsync(
    () => (business?.id ? getOrdersByBusiness(business.id, 100) : Promise.resolve([])),
    [business?.id]
  );
  const ownerOrders = useAsync(
    () => (user?.uid ? getOrdersByOwner(user.uid, 100) : Promise.resolve([])),
    [user?.uid]
  );

  if (!business) return null;

  const loading = businessOrders.loading || ownerOrders.loading;
  const error = businessOrders.error || ownerOrders.error;
  const combined = [
    ...(businessOrders.data || []),
    ...(ownerOrders.data || []).filter(
      (order) => order.businessId !== business?.id && order.ownerId === user?.uid
    ),
  ].filter((order, index, all) => all.findIndex((item) => item.id === order.id) === index);

  const refresh = () => {
    businessOrders.retry();
    ownerOrders.retry();
  };

  // The seller can only advance orders that belong to this business (the
  // Firestore rules allow writes via the business owner).
  const canManage = (order) => Boolean(order.businessId) && order.businessId === business.id;

  const notifyBuyer = (order, title, message) => {
    if (!order.buyerId) return;
    createNotification({
      recipientId: order.buyerId,
      title,
      message,
      type: 'orders',
      related: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        businessId: business.id,
        businessName: business.name,
        buyerId: order.buyerId,
      },
    }).catch(() => {});
  };

  const updateStatus = async (order, status) => {
    try {
      await updateOrderStatus(order.id, status);
      refresh();
      showToast(`${order.orderNumber} → ${status}.`, 'success');
      notifyBuyer(order, 'Order update 🚚', `Your order ${order.orderNumber} is now "${status}".`);
    } catch (err) {
      showToast(err.message || 'Could not update the order status.', 'error');
    }
  };

  const updatePayment = async (order, paymentStatus) => {
    try {
      await updateOrderPaymentStatus(order.id, paymentStatus);

      // Confirming payment here must produce the same result as confirming a
      // payment proof: the buyer gets an automatically generated receipt.
      if (paymentStatus === PAYMENT_STATUS.CONFIRMED) {
        const receipt = await generateReceiptForOrder(
          { ...order, paymentStatus },
          { business }
        ).catch(() => null);
        refresh();
        showToast(
          receipt
            ? `Payment confirmed. Receipt ${receipt.receiptNumber} issued.`
            : `${order.orderNumber} payment → ${paymentStatus}.`,
          'success'
        );
        return;
      }

      refresh();
      showToast(`${order.orderNumber} payment → ${paymentStatus}.`, 'success');
      notifyBuyer(
        order,
        'Payment update 💳',
        `The payment for your order ${order.orderNumber} was marked ${paymentStatus}.`
      );
    } catch (err) {
      showToast(err.message || 'Could not update the payment status.', 'error');
    }
  };

  // Raise a draft invoice from an unpaid order, then send it for review.
  const raiseInvoice = async (order) => {
    setInvoicing(order.id);
    try {
      const draft = await createInvoiceFromOrder(order, { business });
      await sendInvoice(
        {
          ...draft,
          businessName: business.name,
          customerId: order.buyerId,
          currency: order.currency,
        },
        {}
      );
      showToast(`Invoice ${draft.invoiceNumber} sent to ${order.buyerName || 'the buyer'}.`, 'success');
      refresh();
    } catch (err) {
      showToast(err.message || 'Could not create the invoice.', 'error');
    } finally {
      setInvoicing('');
    }
  };

  if (loading) return <Spinner size="large" />;
  if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!combined.length) {
    return (
      <div className="panel">
        <EmptyState title="No orders yet" message="Orders and service requests from this store will appear here." />
      </div>
    );
  }

  return (
    <div className="panel mt-16">
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Buyer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Date</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {combined.map((order) => (
              <tr key={order.id}>
                <td><Link to={`/order/${order.id}`} className="table__link">{order.orderNumber}</Link></td>
                <td>{order.buyerName || '—'}</td>
                <td>{formatCurrency(order.total, order.currency)}</td>
                <td>
                  {canManage(order) ? (
                    <select
                      className="form__select"
                      value={order.paymentStatus || PAYMENT_STATUS.PENDING}
                      onChange={(e) => updatePayment(order, e.target.value)}
                      aria-label={`Payment status for ${order.orderNumber}`}
                    >
                      <option value={PAYMENT_STATUS.PENDING}>Pending</option>
                      <option value={PAYMENT_STATUS.CONFIRMED}>Confirmed</option>
                      <option value={PAYMENT_STATUS.REJECTED}>Rejected</option>
                    </select>
                  ) : (
                    <StatusBadge status={order.paymentStatus} />
                  )}
                </td>
                <td>
                  {canManage(order) ? (
                    <select
                      className="form__select"
                      value={order.status || ORDER_STATUS_FLOW[0]}
                      onChange={(e) => updateStatus(order, e.target.value)}
                      aria-label={`Status for ${order.orderNumber}`}
                    >
                      {ORDER_STATUS_FLOW.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <StatusBadge status={order.status} />
                  )}
                </td>
                <td>{relativeTime(order.createdAt)}</td>
                <td>
                  <div className="row-actions">
                    {canManage(order) && order.paymentStatus !== PAYMENT_STATUS.CONFIRMED && (
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        disabled={invoicing === order.id}
                        onClick={() => raiseInvoice(order)}
                      >
                        {invoicing === order.id ? 'Sending…' : 'Send invoice'}
                      </button>
                    )}
                    <Link to={`/order/${order.id}`} className="btn btn--ghost btn--sm">
                      Review
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-muted mt-16">
        Showing {combined.length} order(s). Use the dropdowns to update status and payment, or
        send an invoice for an unpaid order. Confirming a payment issues the buyer's receipt.
      </p>
    </div>
  );
}

/* ------------------------------------------------------- line items editor */

function LineItemsEditor({ items, onChange, currency, mode = 'quotation' }) {
  const update = (index, field, value) => {
    onChange(items.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };
  const add = () => onChange([...(items || []), emptyLineItem()]);
  const remove = (index) => onChange((items || []).filter((_, i) => i !== index));

  const list = items || [];

  return (
    <div className="form__group">
      <div className="dash-toolbar">
        <label className="form__label">Items *</label>
        <Button type="button" variant="ghost" size="sm" onClick={add}>+ Add item</Button>
      </div>

      {list.length === 0 && (
        <p className="text-muted">No items yet — add the products or services you are quoting.</p>
      )}

      {list.length > 0 && (
        <div className="line-items">
          <div className="line-item line-item--head">
            <span>Item</span>
            <span>Qty</span>
            <span>Unit price</span>
            {mode === 'invoice' && <span>Discount</span>}
            {mode === 'invoice' && <span>Tax %</span>}
            <span />
          </div>
          {list.map((it, i) => (
            <div className="line-item" key={i}>
              <input
                className="form__input"
                value={it.name}
                onChange={(e) => update(i, 'name', e.target.value)}
                placeholder="Item name / description"
                aria-label={`Item ${i + 1} name`}
              />
              <input
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={it.quantity}
                onChange={(e) => update(i, 'quantity', e.target.value)}
                placeholder="Qty"
                aria-label={`Item ${i + 1} quantity`}
              />
              <input
                className="form__input"
                type="number"
                min="0"
                step="0.01"
                value={it.unitPrice}
                onChange={(e) => update(i, 'unitPrice', e.target.value)}
                placeholder="Unit price"
                aria-label={`Item ${i + 1} unit price`}
              />
              {mode === 'invoice' && (
                <input
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.discount}
                  onChange={(e) => update(i, 'discount', e.target.value)}
                  placeholder="Discount"
                  aria-label={`Item ${i + 1} discount`}
                />
              )}
              {mode === 'invoice' && (
                <input
                  className="form__input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={it.tax}
                  onChange={(e) => update(i, 'tax', e.target.value)}
                  placeholder="Tax %"
                  aria-label={`Item ${i + 1} tax percent`}
                />
              )}
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => remove(i)}
                aria-label={`Remove item ${i + 1}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="form__hint">Currency: <strong>{currencyCode(currency)}</strong></p>
    </div>
  );
}

/* --------------------------------------------------------------- quotations */

function QuotationsTab({ business, user }) {
  const { showToast } = useToast();
  const quotations = useAsync(
    () => (business?.id ? getQuotationsByBusiness(business.id) : Promise.resolve([])),
    [business?.id]
  );
  // Requests can arrive addressed to the seller directly (ownerId) as well as
  // to the business, so both sources are merged for the request queue.
  const ownerQuotations = useAsync(
    () => (user?.uid ? getQuotationsByOwner(user.uid) : Promise.resolve([])),
    [user?.uid]
  );
  const [responding, setResponding] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => emptyQuotation(business?.currency));

  if (!business) return null;

  const merged = [
    ...(quotations.data || []),
    ...(ownerQuotations.data || []),
  ].filter((q, index, all) => all.findIndex((item) => item.id === q.id) === index);

  // Incoming buyer requests that still need a decision from the seller.
  const requests = merged.filter((q) => q.status === QUOTATION_STATUS.REQUESTED);
  const list = merged.filter((q) => q.status !== QUOTATION_STATUS.REQUESTED);
  const items = form.items || [];
  const total = items.reduce((sum, it) => sum + num(it.unitPrice) * num(it.quantity), 0);

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target?.value ?? event }));

  const reset = () => {
    setForm(emptyQuotation(business.currency));
    setShowForm(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.customerName.trim()) {
      showToast('Please enter the customer name.', 'error');
      return;
    }
    const cleanItems = items
      .map((it) => ({
        name: String(it.name || '').trim(),
        quantity: num(it.quantity),
        unitPrice: num(it.unitPrice),
      }))
      .filter((it) => it.name);
    if (!cleanItems.length) {
      showToast('Add at least one item to the quotation.', 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await createQuotation({
        businessId: business.id,
        businessName: business.name,
        customerId: deriveCustomerId(form),
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        items: cleanItems,
        total,
        currency: currencyCode(form.currency || business.currency),
        validUntil: form.validUntil || null,
        notes: form.notes.trim(),
      });
      showToast(`Quotation ${created.quotationNumber} created.`, 'success');
      reset();
      quotations.retry();
    } catch (err) {
      showToast(err.message || 'Could not create the quotation.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const refreshAll = () => {
    quotations.retry();
    ownerQuotations.retry();
  };

  const setStatus = async (q, status) => {
    try {
      await updateQuotation(q.id, { status });
      showToast(`${q.quotationNumber} → ${status}.`, 'success');
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Could not update the quotation.', 'error');
    }
  };

  // Triage an incoming request: accept it for quoting, ask the buyer for more
  // detail, or decline. Each option notifies the buyer.
  const respondToRequest = async (quotation, action) => {
    setResponding(`${quotation.id}-${action}`);
    try {
      await respondToQuotationRequest(quotation, action);
      showToast('Response sent to the buyer.', 'success');
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Could not send your response.', 'error');
    } finally {
      setResponding('');
    }
  };

  // Send a prepared quotation to the buyer.
  const dispatchQuotation = async (quotation) => {
    setResponding(`${quotation.id}-send`);
    try {
      await sendQuotation(quotation, {});
      showToast(`Quotation ${quotation.quotationNumber} sent.`, 'success');
      refreshAll();
    } catch (err) {
      showToast(err.message || 'Could not send the quotation.', 'error');
    } finally {
      setResponding('');
    }
  };

  const convertToInvoice = async (q) => {
    const qItems = q.items || [];
    if (!qItems.length) {
      showToast('This quotation has no items to invoice.', 'error');
      return;
    }
    try {
      const invoice = await createInvoice({
        businessId: business.id,
        businessName: business.name,
        customerId: q.customerId,
        customerName: q.customerName,
        customerEmail: q.customerEmail,
        customerPhone: q.customerPhone,
        currency: q.currency,
        notes: q.notes,
        quotationId: q.id,
        items: qItems.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discount: 0,
          tax: 0,
        })),
      });
      await updateQuotation(q.id, { status: 'invoiced', invoiceId: invoice.id });
      showToast(`Invoice ${invoice.invoiceNumber} created from the quotation.`, 'success');
      quotations.retry();
    } catch (err) {
      showToast(err.message || 'Could not create the invoice.', 'error');
    }
  };

  return (
    <>
      {/* Incoming buyer requests need a decision before anything else. */}
      {requests.length > 0 && (
        <div className="panel mt-16">
          <h2 className="panel__title">
            🔔 New quotation requests ({requests.length})
          </h2>
          <div className="request-list">
            {requests.map((request) => {
              const brief = request.request || {};
              return (
                <article key={request.id} className="request-card">
                  <header className="request-card__head">
                    <div>
                      <Link to={`/quotation/${request.id}`} className="request-card__number">
                        {request.quotationNumber}
                      </Link>
                      <span className="request-card__meta">
                        from {request.customerName || 'a buyer'} · {relativeTime(request.createdAt)}
                      </span>
                    </div>
                    <StatusBadge
                      status={request.status}
                      label={QUOTATION_STATUS_LABELS[request.status]}
                    />
                  </header>

                  <dl className="kv">
                    <dt>Product / service</dt><dd>{brief.productService || '—'}</dd>
                    <dt>Quantity</dt><dd>{brief.quantity || '—'}</dd>
                    {brief.requirements && (<><dt>Requirements</dt><dd>{brief.requirements}</dd></>)}
                    {brief.preferredDelivery && (
                      <><dt>Preferred delivery</dt><dd>{brief.preferredDelivery}</dd></>
                    )}
                    {brief.message && (<><dt>Message</dt><dd>{brief.message}</dd></>)}
                  </dl>

                  <div className="dash-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={responding === `${request.id}-accept`}
                      onClick={() => respondToRequest(request, 'accept')}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={responding === `${request.id}-clarify`}
                      onClick={() => respondToRequest(request, 'clarify')}
                    >
                      Request clarification
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={responding === `${request.id}-decline`}
                      onClick={() => respondToRequest(request, 'decline')}
                    >
                      Decline
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
          <p className="text-muted mt-16">
            Accepting a request moves it to your drafts below, where you can add line items and
            send the priced quotation.
          </p>
        </div>
      )}

      <div className="panel dash-toolbar mt-16">
        <div>
          <h2 className="panel__title">Quotations</h2>
          <p className="text-muted">
            Send a priced quote to a customer, then convert it to an invoice when they accept.
          </p>
        </div>
        <Button variant={showForm ? 'ghost' : 'primary'} onClick={() => (showForm ? reset() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ New quotation'}
        </Button>
      </div>

      {showForm && (
        <form className="panel mt-16" onSubmit={submit}>
          <h3 className="panel__title">New quotation</h3>
          <CustomerFields form={form} set={set} />
          <div className="form__row mt-16">
            <div className="form__group">
              <label className="form__label" htmlFor="q-currency">Currency</label>
              <select id="q-currency" className="form__select" value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>{currency.code}</option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="q-valid">Valid until</label>
              <input
                id="q-valid"
                type="date"
                className="form__input"
                value={form.validUntil}
                onChange={set('validUntil')}
              />
            </div>
          </div>

          <div className="mt-16">
            <LineItemsEditor
              items={items}
              onChange={(next) => setForm((prev) => ({ ...prev, items: next }))}
              currency={form.currency}
              mode="quotation"
            />
          </div>

          <div className="panel__total">
            Total: <strong>{formatCurrency(total, currencyCode(form.currency || business.currency))}</strong>
          </div>

          <div className="form__group mt-16">
            <label className="form__label" htmlFor="q-notes">Notes</label>
            <textarea
              id="q-notes"
              className="form__textarea"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Terms, delivery details, validity…"
            />
          </div>

          <div className="dash-actions">
            <Button type="submit" variant="primary" loading={saving}>Create quotation</Button>
            <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-16">
        {quotations.loading && <Spinner size="large" label="Loading quotations…" />}
        {quotations.error && <ErrorState message={quotations.error} onRetry={quotations.retry} />}
        {!quotations.loading && !quotations.error && list.length === 0 && (
          <div className="panel">
            <EmptyState
              title="No quotations yet"
              message="Create a quotation to price a sale for a customer without an order."
              action={<Button variant="primary" onClick={() => setShowForm(true)}>+ New quotation</Button>}
            />
          </div>
        )}
        {!quotations.loading && list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((q) => (
                  <tr key={q.id}>
                    <td><Link to={`/quotation/${q.id}`} className="table__link">{q.quotationNumber}</Link></td>
                    <td>{q.customerName || '—'}</td>
                    <td>{formatCurrency(q.total, q.currency)}</td>
                    <td>
                      <select
                        className="form__select"
                        value={q.status || 'draft'}
                        onChange={(e) => setStatus(q, e.target.value)}
                        aria-label={`Status for ${q.quotationNumber}`}
                      >
                        {QUOTATION_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td>{formatDate(q.createdAt)}</td>
                    <td>
                      <div className="row-actions">
                        {[QUOTATION_STATUS.DRAFT, QUOTATION_STATUS.CLARIFICATION].includes(q.status) &&
                          (q.items || []).length > 0 && (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={responding === `${q.id}-send`}
                              onClick={() => dispatchQuotation(q)}
                            >
                              {responding === `${q.id}-send` ? 'Sending…' : 'Send to buyer'}
                            </button>
                          )}
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() => convertToInvoice(q)}
                        >
                          Create invoice
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- invoices */

function InvoicesTab({ business }) {
  const { showToast } = useToast();
  const invoices = useAsync(
    () => (business?.id ? getInvoicesByBusiness(business.id) : Promise.resolve([])),
    [business?.id]
  );
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => emptyInvoice(business?.currency));
  const [payingId, setPayingId] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('mobile_money');

  if (!business) return null;

  const list = invoices.data || [];
  const items = form.items || [];
  const total = calculateInvoiceTotal(
    items.map((it) => ({
      name: it.name,
      quantity: num(it.quantity),
      unitPrice: num(it.unitPrice),
      discount: num(it.discount),
      tax: num(it.tax),
    }))
  );

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target?.value ?? event }));

  const reset = () => {
    setForm(emptyInvoice(business.currency));
    setShowForm(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.customerName.trim()) {
      showToast('Please enter the customer name.', 'error');
      return;
    }
    const cleanItems = items
      .map((it) => ({
        name: String(it.name || '').trim(),
        quantity: num(it.quantity),
        unitPrice: num(it.unitPrice),
        discount: num(it.discount),
        tax: num(it.tax),
      }))
      .filter((it) => it.name);
    if (!cleanItems.length) {
      showToast('Add at least one item to the invoice.', 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await createInvoice({
        businessId: business.id,
        businessName: business.name,
        customerId: deriveCustomerId(form),
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        currency: currencyCode(form.currency || business.currency),
        dueDate: form.dueDate || null,
        notes: form.notes.trim(),
        items: cleanItems,
      });
      showToast(`Invoice ${created.invoiceNumber} created.`, 'success');
      reset();
      invoices.retry();
    } catch (err) {
      showToast(err.message || 'Could not create the invoice.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (inv, status) => {
    try {
      await updateInvoice(inv.id, { status });
      showToast(`${inv.invoiceNumber} → ${status}.`, 'success');
      invoices.retry();
    } catch (err) {
      showToast(err.message || 'Could not update the invoice.', 'error');
    }
  };

  const recordPayment = async (inv) => {
    const amount = num(payAmount);
    if (amount <= 0) {
      showToast('Enter a valid payment amount.', 'error');
      return;
    }
    if (amount > Number(inv.balance || 0) + 0.001) {
      showToast('Payment cannot exceed the outstanding balance.', 'error');
      return;
    }
    try {
      const amountPaid = (Number(inv.amountPaid) || 0) + amount;
      const balance = Math.max(0, (Number(inv.total) || 0) - amountPaid);
      const status = balance <= 0 ? 'paid' : 'partially_paid';
      await updateInvoice(inv.id, { amountPaid, balance, status, lastPaymentMethod: payMethod });
      showToast(`Payment of ${formatCurrency(amount, inv.currency)} recorded.`, 'success');
      setPayingId(null);
      setPayAmount('');
      invoices.retry();
    } catch (err) {
      showToast(err.message || 'Could not record the payment.', 'error');
    }
  };

  return (
    <>
      <div className="panel dash-toolbar mt-16">
        <div>
          <h2 className="panel__title">Invoices</h2>
          <p className="text-muted">Bill a customer and record payments until the balance is cleared.</p>
        </div>
        <Button variant={showForm ? 'ghost' : 'primary'} onClick={() => (showForm ? reset() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ New invoice'}
        </Button>
      </div>

      {showForm && (
        <form className="panel mt-16" onSubmit={submit}>
          <h3 className="panel__title">New invoice</h3>
          <CustomerFields form={form} set={set} />
          <div className="form__row mt-16">
            <div className="form__group">
              <label className="form__label" htmlFor="i-currency">Currency</label>
              <select id="i-currency" className="form__select" value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>{currency.code}</option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="i-due">Due date</label>
              <input id="i-due" type="date" className="form__input" value={form.dueDate} onChange={set('dueDate')} />
            </div>
          </div>

          <div className="mt-16">
            <LineItemsEditor
              items={items}
              onChange={(next) => setForm((prev) => ({ ...prev, items: next }))}
              currency={form.currency}
              mode="invoice"
            />
          </div>

          <div className="panel__total">
            Total: <strong>{formatCurrency(total, currencyCode(form.currency || business.currency))}</strong>
          </div>

          <div className="form__group mt-16">
            <label className="form__label" htmlFor="i-notes">Notes</label>
            <textarea
              id="i-notes"
              className="form__textarea"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Payment terms, bank details…"
            />
          </div>

          <div className="dash-actions">
            <Button type="submit" variant="primary" loading={saving}>Create invoice</Button>
            <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-16">
        {invoices.loading && <Spinner size="large" label="Loading invoices…" />}
        {invoices.error && <ErrorState message={invoices.error} onRetry={invoices.retry} />}
        {!invoices.loading && !invoices.error && list.length === 0 && (
          <div className="panel">
            <EmptyState
              title="No invoices yet"
              message="Create an invoice to bill a customer, then record payments against it."
              action={<Button variant="primary" onClick={() => setShowForm(true)}>+ New invoice</Button>}
            />
          </div>
        )}
        {!invoices.loading && list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Balance</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((inv) => (
                  <Fragment key={inv.id}>
                    <tr>
                      <td><Link to={`/invoice/${inv.id}`} className="table__link">{inv.invoiceNumber}</Link></td>
                      <td>{inv.customerName || '—'}</td>
                      <td>{formatCurrency(inv.total, inv.currency)}</td>
                      <td>{formatCurrency(inv.balance, inv.currency)}</td>
                      <td>
                        <select
                          className="form__select"
                          value={inv.status || 'unpaid'}
                          onChange={(e) => setStatus(inv, e.target.value)}
                          aria-label={`Status for ${inv.invoiceNumber}`}
                        >
                          {INVOICE_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td>{formatDate(inv.createdAt)}</td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => {
                              setPayingId(payingId === inv.id ? null : inv.id);
                              setPayAmount('');
                              setPayMethod('mobile_money');
                            }}
                          >
                            Record payment
                          </button>
                        </div>
                      </td>
                    </tr>
                    {payingId === inv.id && (
                      <tr className="row-expand">
                        <td colSpan={7}>
                          <div className="row-expand__inner">
                            <div className="form__group">
                              <label className="form__label" htmlFor="pay-amount">Amount received</label>
                              <input
                                id="pay-amount"
                                type="number"
                                min="0"
                                step="0.01"
                                className="form__input"
                                value={payAmount}
                                onChange={(e) => setPayAmount(e.target.value)}
                                placeholder={`Outstanding: ${formatCurrency(inv.balance, inv.currency)}`}
                              />
                            </div>
                            <div className="form__group">
                              <label className="form__label" htmlFor="pay-method">Payment method</label>
                              <select
                                id="pay-method"
                                className="form__select"
                                value={payMethod}
                                onChange={(e) => setPayMethod(e.target.value)}
                              >
                                {PAYMENT_METHODS.map((m) => (
                                  <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="dash-actions">
                              <Button variant="primary" size="sm" onClick={() => recordPayment(inv)}>
                                Save payment
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setPayingId(null)}>
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- receipts */

function ReceiptsTab({ business }) {
  const { showToast } = useToast();
  const receipts = useAsync(
    () => (business?.id ? getReceiptsByBusiness(business.id) : Promise.resolve([])),
    [business?.id]
  );
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => emptyReceipt(business?.currency));

  if (!business) return null;

  const list = receipts.data || [];

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target?.value ?? event }));

  const reset = () => {
    setForm(emptyReceipt(business.currency));
    setShowForm(false);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.customerName.trim()) {
      showToast('Please enter the customer name.', 'error');
      return;
    }
    const amount = num(form.amount);
    if (amount <= 0) {
      showToast('Please enter a valid amount.', 'error');
      return;
    }
    setSaving(true);
    try {
      const created = await createReceipt({
        businessId: business.id,
        businessName: business.name,
        customerId: deriveCustomerId(form),
        customerName: form.customerName.trim(),
        customerEmail: form.customerEmail.trim(),
        customerPhone: form.customerPhone.trim(),
        amount,
        currency: currencyCode(form.currency || business.currency),
        paymentMethod: form.paymentMethod || 'mobile_money',
        paymentReference: form.paymentReference.trim(),
        orderId: form.orderId.trim() || null,
        invoiceId: form.invoiceId.trim() || null,
        notes: form.notes.trim(),
      });
      showToast(`Receipt ${created.receiptNumber} issued.`, 'success');
      reset();
      receipts.retry();
    } catch (err) {
      showToast(err.message || 'Could not issue the receipt.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="panel dash-toolbar mt-16">
        <div>
          <h2 className="panel__title">Receipts</h2>
          <p className="text-muted">Issue a receipt the moment a customer pays — cash, mobile money or bank.</p>
        </div>
        <Button variant={showForm ? 'ghost' : 'primary'} onClick={() => (showForm ? reset() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ Issue receipt'}
        </Button>
      </div>

      {showForm && (
        <form className="panel mt-16" onSubmit={submit}>
          <h3 className="panel__title">New receipt</h3>
          <CustomerFields form={form} set={set} />

          <div className="form__row mt-16">
            <div className="form__group">
              <label className="form__label" htmlFor="r-amount">Amount received *</label>
              <input
                id="r-amount"
                type="number"
                min="0"
                step="0.01"
                className="form__input"
                value={form.amount}
                onChange={set('amount')}
                placeholder="0.00"
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="r-currency">Currency</label>
              <select id="r-currency" className="form__select" value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>{currency.code}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="r-method">Payment method</label>
              <select id="r-method" className="form__select" value={form.paymentMethod} onChange={set('paymentMethod')}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="r-ref">Payment reference</label>
              <input
                id="r-ref"
                className="form__input"
                value={form.paymentReference}
                onChange={set('paymentReference')}
                placeholder="e.g. MTN MoMo transaction ID"
              />
            </div>
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="r-order">Order number (optional)</label>
              <input
                id="r-order"
                className="form__input"
                value={form.orderId}
                onChange={set('orderId')}
                placeholder="e.g. ORD-2026…"
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="r-invoice">Invoice number (optional)</label>
              <input
                id="r-invoice"
                className="form__input"
                value={form.invoiceId}
                onChange={set('invoiceId')}
                placeholder="e.g. INV-2026…"
              />
            </div>
          </div>

          <div className="form__group mt-16">
            <label className="form__label" htmlFor="r-notes">Notes</label>
            <textarea
              id="r-notes"
              className="form__textarea"
              value={form.notes}
              onChange={set('notes')}
              placeholder="What was the payment for?"
            />
          </div>

          <div className="dash-actions">
            <Button type="submit" variant="primary" loading={saving}>Issue receipt</Button>
            <Button type="button" variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-16">
        {receipts.loading && <Spinner size="large" label="Loading receipts…" />}
        {receipts.error && <ErrorState message={receipts.error} onRetry={receipts.retry} />}
        {!receipts.loading && !receipts.error && list.length === 0 && (
          <div className="panel">
            <EmptyState
              title="No receipts yet"
              message="Issue a receipt whenever you receive a payment from a customer."
              action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Issue receipt</Button>}
            />
          </div>
        )}
        {!receipts.loading && list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td><Link to={`/receipt/${r.id}`} className="table__link">{r.receiptNumber}</Link></td>
                    <td>{r.customerName || '—'}</td>
                    <td>{formatCurrency(r.amount, r.currency)}</td>
                    <td>{r.paymentMethod || '—'}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{formatDate(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- channels */

function ChannelsTab({ business, stats }) {
  const { showToast } = useToast();
  if (!business) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const storeUrl = `${origin}/store/${business.id}`;
  const whatsappNumber = (business.whatsapp || business.phone || '').replace(/[^0-9]/g, '');

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Link copied to clipboard.', 'success');
    } catch (err) {
      showToast('Could not copy — please copy the link manually.', 'error');
    }
  };

  const channels = [
    {
      key: 'store',
      icon: '🏪',
      title: 'Your Seedwel storefront',
      description:
        'Your own branded page on Seedwel Hub with all your products, services and contact details.',
      status: 'Live',
      statusTone: 'ok',
      to: `/store/${business.id}`,
      linkLabel: 'View my store',
      share: storeUrl,
    },
    {
      key: 'marketplace',
      icon: '🛒',
      title: 'Seedwel Marketplace',
      description:
        'Every product you list appears in the public marketplace where buyers browse and search.',
      status: stats.live > 0 ? `${stats.live} product${stats.live === 1 ? '' : 's'} listed` : 'No products yet',
      statusTone: stats.live > 0 ? 'ok' : 'warn',
      to: '/marketplace',
      linkLabel: 'Open marketplace',
      share: `${origin}/marketplace`,
    },
    {
      key: 'directory',
      icon: '📇',
      title: 'Business directory',
      description:
        'Buyers find you by category and location in the Seedwel business directory.',
      status: business.isVerified ? 'Listed · Verified' : 'Listed · Not verified',
      statusTone: business.isVerified ? 'ok' : 'warn',
      to: '/businesses',
      linkLabel: 'See directory',
      share: `${origin}/businesses`,
    },
    {
      key: 'quotes',
      icon: '🧾',
      title: 'Quotations, invoices & receipts',
      description:
        'Sell directly to a customer: send a quotation, convert it to an invoice, record payments and issue receipts.',
      status: 'Available',
      statusTone: 'ok',
      to: '/seller?tab=quotations',
      linkLabel: 'Manage quotations',
    },
    {
      key: 'messages',
      icon: '💬',
      title: 'Direct messages & groups',
      description:
        'Close deals in chat with buyers, or post offers to trading groups you belong to.',
      status: 'Available',
      statusTone: 'ok',
      to: '/messages',
      linkLabel: 'Open messages',
    },
    {
      key: 'whatsapp',
      icon: '📱',
      title: 'WhatsApp orders',
      description: whatsappNumber
        ? 'Buyers can tap through from your store straight into a WhatsApp chat with you.'
        : 'Add a WhatsApp number to your business profile to accept orders on WhatsApp.',
      status: whatsappNumber ? 'Connected' : 'Not set up',
      statusTone: whatsappNumber ? 'ok' : 'warn',
      href: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
      to: whatsappNumber ? null : '/sell',
      linkLabel: whatsappNumber ? 'Open WhatsApp' : 'Add number',
      share: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
    },
  ];

  return (
    <>
      <div className="panel">
        <h2 className="panel__title">Where {business.name} can sell</h2>
        <p className="text-muted">
          These are all the sales channels open to your business right now. Share the links
          anywhere — social media, WhatsApp status, print — and buyers land straight on your
          products.
        </p>
      </div>

      <div className="grid grid--2 mt-16">
        {channels.map((c) => (
          <div key={c.key} className="panel channel-card">
            <div className="channel-card__head">
              <span className="channel-card__icon" aria-hidden="true">{c.icon}</span>
              <div>
                <h3 className="channel-card__title">{c.title}</h3>
                <span className={`badge badge--${c.statusTone === 'ok' ? 'success' : 'warning'}`}>
                  {c.status}
                </span>
              </div>
            </div>
            <p className="channel-card__desc">{c.description}</p>
            <div className="channel-card__actions">
              {c.to && (
                <Link to={c.to} className="btn btn--primary btn--sm">{c.linkLabel}</Link>
              )}
              {c.href && (
                <a href={c.href} target="_blank" rel="noreferrer" className="btn btn--primary btn--sm">
                  {c.linkLabel}
                </a>
              )}
              {c.share && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => copy(c.share)}>
                  Copy link
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- products */

function ImageUrlField({ value, onChange, label = 'Image URL', id }) {
  const { showToast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      showToast('Please choose an image file.', 'error');
      return;
    }
    setUploading(true);
    try {
      const result = await uploadImageToCloudinary(file);
      onChange(result.secureUrl);
    } catch (err) {
      showToast(err.message || 'Upload failed. Please try again.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const valid = !value || isValidImageUrl(value);

  return (
    <div className="form__group">
      <label className="form__label" htmlFor={id}>{label}</label>
      <div className="image-url-field">
        <div className="image-url-field__preview">
          {value && valid ? (
            <img loading="lazy" decoding="async" src={value} alt="" onError={(e) => { e.currentTarget.style.opacity = 0.15; }} />
          ) : (
            <span aria-hidden="true">🖼️</span>
          )}
        </div>
        <div className="image-url-field__inputs">
          <input
            id={id}
            className="form__input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
          <label className="btn btn--ghost btn--sm">
            {uploading ? 'Uploading…' : 'Or upload a file'}
            <input type="file" accept="image/*" hidden onChange={handleFile} disabled={uploading} />
          </label>
        </div>
      </div>
      {!valid && <span className="form__error">That does not look like a valid http(s) image URL.</span>}
    </div>
  );
}

function ProductsTab({ user, business, products, showToast }) {
  const [form, setForm] = useState(() => emptyProduct(business?.currency));
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target?.value ?? event }));

  const reset = () => {
    setForm(emptyProduct(business?.currency));
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (product) => {
    setForm({
      name: product.name || '',
      category: product.category || '',
      description: product.description || '',
      price: product.price ?? '',
      currency: currencyCode(product.currency || business?.currency),
      sku: product.sku || '',
      stock: product.stock ?? '',
      unit: product.unit || 'piece',
      location: product.location || '',
      image: product.image || '',
    });
    setEditingId(product.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!business) return;
    if (!form.name.trim()) {
      showToast('Please enter a product name.', 'error');
      return;
    }
    if (form.image && !isValidImageUrl(form.image)) {
      showToast('Please enter a valid image URL (starting with http or https).', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim(),
        price: num(form.price),
        currency: currencyCode(form.currency || business?.currency),
        sku: form.sku.trim(),
        stock: num(form.stock),
        unit: form.unit.trim() || 'piece',
        location: form.location.trim(),
        image: form.image.trim(),
      };
      if (editingId) {
        await updateProduct(editingId, payload);
        showToast('Product updated.', 'success');
      } else {
        await createProduct(user.uid, {
          ...payload,
          businessId: business.id,
          businessName: business.name,
        });
        showToast('Product listed — it is live in the marketplace now.', 'success');
      }
      reset();
      products.retry();
    } catch (err) {
      showToast(err.message || 'Could not save the product.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (product) => {
    try {
      await updateProduct(product.id, {
        status: product.status === 'hidden' ? 'active' : 'hidden',
      });
      products.retry();
    } catch (err) {
      showToast(err.message || 'Could not update the product.', 'error');
    }
  };

  const remove = async (product) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct(product.id);
      showToast('Product deleted.', 'success');
      products.retry();
    } catch (err) {
      showToast(err.message || 'Could not delete the product.', 'error');
    }
  };

  const list = products.data || [];

  return (
    <>
      <div className="panel dash-toolbar">
        <div>
          <h2 className="panel__title">Your products</h2>
          <p className="text-muted">Everything here shows on your storefront and in the marketplace.</p>
        </div>
        <Button variant={showForm ? 'ghost' : 'primary'} onClick={() => (showForm ? reset() : setShowForm(true))}>
          {showForm ? 'Cancel' : '+ Add product'}
        </Button>
      </div>

      {showForm && (
        <form className="panel mt-16" onSubmit={submit}>
          <h3 className="panel__title">{editingId ? 'Edit product' : 'New product'}</h3>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="p-name">Product name *</label>
              <input id="p-name" className="form__input" value={form.name} onChange={set('name')} placeholder="e.g. Fresh Maize 50kg" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="p-category">Category</label>
              <select id="p-category" className="form__select" value={form.category} onChange={set('category')}>
                <option value="">Choose…</option>
                {BUSINESS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="p-price">Price *</label>
              <input id="p-price" type="number" min="0" step="0.01" className="form__input" value={form.price} onChange={set('price')} placeholder="0.00" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="p-currency">Currency</label>
              <select id="p-currency" className="form__select" value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>{currency.code}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="p-sku">SKU / product code</label>
              <input id="p-sku" className="form__input" value={form.sku} onChange={set('sku')} placeholder="MAIZE-50" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="p-stock">Stock on hand</label>
              <input id="p-stock" type="number" min="0" className="form__input" value={form.stock} onChange={set('stock')} placeholder="0" />
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="p-unit">Unit</label>
              <input id="p-unit" className="form__input" value={form.unit} onChange={set('unit')} placeholder="piece / bag / kg" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="p-location">Location</label>
              <input id="p-location" className="form__input" value={form.location} onChange={set('location')} placeholder="Lusaka" />
            </div>
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="p-desc">Description</label>
            <textarea id="p-desc" className="form__textarea" value={form.description} onChange={set('description')} placeholder="What are you selling?" />
          </div>
          <ImageUrlField
            id="p-image"
            label="Product image URL"
            value={form.image}
            onChange={(v) => setForm((prev) => ({ ...prev, image: v }))}
          />
          <div className="dash-actions">
            <Button type="submit" variant="primary" loading={saving}>
              {editingId ? 'Save changes' : 'List product'}
            </Button>
            <Button variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-16">
        {products.loading && <Spinner size="large" label="Loading products…" />}
        {products.error && <ErrorState message={products.error} onRetry={products.retry} />}
        {!products.loading && !products.error && list.length === 0 && (
          <EmptyState
            title="No products yet"
            message="Add your first product, or import a batch from CSV."
            action={<Button variant="primary" onClick={() => setShowForm(true)}>+ Add product</Button>}
          />
        )}
        {!products.loading && list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="cell-media">
                        {p.image ? (
                          <img loading="lazy" decoding="async" src={p.image} alt="" className="cell-media__img" />
                        ) : (
                          <span className="cell-media__img cell-media__img--empty">📦</span>
                        )}
                        <div>
                          <Link to={`/product/${p.id}`} className="table__link">{p.name}</Link>
                          <div className="text-muted" style={{ fontSize: 13 }}>{p.category || 'Uncategorised'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.sku || '—'}</td>
                    <td>{formatCurrency(p.price, p.currency || 'UGX')}</td>
                    <td>{formatNumber(p.stock ?? 0)} {p.unit || ''}</td>
                    <td>
                      <span className={`badge badge--${p.status === 'hidden' ? 'muted' : 'success'}`}>
                        {p.status === 'hidden' ? 'Hidden' : 'Live'}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => startEdit(p)}>Edit</button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggleVisibility(p)}>
                          {p.status === 'hidden' ? 'Publish' : 'Hide'}
                        </button>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(p)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* --------------------------------------------------------------- inventory */

function InventoryTab({ user, business, inventory, showToast }) {
  const [form, setForm] = useState(() => emptyInventory(business?.currency));
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target?.value ?? event }));

  const submit = async (event) => {
    event.preventDefault();
    if (!business) return;
    if (!form.productName.trim()) {
      showToast('Please enter the product name for this stock item.', 'error');
      return;
    }
    if (form.image && !isValidImageUrl(form.image)) {
      showToast('Please enter a valid image URL (starting with http or https).', 'error');
      return;
    }
    setSaving(true);
    try {
      await createInventoryItem(user.uid, {
        businessId: business.id,
        businessName: business.name,
        sku: form.sku.trim(),
        productName: form.productName.trim(),
        quantity: num(form.quantity),
        unit: form.unit.trim() || 'piece',
        lowStockAlert: num(form.lowStockAlert),
        costPrice: num(form.costPrice),
        currency: currencyCode(form.currency || business?.currency),
        warehouse: form.warehouse.trim() || 'Main Store',
        image: form.image.trim(),
      });
      setForm(emptyInventory(business.currency));
      setShowForm(false);
      showToast('Stock item added.', 'success');
      inventory.retry();
    } catch (err) {
      showToast(err.message || 'Could not save the stock item.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const adjust = async (item, delta) => {
    try {
      await adjustStock(item, delta, delta > 0 ? 'stock in' : 'stock out', user.uid);
      inventory.retry();
    } catch (err) {
      showToast(err.message || 'Could not update stock.', 'error');
    }
  };

  const remove = async (item) => {
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Remove "${item.productName}" from inventory?`)) return;
    try {
      await deleteInventoryItem(item.id);
      inventory.retry();
    } catch (err) {
      showToast(err.message || 'Could not remove the item.', 'error');
    }
  };

  const list = inventory.data || [];

  return (
    <>
      <div className="panel dash-toolbar">
        <div>
          <h2 className="panel__title">Inventory</h2>
          <p className="text-muted">Track stock per SKU, set low-stock alerts and keep an image for each item.</p>
        </div>
        <Button variant={showForm ? 'ghost' : 'primary'} onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ Add stock item'}
        </Button>
      </div>

      {showForm && (
        <form className="panel mt-16" onSubmit={submit}>
          <h3 className="panel__title">New stock item</h3>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="i-name">Product name *</label>
              <input id="i-name" className="form__input" value={form.productName} onChange={set('productName')} placeholder="Fresh Maize 50kg Bag" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="i-sku">SKU</label>
              <input id="i-sku" className="form__input" value={form.sku} onChange={set('sku')} placeholder="MAIZE-50" />
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="i-qty">Quantity</label>
              <input id="i-qty" type="number" min="0" className="form__input" value={form.quantity} onChange={set('quantity')} placeholder="0" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="i-unit">Unit</label>
              <input id="i-unit" className="form__input" value={form.unit} onChange={set('unit')} placeholder="bag" />
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="i-low">Low-stock alert at</label>
              <input id="i-low" type="number" min="0" className="form__input" value={form.lowStockAlert} onChange={set('lowStockAlert')} placeholder="10" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="i-cost">Cost price</label>
              <input id="i-cost" type="number" min="0" step="0.01" className="form__input" value={form.costPrice} onChange={set('costPrice')} placeholder="0.00" />
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="i-currency">Currency</label>
              <select id="i-currency" className="form__select" value={form.currency} onChange={set('currency')}>
                {CURRENCIES.map((currency) => (
                  <option key={currency.code} value={currency.code}>{currency.code}</option>
                ))}
              </select>
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="i-wh">Warehouse / store</label>
              <input id="i-wh" className="form__input" value={form.warehouse} onChange={set('warehouse')} placeholder="Main Store" />
            </div>
          </div>
          <ImageUrlField
            id="i-image"
            label="Item image URL"
            value={form.image}
            onChange={(v) => setForm((prev) => ({ ...prev, image: v }))}
          />
          <div className="dash-actions">
            <Button type="submit" variant="primary" loading={saving}>Add to inventory</Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="mt-16">
        {inventory.loading && <Spinner size="large" label="Loading inventory…" />}
        {inventory.error && <ErrorState message={inventory.error} onRetry={inventory.retry} />}
        {!inventory.loading && !inventory.error && list.length === 0 && (
          <EmptyState
            title="No stock recorded"
            message="Add stock items one by one, or upload your whole stock list as a CSV."
          />
        )}
        {!inventory.loading && list.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Cost</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {list.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="cell-media">
                        {item.image ? (
                          <img loading="lazy" decoding="async" src={item.image} alt="" className="cell-media__img" />
                        ) : (
                          <span className="cell-media__img cell-media__img--empty">📦</span>
                        )}
                        <div>
                          <strong>{item.productName}</strong>
                          {isLowStock(item) && (
                            <div><span className="badge badge--warning">Low stock</span></div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{item.sku || '—'}</td>
                    <td>{item.warehouse || '—'}</td>
                    <td>
                      <div className="qty-adjust">
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => adjust(item, -1)} aria-label="Decrease">−</button>
                        <span>{formatNumber(item.quantity)} {item.unit || ''}</span>
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => adjust(item, 1)} aria-label="Increase">+</button>
                      </div>
                    </td>
                    <td>{formatCurrency(item.costPrice, currencyCode(item.currency || business?.currency))}</td>
                    <td>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => remove(item)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ import */

function mapProductRow(row, defaultCurrency = DEFAULT_CURRENCY) {
  return {
    name: row.name || row.product_name || '',
    category: row.category || '',
    description: row.description || '',
    price: num(row.price),
    currency: currencyCode(row.currency || defaultCurrency),
    sku: row.sku || '',
    stock: num(row.stock || row.quantity),
    unit: row.unit || 'piece',
    location: row.location || '',
    image: row.image_url || row.image || '',
    images: [row.image_url, row.image_url_2, row.image_url_3].filter(
      (u) => u && isValidImageUrl(u)
    ),
  };
}

function mapInventoryRow(row, defaultCurrency = DEFAULT_CURRENCY) {
  return {
    sku: row.sku || '',
    productName: row.product_name || row.name || '',
    quantity: num(row.quantity),
    unit: row.unit || 'piece',
    lowStockAlert: num(row.low_stock_alert),
    costPrice: num(row.cost_price),
    currency: currencyCode(row.currency || defaultCurrency),
    warehouse: row.warehouse || 'Main Store',
    image: row.image_url || row.image || '',
  };
}

function validateRows(kind, rows) {
  return rows.map((row, index) => {
    const errors = [];
    const nameField = kind === 'products' ? row.name : row.productName;
    if (!String(nameField || '').trim()) errors.push('Name is required');
    if (kind === 'products' && !(row.price >= 0)) errors.push('Price must be a number');
    if (kind === 'inventory' && !(row.quantity >= 0)) errors.push('Quantity must be a number');
    if (row.image && !isValidImageUrl(row.image)) errors.push('Image URL must start with http(s)');
    return { line: index + 2, data: row, errors };
  });
}

function ImportTab({ user, business, showToast, onImported }) {
  const [kind, setKind] = useState('products');
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const headers = kind === 'products' ? PRODUCT_CSV_HEADERS : INVENTORY_CSV_HEADERS;

  const resetPreview = () => {
    setPreview([]);
    setFileName('');
    setResult(null);
  };

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setResult(null);
    try {
      const text = await readFileAsText(file);
      const { rows } = parseCsv(text);
      if (!rows.length) {
        showToast('That CSV has no data rows.', 'error');
        return;
      }
      const mapRow = kind === 'products' ? mapProductRow : mapInventoryRow;
      const mapped = rows.map((row) => mapRow(row, business?.currency || DEFAULT_CURRENCY));
      setPreview(validateRows(kind, mapped));
      setFileName(file.name);
    } catch (err) {
      showToast(err.message || 'Could not read that CSV.', 'error');
    } finally {
      event.target.value = '';
    }
  };

  const validRows = preview.filter((r) => r.errors.length === 0);
  const invalidRows = preview.filter((r) => r.errors.length > 0);

  const runImport = async () => {
    if (!business || !validRows.length) return;
    setImporting(true);
    try {
      const payload = validRows.map((r) => r.data);
      const res =
        kind === 'products'
          ? await bulkCreateProducts(user.uid, business.id, business.name, payload)
          : await bulkCreateInventory(user.uid, business.id, business.name, payload);
      setResult(res);
      showToast(
        `Imported ${res.created} ${kind === 'products' ? 'product' : 'stock'} row${res.created === 1 ? '' : 's'}.`,
        res.failed.length ? 'info' : 'success'
      );
      setPreview([]);
      setFileName('');
      onImported();
    } catch (err) {
      showToast(err.message || 'Import failed. Please try again.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <div className="panel">
        <h2 className="panel__title">Bulk import from CSV</h2>
        <p className="text-muted">
          Upload many products or stock items at once. Image links are plain URLs — paste the
          address of any photo already hosted online and it will be used as the listing image.
        </p>

        <div className="tabs mt-16">
          <button
            type="button"
            className={`tabs__tab ${kind === 'products' ? 'active' : ''}`}
            onClick={() => { setKind('products'); resetPreview(); }}
          >
            Products
          </button>
          <button
            type="button"
            className={`tabs__tab ${kind === 'inventory' ? 'active' : ''}`}
            onClick={() => { setKind('inventory'); resetPreview(); }}
          >
            Inventory
          </button>
        </div>

        <ol className="import-steps">
          <li>
            <strong>Download the sample CSV</strong> and open it in Excel, Google Sheets or Numbers.
            <div className="mt-8">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  kind === 'products'
                    ? downloadCsv('seedwel-products-sample.csv', productSampleCsv())
                    : downloadCsv('seedwel-inventory-sample.csv', inventorySampleCsv())
                }
              >
                ⬇ Download {kind === 'products' ? 'product' : 'inventory'} sample CSV
              </Button>
            </div>
          </li>
          <li>
            <strong>Replace the sample rows with your own</strong>, keeping the header row exactly
            as it is. Required columns are marked below.
          </li>
          <li>
            <strong>Upload the finished file</strong> — you will see a preview and any row errors
            before anything is saved.
            <div className="mt-8">
              <label className="btn btn--primary btn--sm">
                Choose CSV file
                <input type="file" accept=".csv,text/csv" hidden onChange={handleFile} />
              </label>
              {fileName && <span className="text-muted" style={{ marginLeft: 10 }}>{fileName}</span>}
            </div>
          </li>
        </ol>

        <div className="table-wrap mt-16">
          <table className="table">
            <thead>
              <tr>
                <th>Column</th>
                <th>Required</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              {headers.map((h) => {
                const required =
                  (kind === 'products' && (h === 'name' || h === 'price')) ||
                  (kind === 'inventory' && (h === 'product_name' || h === 'quantity'));
                const example =
                  kind === 'products'
                    ? { name: 'Fresh Maize 50kg Bag', category: 'Agriculture', description: 'Grade A white maize', price: '320', currency: 'UGX', sku: 'MAIZE-50', stock: '120', unit: 'bag', location: 'Lusaka', image_url: 'https://…/maize.jpg', image_url_2: 'https://…/maize-2.jpg', image_url_3: '' }[h]
                    : { sku: 'MAIZE-50', product_name: 'Fresh Maize 50kg Bag', quantity: '120', unit: 'bag', low_stock_alert: '20', cost_price: '260', warehouse: 'Main Store', image_url: 'https://…/maize.jpg' }[h];
                return (
                  <tr key={h}>
                    <td><code>{h}</code></td>
                    <td>{required ? <span className="badge badge--warning">Required</span> : <span className="text-muted">Optional</span>}</td>
                    <td className="text-muted">{example || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="panel mt-16">
          <h3 className="panel__title">
            Preview — {validRows.length} ready, {invalidRows.length} with problems
          </h3>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Image</th>
                  <th>Name</th>
                  <th>{kind === 'products' ? 'Price' : 'Quantity'}</th>
                  <th>SKU</th>
                  <th>Problems</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 100).map((r) => (
                  <tr key={r.line}>
                    <td>{r.line}</td>
                    <td>
                      {r.data.image && isValidImageUrl(r.data.image) ? (
                        <img loading="lazy" decoding="async" src={r.data.image} alt="" className="cell-media__img" />
                      ) : (
                        <span className="cell-media__img cell-media__img--empty">🖼️</span>
                      )}
                    </td>
                    <td>{kind === 'products' ? r.data.name : r.data.productName}</td>
                    <td>
                      {kind === 'products'
                        ? formatCurrency(r.data.price, r.data.currency)
                        : `${formatNumber(r.data.quantity)} ${r.data.unit || ''}`}
                    </td>
                    <td>{r.data.sku || '—'}</td>
                    <td>
                      {r.errors.length ? (
                        <span className="badge badge--danger">{r.errors.join(', ')}</span>
                      ) : (
                        <span className="badge badge--success">Ready</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.length > 100 && (
            <p className="text-muted mt-8">Showing the first 100 of {preview.length} rows.</p>
          )}
          <div className="dash-actions">
            <Button variant="primary" loading={importing} disabled={!validRows.length} onClick={runImport}>
              Import {validRows.length} row{validRows.length === 1 ? '' : 's'}
            </Button>
            <Button variant="ghost" onClick={resetPreview}>Discard</Button>
          </div>
        </div>
      )}

      {result && (
        <div className="panel mt-16">
          <h3 className="panel__title">Import finished</h3>
          <p>{result.created} row{result.created === 1 ? '' : 's'} saved successfully.</p>
          {result.failed.length > 0 && (
            <ul className="text-muted">
              {result.failed.map((f) => (
                <li key={f.row}>Line {f.row}: {f.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}
