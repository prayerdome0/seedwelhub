import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ShareTools from '../../components/ShareTools';
import { useToast } from '../../contexts/ToastContext';
import { serverTimestamp } from '../../firebase/firestore';
import useAsync from '../../hooks/useAsync';
import { getSellerPaymentMethods } from '../../services/sellerPaymentService';
import { updateBusiness } from '../../services/businessService';

function ChecklistStep({ complete, title, detail, action }) {
  return (
    <li className={`first-sale-step ${complete ? 'is-complete' : ''}`}>
      <span className="first-sale-step__check" aria-hidden="true">{complete ? '✓' : '○'}</span>
      <div className="first-sale-step__copy">
        <strong>{title}</strong>
        {detail && <small>{detail}</small>}
      </div>
      {action && <div className="first-sale-step__action">{action}</div>}
    </li>
  );
}

export default function SellerFirstSaleChecklist({ business, productCount = 0, orderCount = 0, ordersLoading = false }) {
  const { showToast } = useToast();
  const [storeShared, setStoreShared] = useState(Boolean(business?.storeSharedAt));
  const paymentMethods = useAsync(
    () => (business?.id ? getSellerPaymentMethods(business.id) : Promise.resolve([])),
    [business?.id]
  );

  useEffect(() => setStoreShared(Boolean(business?.storeSharedAt)), [business?.id, business?.storeSharedAt]);

  if (!business) return null;

  const hasContact = Boolean(business.phone || business.email || business.whatsapp);
  const hasLocation = Boolean(business.city || business.address || business.location);
  const profileComplete = Boolean(business.name && business.category && business.description && hasContact && hasLocation);
  const hasPayment = (paymentMethods.data || []).some((method) => method.isActive !== false);
  const hasFulfillment = Array.isArray(business.fulfillmentOptions) && business.fulfillmentOptions.length > 0;
  const hasFirstOrder = orderCount > 0;
  const steps = [profileComplete, productCount > 0, hasPayment, hasFulfillment, storeShared, hasFirstOrder];
  const completedCount = steps.filter(Boolean).length;

  const markStoreShared = async () => {
    if (storeShared) return;
    try {
      await updateBusiness(business.id, { storeSharedAt: serverTimestamp() });
      setStoreShared(true);
      showToast('Store share marked complete. Keep the link in your WhatsApp status or social bio.', 'success');
    } catch {
      showToast('Your link was shared, but we could not save the checklist update.', 'warning');
    }
  };

  return (
    <section className={`panel first-sale-checklist ${hasFirstOrder ? 'first-sale-checklist--complete' : ''}`}>
      <div className="first-sale-checklist__header">
        <div>
          <p className="page__eyebrow">Seller launch plan</p>
          <h2 className="panel__title">{hasFirstOrder ? 'Your first order is here!' : 'Your path to a first sale'}</h2>
          <p className="text-muted">
            {hasFirstOrder
              ? 'Great start. Keep your listings, payment options and fulfillment details up to date.'
              : 'Finish these practical setup steps so buyers can discover your store and place an order.'}
          </p>
        </div>
        <div className="first-sale-progress" aria-label={`${completedCount} of ${steps.length} steps complete`}>
          <strong>{completedCount}/{steps.length}</strong>
          <span>steps done</span>
        </div>
      </div>

      <ol className="first-sale-steps">
        <ChecklistStep
          complete={profileComplete}
          title="Complete your business profile"
          detail="Name, category, contact and location help buyers trust the store."
          action={!profileComplete && <Link to="/sell" className="btn btn--outline btn--sm">Finish profile</Link>}
        />
        <ChecklistStep
          complete={productCount > 0}
          title="Publish your first product"
          detail={productCount ? `${productCount} listing${productCount === 1 ? '' : 's'} live` : 'A clear photo and price make it easy to buy.'}
          action={productCount === 0 && <Link to="/seller?tab=products" className="btn btn--outline btn--sm">Add product</Link>}
        />
        <ChecklistStep
          complete={hasPayment}
          title="Add a payment method"
          detail={paymentMethods.loading ? 'Checking your payment setup…' : 'Your details are only shown to a buyer after an order.'}
          action={!hasPayment && <Link to="/seller?tab=payment-settings" className="btn btn--outline btn--sm">Set up payments</Link>}
        />
        <ChecklistStep
          complete={hasFulfillment}
          title="Choose delivery or pickup"
          detail="Buyers see the fee and options before placing an order."
          action={!hasFulfillment && <Link to="/seller?tab=channels" className="btn btn--outline btn--sm">Set fulfillment</Link>}
        />
        <ChecklistStep
          complete={storeShared}
          title="Share your storefront"
          detail="Send your shop link to customers and on social media."
          action={!storeShared && (
            <ShareTools
              url={`/share/business/${business.id}`}
              title={`${business.name} store`}
              description={business.description || `Visit ${business.name} on Seedwel Hub.`}
              onShared={markStoreShared}
              compact
            />
          )}
        />
        <ChecklistStep
          complete={hasFirstOrder}
          title="Receive your first order"
          detail={ordersLoading ? 'Checking your orders…' : hasFirstOrder ? `${orderCount} order${orderCount === 1 ? '' : 's'} received` : 'Your new orders will appear in the seller dashboard.'}
          action={!hasFirstOrder && <Link to={`/store/${business.id}`} className="btn btn--outline btn--sm">Preview store</Link>}
        />
      </ol>
    </section>
  );
}
