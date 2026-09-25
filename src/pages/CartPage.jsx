import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AcceptedMethods from '../components/payments/AcceptedMethods';
import { EmptyState } from '../components/PageState';
import Spinner from '../components/Spinner';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useToast } from '../contexts/ToastContext';
import { getBusiness } from '../services/businessService';
import { placeOrder } from '../services/orderService';
import { getAcceptedMethodSummary } from '../services/sellerPaymentService';
import { getProduct } from '../services/productService';
import { getActivePromotions } from '../services/promotionService';
import { applyPromotion, promotionForProduct } from '../utils/promotions';
import { groupCartItems, getFulfillmentOptions } from '../utils/cart';
import { currencyCode, PAYMENT_METHODS } from '../utils/constants';
import { formatCurrency } from '../utils/format';

export default function CartPage() {
  const { user, profile } = useAuth();
  const { items, count, setQuantity, removeItem, updateProduct, clearCart } = useCart();
  const { showToast } = useToast();
  const groups = useMemo(() => groupCartItems(items), [items]);
  const businessKey = [...new Set(groups.map((group) => group.businessId).filter(Boolean))].sort().join('|');
  const businessIds = businessKey ? businessKey.split('|') : [];
  const [businesses, setBusinesses] = useState({});
  const [businessesLoading, setBusinessesLoading] = useState(false);
  const [acceptedMethods, setAcceptedMethods] = useState({});
  const [acceptedMethodsLoading, setAcceptedMethodsLoading] = useState(false);
  const [form, setForm] = useState(() => ({
    name: profile?.name || '',
    phone: profile?.phone || '',
    address: profile?.location || '',
    note: '',
  }));
  const [fulfillment, setFulfillment] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
  const [placing, setPlacing] = useState(false);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    setForm((current) => ({
      ...current,
      name: current.name || profile?.name || '',
      phone: current.phone || profile?.phone || '',
      address: current.address || profile?.location || '',
    }));
  }, [profile?.name, profile?.phone, profile?.location]);

  useEffect(() => {
    let active = true;
    if (!businessIds.length) {
      setBusinesses({});
      setBusinessesLoading(false);
      return undefined;
    }
    setBusinessesLoading(true);
    Promise.all(businessIds.map(async (id) => [id, await getBusiness(id).catch(() => null)]))
      .then((entries) => {
        if (active) setBusinesses(Object.fromEntries(entries));
      })
      .finally(() => {
        if (active) setBusinessesLoading(false);
      });
    return () => { active = false; };
  }, [businessKey]);

  useEffect(() => {
    let active = true;
    if (!businessIds.length) {
      setAcceptedMethods({});
      setAcceptedMethodsLoading(false);
      return undefined;
    }
    setAcceptedMethodsLoading(true);
    Promise.all(businessIds.map(async (id) => [id, await getAcceptedMethodSummary(id).catch(() => [])]))
      .then((entries) => {
        if (active) setAcceptedMethods(Object.fromEntries(entries));
      })
      .finally(() => {
        if (active) setAcceptedMethodsLoading(false);
      });
    return () => { active = false; };
  }, [businessKey]);

  useEffect(() => {
    setFulfillment((current) => {
      const next = { ...current };
      groups.forEach((group) => {
        const options = getFulfillmentOptions(businesses[group.businessId]);
        if (!options.includes(next[group.key])) next[group.key] = options[0];
      });
      return next;
    });
    setPaymentMethods((current) => {
      const next = { ...current };
      groups.forEach((group) => {
        const acceptedTypes = [...new Set((acceptedMethods[group.businessId] || []).map((method) => method.type))];
        const selected = next[group.key];
        if (group.businessId && !acceptedTypes.length) next[group.key] = '';
        else if (acceptedTypes.length && !acceptedTypes.includes(selected)) next[group.key] = acceptedTypes[0];
        else if (!selected) next[group.key] = acceptedTypes[0] || 'mobile_money';
      });
      return next;
    });
  }, [businesses, groups, acceptedMethods]);

  const updateForm = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const updateGroupChoice = (setter, key) => (event) => {
    const value = event.target.value;
    setter((current) => ({ ...current, [key]: value }));
  };

  const placeAllOrders = async (event) => {
    event.preventDefault();
    if (!user) {
      showToast('Sign in to place your orders. Your cart is saved on this device.', 'info');
      return;
    }
    if (businessesLoading || acceptedMethodsLoading) {
      showToast('Please wait while we load each seller’s checkout options.', 'info');
      return;
    }
    if (!form.name.trim() || !form.phone.trim()) {
      showToast('Enter your name and phone number so sellers can confirm your orders.', 'error');
      return;
    }
    if (groups.some((group) => fulfillment[group.key] === 'delivery') && !form.address.trim()) {
      showToast('Add a delivery address for the sellers offering delivery.', 'error');
      return;
    }
    if (groups.some((group) => group.businessId && !(acceptedMethods[group.businessId] || []).some((method) => method.type))) {
      showToast('Some sellers have not configured an accepted payment method. Contact them before checking out.', 'error');
      return;
    }
    if (groups.some((group) => !paymentMethods[group.key])) {
      showToast('Choose a payment method for each seller.', 'error');
      return;
    }

    setPlacing(true);
    setCompletedOrders([]);
    setCheckoutError('');
    const placed = [];
    let failure = null;
    let activePromotions = [];
    try {
      activePromotions = await getActivePromotions(100).catch(() => []);
      for (const group of groups) {
        const business = businesses[group.businessId] || null;
        const currentProducts = await Promise.all(group.items.map(async (line) => {
          const product = await getProduct(line.productId);
          if (!product || product.status === 'hidden' || product.availability === 'out_of_stock') {
            removeItem(line.productId);
            throw new Error(`${line.name} is no longer available and was removed from your cart.`);
          }
          const promotion = promotionForProduct(product.id, activePromotions);
          const current = applyPromotion(product, promotion);
          const currentCurrency = currencyCode(current.currency || current.businessCurrency || line.currency);
          const sameSeller = (current.businessId || '') === (line.businessId || '')
            && (current.ownerId || '') === (line.ownerId || '');
          if (!sameSeller || currentCurrency !== group.currency) {
            updateProduct(current);
            throw new Error(`${line.name} has moved to a different seller or currency. Review your updated cart before checking out.`);
          }
          const stock = Number(current.stock);
          const trackedStock = current.stock == null || current.stock === ''
            ? null
            : (Number.isFinite(stock) ? stock : null);
          if (trackedStock != null && trackedStock < line.quantity) {
            updateProduct(current);
            throw new Error(`Only ${Math.max(0, trackedStock)} ${line.unit || 'unit'} of ${line.name} remain. Your cart has been updated.`);
          }
          if (Number(current.price) !== Number(line.price)) {
            updateProduct(current);
            throw new Error(`The price of ${line.name} has changed. Review the updated cart before placing your order.`);
          }
          return {
            ...line,
            name: current.name || line.name,
            price: Number(current.price) || 0,
            currency: current.currency || current.businessCurrency || line.currency,
            image: current.image || current.images?.[0] || line.image,
            sku: current.sku || '',
            unit: current.unit || line.unit,
            businessId: current.businessId || line.businessId,
            businessName: current.businessName || line.businessName,
            ownerId: current.ownerId || line.ownerId,
          };
        }));

        const first = currentProducts[0];
        const ownerId = business?.ownerId || group.ownerId || first?.ownerId || '';
        if (!ownerId) throw new Error(`We couldn't identify the seller for ${group.businessName || 'one of your cart groups'}. Please remove those items and try again.`);
        if (ownerId === user.uid) throw new Error('You cannot place an order with your own store. Remove your own listing from the cart to continue.');

        const selectedPaymentMethod = paymentMethods[group.key];
        if (group.businessId) {
          const latestAcceptedMethods = await getAcceptedMethodSummary(group.businessId);
          if (!latestAcceptedMethods.some((payment) => payment.type === selectedPaymentMethod)) {
            throw new Error(`${business?.name || group.businessName || 'This seller'} no longer accepts that payment method. Review the available options and try again.`);
          }
        }

        const method = fulfillment[group.key] || 'pickup';
        const deliveryFee = method === 'delivery' ? Math.max(0, Math.round(Number(business?.deliveryFee) || 0)) : 0;
        const order = await placeOrder({
          buyerId: user.uid,
          buyerName: form.name.trim(),
          buyerPhone: form.phone.trim(),
          businessId: group.businessId || null,
          businessName: business?.name || group.businessName || 'Seedwel seller',
          ownerId,
          items: currentProducts.map((product) => ({
            type: 'product',
            productId: product.productId,
            sku: product.sku,
            name: product.name,
            price: product.price,
            quantity: product.quantity,
            unit: product.unit,
            image: product.image,
          })),
          fulfillmentMethod: method,
          fulfillmentInstructions: method === 'delivery'
            ? business?.deliveryInstructions || ''
            : business?.pickupInstructions || '',
          address: form.address.trim(),
          paymentMethod: selectedPaymentMethod,
          note: form.note.trim(),
          deliveryFee,
          currency: group.currency,
        });
        placed.push({ ...order, sellerName: business?.name || group.businessName || 'Seller' });
      }

      setCompletedOrders(placed);
      placed.forEach((order) => order.items?.forEach((item) => removeItem(item.productId)));
      if (placed.length === groups.length) {
        showToast(`${placed.length} separate seller order${placed.length === 1 ? '' : 's'} placed.`, 'success');
      }
    } catch (error) {
      failure = error;
      setCheckoutError(error.message || 'One or more orders could not be placed.');
      if (placed.length) {
        setCompletedOrders(placed);
        placed.forEach((order) => order.items?.forEach((item) => removeItem(item.productId)));
        showToast(`${placed.length} seller order${placed.length === 1 ? '' : 's'} placed. The remaining cart was kept: ${error.message}`, 'warning');
      } else {
        showToast(error.message || 'Could not place your orders. Please try again.', 'error');
      }
    } finally {
      setPlacing(false);
    }
    if (placed.length && !failure) clearCart();
  };

  const hasDelivery = groups.some((group) => fulfillment[group.key] === 'delivery');
  const staleLoading = (businessesLoading || acceptedMethodsLoading) && groups.length > 0;
  const missingPaymentOptions = groups.some((group) => group.businessId && !(acceptedMethods[group.businessId] || []).length);

  return (
    <div className="container page page--narrow cart-page">
      <div className="page__header">
        <p className="page__eyebrow">Your shopping</p>
        <h1 className="page__title">Shopping cart</h1>
        <p className="page__subtitle">Review everything before you send each seller a separate order.</p>
      </div>

      {completedOrders.length > 0 && (
        <div className="panel cart-success" role="status">
          <h2 className="panel__title">{checkoutError ? 'Some orders were placed' : 'Your orders are in'} 🎉</h2>
          <p className="text-muted">
            {checkoutError ? `${checkoutError} The remaining items stay in your cart.` : 'Each seller has their own order and payment instructions. You can track every order from My Orders.'}
          </p>
          <div className="cart-success__orders">
            {completedOrders.map((order) => (
              <Link key={order.id} to={`/order/${order.id}`} className="cart-success__order">
                <span><strong>{order.sellerName}</strong><small>{order.orderNumber}</small></span>
                <span>{formatCurrency(order.total, order.currency)} →</span>
              </Link>
            ))}
          </div>
          <Link to="/orders" className="btn btn--primary mt-16">View all orders</Link>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          message="When you find something you like, add it to your cart and come back here to check out."
          action={<Link to="/marketplace" className="btn btn--primary">Browse the marketplace</Link>}
        />
      ) : (
        <>
          {!user && (
            <div className="cart-signin panel">
              <div>
                <strong>Ready to check out?</strong>
                <p>Your cart stays on this device. Sign in to place separate orders with each seller.</p>
              </div>
              <div className="flex gap-8 flex-wrap">
                <Link to="/login?redirect=%2Fcart" className="btn btn--primary btn--sm">Log in</Link>
                <Link to="/register?redirect=%2Fcart" className="btn btn--outline btn--sm">Create account</Link>
              </div>
            </div>
          )}

          <div className="cart-summary-line">
            <strong>{count} item{count === 1 ? '' : 's'}</strong>
            <span> · </span>
            <strong>{groups.length} seller order{groups.length === 1 ? '' : 's'}</strong>
            <p>Separate totals, fulfillment options and payment instructions are shown for every seller below.</p>
          </div>

          {staleLoading ? (
            <Spinner size="sm" label="Loading seller checkout options…" />
          ) : (
            <form className="cart-checkout" onSubmit={placeAllOrders}>
              {groups.map((group, groupIndex) => {
                const business = businesses[group.businessId] || null;
                const options = getFulfillmentOptions(business);
                const method = fulfillment[group.key] || options[0];
                const sellerMethods = acceptedMethods[group.businessId] || [];
                const acceptedTypes = [...new Set(sellerMethods.map((payment) => payment.type))];
                const paymentChoices = acceptedTypes.length
                  ? acceptedTypes.map((type) => PAYMENT_METHODS.find((payment) => payment.id === type) || {
                    id: type,
                    label: sellerMethods.find((payment) => payment.type === type)?.label || type,
                  })
                  : (group.businessId ? [] : PAYMENT_METHODS);
                const deliveryFee = method === 'delivery' ? Math.max(0, Math.round(Number(business?.deliveryFee) || 0)) : 0;
                const total = group.subtotal + deliveryFee;
                const sellerName = business?.name || group.businessName || 'Seller';

                return (
                  <section key={group.key} className="panel cart-seller-group">
                    <header className="cart-seller-group__header">
                      <div>
                        <span className="cart-seller-group__eyebrow">Separate order {groupIndex + 1}</span>
                        <h2 className="panel__title">{sellerName}</h2>
                        {(business?.city || business?.location) && (
                          <p className="text-muted">📍 {business.city || business.location}</p>
                        )}
                      </div>
                      <span className="cart-seller-group__currency">{group.currency}</span>
                    </header>

                    <div className="cart-lines">
                      {group.items.map((item) => (
                        <article key={item.productId} className="cart-line">
                          <Link to={`/product/${item.productId}`} className="cart-line__image" aria-label={`View ${item.name}`}>
                            {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span aria-hidden="true">📦</span>}
                          </Link>
                          <div className="cart-line__content">
                            <Link to={`/product/${item.productId}`} className="cart-line__name">{item.name}</Link>
                            <span className="cart-line__price">{formatCurrency(item.price, item.currency)}{item.unit ? ` / ${item.unit}` : ''}</span>
                            <div className="cart-line__controls">
                              <div className="cart-quantity" aria-label={`Quantity of ${item.name}`}>
                                <button type="button" onClick={() => setQuantity(item.productId, item.quantity - 1)} aria-label={`Remove one ${item.name}`}>−</button>
                                <span>{item.quantity}</span>
                                <button
                                  type="button"
                                  onClick={() => setQuantity(item.productId, item.quantity + 1)}
                                  disabled={item.stock != null && item.quantity >= item.stock}
                                  aria-label={`Add one ${item.name}`}
                                >+</button>
                              </div>
                              <button type="button" className="cart-line__remove" onClick={() => removeItem(item.productId)}>Remove</button>
                            </div>
                          </div>
                          <strong className="cart-line__subtotal">{formatCurrency(item.price * item.quantity, item.currency)}</strong>
                        </article>
                      ))}
                    </div>

                    {user && (
                      <div className="cart-seller-checkout">
                        <h3>How will you receive these items?</h3>
                        <div className="form__row">
                          <div className="form__group">
                            <label className="form__label" htmlFor={`fulfillment-${group.key}`}>Fulfillment</label>
                            <select
                              id={`fulfillment-${group.key}`}
                              className="form__select"
                              value={method}
                              onChange={updateGroupChoice(setFulfillment, group.key)}
                            >
                              {options.map((option) => (
                                <option key={option} value={option}>{option === 'delivery' ? 'Delivery' : 'Pickup'}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form__group">
                            <label className="form__label" htmlFor={`payment-${group.key}`}>Payment method</label>
                            <select
                              id={`payment-${group.key}`}
                              className="form__select"
                              value={paymentMethods[group.key] || ''}
                              onChange={updateGroupChoice(setPaymentMethods, group.key)}
                              required
                            >
                              <option value="">
                                {group.businessId && sellerMethods.length === 0 ? 'No accepted methods available' : 'Choose a method'}
                              </option>
                              {paymentChoices.map((payment) => (
                                <option key={payment.id} value={payment.id}>{payment.label}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {method === 'delivery' && business?.deliveryInstructions && (
                          <p className="form__hint">Seller delivery details: {business.deliveryInstructions}</p>
                        )}
                        {method === 'pickup' && business?.pickupInstructions && (
                          <p className="form__hint">Seller pickup details: {business.pickupInstructions}</p>
                        )}
                        {group.businessId && <AcceptedMethods businessId={group.businessId} methods={sellerMethods} />}
                        {group.businessId && sellerMethods.length === 0 && (
                          <p className="form__hint" role="status">This seller has not configured an accepted payment method yet. Contact them before placing an order.</p>
                        )}
                        <dl className="cart-totals">
                          <div><dt>Items</dt><dd>{formatCurrency(group.subtotal, group.currency)}</dd></div>
                          <div><dt>{method === 'delivery' ? 'Delivery fee' : 'Pickup'}</dt><dd>{method === 'delivery' ? formatCurrency(deliveryFee, group.currency) : 'No extra fee'}</dd></div>
                          <div className="cart-totals__grand"><dt>Order total</dt><dd>{formatCurrency(total, group.currency)}</dd></div>
                        </dl>
                      </div>
                    )}
                  </section>
                );
              })}

              {user && (
                <section className="panel cart-contact">
                  <h2 className="panel__title">Contact &amp; delivery details</h2>
                  <p className="text-muted">Your name and phone are shared with each seller so they can confirm the order.</p>
                  <div className="form__row">
                    <div className="form__group">
                      <label className="form__label" htmlFor="cart-buyer-name">Full name</label>
                      <input id="cart-buyer-name" className="form__input" value={form.name} onChange={updateForm('name')} required autoComplete="name" />
                    </div>
                    <div className="form__group">
                      <label className="form__label" htmlFor="cart-buyer-phone">Phone</label>
                      <input id="cart-buyer-phone" className="form__input" type="tel" value={form.phone} onChange={updateForm('phone')} required autoComplete="tel" />
                    </div>
                  </div>
                  <div className="form__group">
                    <label className="form__label" htmlFor="cart-address">{hasDelivery ? 'Delivery address' : 'Address or pickup area (optional)'}</label>
                    <textarea id="cart-address" className="form__textarea" value={form.address} onChange={updateForm('address')} required={hasDelivery} placeholder={hasDelivery ? 'City, town, street or directions' : 'Add an area so the seller can coordinate pickup'} />
                  </div>
                  <div className="form__group">
                    <label className="form__label" htmlFor="cart-note">Order note (optional)</label>
                    <textarea id="cart-note" className="form__textarea" value={form.note} onChange={updateForm('note')} placeholder="Anything the sellers should know" />
                  </div>
                  <div className="cart-checkout__notice">
                    <strong>Before you place these orders</strong>
                    <p>Each seller gets a separate order, payment request and tracking record. Check the seller-by-seller totals above; delivery fees and accepted payment methods can differ.</p>
                  </div>
                  <button type="submit" className="btn btn--primary btn--lg" disabled={placing || staleLoading || missingPaymentOptions}>
                    {placing ? 'Placing orders…' : `Place ${groups.length} seller order${groups.length === 1 ? '' : 's'}`}
                  </button>
                  {placing && <p className="form__hint" role="status">Your orders are being created one seller at a time. Keep this page open until it finishes.</p>}
                </section>
              )}
            </form>
          )}
        </>
      )}
    </div>
  );
}
