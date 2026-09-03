import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Image from '../components/Image';
import StarRating from '../components/StarRating';
import Badge from '../components/Badge';
import Button from '../components/Button';
import CheckoutForm from '../components/CheckoutForm';
import { NotFoundState, ErrorState, LoadingState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import useStartConversation from '../hooks/useStartConversation';
import { getService } from '../services/serviceService';
import { placeOrder } from '../services/orderService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { formatCurrency } from '../utils/format';

export default function ServiceDetailPage() {
  const { id } = useParams();
  const { data: service, loading, error, notFound, retry } = useDocument(getService, id, []);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [placing, setPlacing] = useState(false);
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const { start: startConversation, starting: startingConversation } = useStartConversation();
  const navigate = useNavigate();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Service not found" message="This service does not exist or may have been removed." />
      </div>
    );
  }

  const location = [service.city, service.region, service.country].filter(Boolean).join(', ');
  const rate = service.rate ?? service.price;

  const handleRequest = () => {
    if (!user) {
      showToast('Please log in to request this service.', 'info');
      return;
    }
    setCheckoutOpen((open) => !open);
  };

  const handleSubmitRequest = async ({ name, phone, address, paymentMethod, note }) => {
    setPlacing(true);
    try {
      const order = await placeOrder({
        buyerId: user.uid,
        buyerName: name,
        buyerPhone: phone,
        businessId: service.businessId || null,
        businessName: service.businessName || service.providerName || 'Provider',
        ownerId: service.ownerId,
        items: [
          {
            type: 'service',
            serviceId: service.id,
            name: service.name,
            price: rate ?? 0,
            quantity: 1,
            unit: service.rateUnit,
            image: service.image || '',
          },
        ],
        address,
        paymentMethod,
        note,
        currency: service.currency || service.businessCurrency,
      });
      showToast(`Service request ${order.orderNumber} received.`, 'success');
      navigate(`/order/${order.id}`);
    } catch (err) {
      showToast(err.message || 'Could not send the service request. Please try again.', 'error');
    } finally {
      setPlacing(false);
    }
  };

  const handleMessageProvider = () => {
    startConversation(service.ownerId, {
      otherName: service.businessName || service.providerName || 'Provider',
      otherPhoto: service.image || '',
    });
  };

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/services" className="section__link">← Back to Services</Link>
      </div>

      <div className="detail-layout">
        <div className="detail-main">
          {service.image && (
            <div className="panel">
              <Image src={service.image} alt={service.name} className="w-full" />
            </div>
          )}

          <div className="panel">
            <h2 className="panel__title">About this service</h2>
            <p>{service.description || 'No description provided.'}</p>
          </div>

          <div className="panel">
            <h2 className="panel__title">Provider</h2>
            <div className="flex items-center gap-8">
              <span className="avatar avatar--md">{service.businessName?.[0] || 'P'}</span>
              <div>
                <div className="font-700">{service.businessName || (service.providerName && 'Provider') || 'Provider'}</div>
                {service.businessId && (
                  <Link to={`/business/${service.businessId}`} className="section__link">View business</Link>
                )}
              </div>
            </div>
          </div>
        </div>

        <aside className="detail-aside">
          <div className="panel">
            <h1 className="detail-heading__title">{service.name || 'Unnamed service'}</h1>
            {service.category && <Badge tone="info">{service.category}</Badge>}
            {location && <p className="text-muted mt-8">📍 {location}</p>}

            <div className="buy-box mt-16">
              {rate !== undefined && rate !== null && (
                <div className="buy-box__price">
                  {formatCurrency(rate, service.currency)}
                  {service.rateUnit && <span className="service-card__unit"> / {service.rateUnit}</span>}
                </div>
              )}
              {service.availability && (
                <div className="mt-8">
                  <Badge tone={service.availability === 'available' ? 'success' : 'neutral'}>{service.availability}</Badge>
                </div>
              )}
              {service.rating !== undefined && (
                <div className="mt-8"><StarRating rating={service.rating} count={service.reviewCount} /></div>
              )}
              <div className="mt-16">
                <Button variant="primary" className="btn--block" onClick={handleRequest}>Request Service</Button>
                {checkoutOpen && (
                  <CheckoutForm
                    buyer={profile}
                    summary={service.name}
                    total={rate ?? 0}
                    currency={service.currency}
                    submitting={placing}
                    submitLabel="Send Service Request"
                    onCancel={() => setCheckoutOpen(false)}
                    onSubmit={handleSubmitRequest}
                  />
                )}
              </div>

              {service.ownerId && (
                <div className="mt-8">
                  <Button
                    variant="outline"
                    className="btn--block"
                    loading={startingConversation}
                    onClick={handleMessageProvider}
                  >
                    💬 Message provider
                  </Button>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
