import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import useAsync from '../hooks/useAsync';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import { getBusinessesByOwner } from '../services/businessService';
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
  adjustStock,
  deleteInventoryItem,
  bulkCreateInventory,
  isLowStock,
} from '../services/inventoryService';
import { uploadImageToCloudinary } from '../cloudinary/upload';
import { BUSINESS_CATEGORIES } from '../utils/constants';
import { formatCurrency, formatNumber } from '../utils/format';
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
  { id: 'products', label: 'Products' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'import', label: 'Bulk import (CSV)' },
];

const EMPTY_PRODUCT = {
  name: '',
  category: '',
  description: '',
  price: '',
  currency: 'UGX',
  sku: '',
  stock: '',
  unit: 'piece',
  location: '',
  image: '',
};

const EMPTY_INVENTORY = {
  sku: '',
  productName: '',
  quantity: '',
  unit: 'piece',
  lowStockAlert: '',
  costPrice: '',
  warehouse: 'Main Store',
  image: '',
};

function num(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SellerDashboardPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState('channels');
  const [businessId, setBusinessId] = useState('');

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
        <StatCard label="Stock value" value={formatCurrency(stats.stockValue)} hint="at cost price" />
        <StatCard label="Low stock alerts" value={formatNumber(stats.lowStock)} hint={stats.lowStock ? 'Needs restocking' : 'All healthy'} />
      </div>

      <div className="tabs mt-16">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tabs__tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'channels' && <ChannelsTab business={business} stats={stats} />}
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
      title: 'Quotations & invoices',
      description:
        'Sell directly to a customer: send a quotation, convert it to an invoice and issue a receipt.',
      status: 'Available',
      statusTone: 'ok',
      to: '/quotations',
      linkLabel: 'Create a quotation',
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
            <img src={value} alt="" onError={(e) => { e.currentTarget.style.opacity = 0.15; }} />
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
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target?.value ?? event }));

  const reset = () => {
    setForm(EMPTY_PRODUCT);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (product) => {
    setForm({
      name: product.name || '',
      category: product.category || '',
      description: product.description || '',
      price: product.price ?? '',
      currency: product.currency || 'UGX',
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
        currency: form.currency || 'UGX',
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
              <label className="form__label" htmlFor="p-sku">SKU / product code</label>
              <input id="p-sku" className="form__input" value={form.sku} onChange={set('sku')} placeholder="MAIZE-50" />
            </div>
          </div>
          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="p-stock">Stock on hand</label>
              <input id="p-stock" type="number" min="0" className="form__input" value={form.stock} onChange={set('stock')} placeholder="0" />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="p-unit">Unit</label>
              <input id="p-unit" className="form__input" value={form.unit} onChange={set('unit')} placeholder="piece / bag / kg" />
            </div>
          </div>
          <div className="form__group">
            <label className="form__label" htmlFor="p-location">Location</label>
            <input id="p-location" className="form__input" value={form.location} onChange={set('location')} placeholder="Lusaka" />
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
                          <img src={p.image} alt="" className="cell-media__img" />
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
  const [form, setForm] = useState(EMPTY_INVENTORY);
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
        warehouse: form.warehouse.trim() || 'Main Store',
        image: form.image.trim(),
      });
      setForm(EMPTY_INVENTORY);
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
          <div className="form__group">
            <label className="form__label" htmlFor="i-wh">Warehouse / store</label>
            <input id="i-wh" className="form__input" value={form.warehouse} onChange={set('warehouse')} placeholder="Main Store" />
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
                          <img src={item.image} alt="" className="cell-media__img" />
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
                    <td>{formatCurrency(item.costPrice)}</td>
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

function mapProductRow(row) {
  return {
    name: row.name || row.product_name || '',
    category: row.category || '',
    description: row.description || '',
    price: num(row.price),
    currency: row.currency || 'UGX',
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

function mapInventoryRow(row) {
  return {
    sku: row.sku || '',
    productName: row.product_name || row.name || '',
    quantity: num(row.quantity),
    unit: row.unit || 'piece',
    lowStockAlert: num(row.low_stock_alert),
    costPrice: num(row.cost_price),
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
      const mapped = rows.map(kind === 'products' ? mapProductRow : mapInventoryRow);
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
                        <img src={r.data.image} alt="" className="cell-media__img" />
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
