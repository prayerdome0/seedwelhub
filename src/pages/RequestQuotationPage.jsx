import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Button from '../components/Button';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { requestQuotation } from '../services/quotationService';
import { getProduct } from '../services/productService';
import { getService } from '../services/serviceService';
import { getBusiness } from '../services/businessService';

// ---------------------------------------------------------------------------
// Buyer-facing "Request Quotation" form.
//
// Reached from a product/service page (?productId= / ?serviceId=) or from a
// business page (?businessId=). Collects the structured brief the seller needs
// to price the job, rather than a single free-text box.
// ---------------------------------------------------------------------------
export default function RequestQuotationPage() {
  const [searchParams] = useSearchParams();
  const productId = searchParams.get('productId');
  const serviceId = searchParams.get('serviceId');
  const businessIdParam = searchParams.get('businessId');

  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const subject = useAsync(() => {
    if (productId) return getProduct(productId);
    if (serviceId) return getService(serviceId);
    return Promise.resolve(null);
  }, [productId, serviceId]);

  const businessId = subject.data?.businessId || businessIdParam;
  const business = useAsync(
    () => (businessId ? getBusiness(businessId) : Promise.resolve(null)),
    [businessId]
  );

  const [form, setForm] = useState({
    productService: '',
    quantity: '1',
    requirements: '',
    message: '',
    preferredDelivery: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const setField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
    setError('');
  };

  if (!user) {
    return (
      <div className="container page">
        <EmptyState
          title="Sign in to request a quotation"
          message="Log in so the seller can respond to your request."
          action={<Link to="/login" className="btn btn--primary">Log In</Link>}
        />
      </div>
    );
  }

  if (subject.loading || business.loading) {
    return <div className="container page"><Spinner size="large" /></div>;
  }

  const item = subject.data;
  const defaultName = item?.name || '';
  const ownerId = item?.ownerId || business.data?.ownerId;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const productService = form.productService || defaultName;

    if (!productService.trim()) {
      setError('Tell the seller what you need a quotation for.');
      return;
    }
    if (!ownerId) {
      setError('This seller cannot receive quotation requests yet.');
      return;
    }

    setSubmitting(true);
    try {
      const quotation = await requestQuotation({
        businessId: businessId || null,
        businessName: business.data?.name || item?.businessName || 'Seller',
        ownerId,
        customerId: user.uid,
        customerName: profile?.name || user.email,
        customerEmail: user.email,
        customerPhone: profile?.phone || '',
        productService: productService.trim(),
        quantity: form.quantity,
        requirements: form.requirements,
        message: form.message,
        preferredDelivery: form.preferredDelivery,
        productId: productId || null,
        serviceId: serviceId || null,
        currency: item?.currency || business.data?.currency,
      });
      showToast('Quotation request sent to the seller.', 'success');
      navigate(`/quotation/${quotation.id}`);
    } catch (err) {
      setError(err.message || 'Could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const backTo = productId
    ? `/product/${productId}`
    : serviceId
      ? `/service/${serviceId}`
      : businessId
        ? `/business/${businessId}`
        : '/marketplace';

  return (
    <div className="container page page--narrow">
      <div className="mt-8 mb-16">
        <Link to={backTo} className="section__link">← Back</Link>
      </div>

      <div className="page__header">
        <h1 className="page__title">Request a Quotation</h1>
        <p className="page__subtitle">
          {business.data?.name
            ? `Tell ${business.data.name} what you need and they'll send you a priced quotation.`
            : 'Tell the seller what you need and they\'ll send you a priced quotation.'}
        </p>
      </div>

      <div className="panel">
        <form className="form" onSubmit={handleSubmit}>
          <div className="form__group">
            <label className="form__label" htmlFor="rq-item">Product / service *</label>
            <input
              id="rq-item"
              className="form__input"
              value={form.productService || defaultName}
              onChange={setField('productService')}
              placeholder="What do you need?"
              required
            />
          </div>

          <div className="form__row">
            <div className="form__group">
              <label className="form__label" htmlFor="rq-qty">Quantity *</label>
              <input
                id="rq-qty"
                className="form__input"
                type="number"
                min="1"
                value={form.quantity}
                onChange={setField('quantity')}
                required
              />
            </div>
            <div className="form__group">
              <label className="form__label" htmlFor="rq-delivery">Preferred delivery</label>
              <input
                id="rq-delivery"
                className="form__input"
                value={form.preferredDelivery}
                onChange={setField('preferredDelivery')}
                placeholder="e.g. within 2 weeks, delivered to Lusaka"
              />
            </div>
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="rq-req">Requirements</label>
            <textarea
              id="rq-req"
              className="form__textarea"
              value={form.requirements}
              onChange={setField('requirements')}
              placeholder="Specifications, sizes, colours, materials, deadlines…"
            />
          </div>

          <div className="form__group">
            <label className="form__label" htmlFor="rq-msg">Additional message</label>
            <textarea
              id="rq-msg"
              className="form__textarea"
              value={form.message}
              onChange={setField('message')}
              placeholder="Anything else the seller should know"
            />
          </div>

          {error && <div className="form__msg form__msg--error">{error}</div>}

          <div className="mt-16">
            <Button type="submit" variant="primary" loading={submitting}>
              Send Quotation Request
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
