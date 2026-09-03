import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Image from '../components/Image';
import Badge from '../components/Badge';
import StarRating from '../components/StarRating';
import Spinner from '../components/Spinner';
import ProductCard from '../components/ProductCard';
import ServiceCard from '../components/ServiceCard';
import { NotFoundState, ErrorState, LoadingState, EmptyState } from '../components/PageState';
import useDocument from '../hooks/useDocument';
import useAsync from '../hooks/useAsync';
import { getBusiness } from '../services/businessService';
import { getProductsByBusiness } from '../services/productService';
import { getServicesByBusiness } from '../services/serviceService';
import { getReviewsForBusiness } from '../services/reviewService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

export default function BusinessDetailPage() {
  const { id } = useParams();
  const { data: business, loading, error, notFound, retry } = useDocument(getBusiness, id, []);
  const products = useAsync(() => getProductsByBusiness(id), [id]);
  const services = useAsync(() => getServicesByBusiness(id), [id]);
  const reviews = useAsync(() => getReviewsForBusiness(id), [id]);
  const [tab, setTab] = useState('products');
  const { user } = useAuth();
  const { showToast } = useToast();

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={retry} />;
  if (notFound) {
    return (
      <div className="container page">
        <NotFoundState title="Business not found" message="This business does not exist or may have been removed." />
      </div>
    );
  }

  const location = [business.city, business.region, business.country].filter(Boolean).join(', ');
  const contact = () => {
    if (!user) {
      showToast('Please log in to contact this business.', 'info');
      return;
    }
    showToast('Messaging is being set up. In the meantime, use the contact details below.', 'info');
  };

  return (
    <div className="container page">
      <div className="mt-8 mb-16">
        <Link to="/businesses" className="section__link">← Back to Businesses</Link>
      </div>

      {/* Profile hero */}
      <div className="profile-hero">
        <div className="profile-hero__inner">
          {business.logo ? (
            <Image src={business.logo} alt={business.name} className="avatar avatar--xl" />
          ) : (
            <div className="avatar avatar--xl avatar--text">{business.name?.[0] || 'B'}</div>
          )}
          <div>
            <h1 className="profile-hero__name">{business.name || 'Unnamed business'}</h1>
            <div className="flex items-center gap-8 flex-wrap">
              {business.category && <Badge tone="info">{business.category}</Badge>}
              {business.isVerified && <Badge tone="success">✓ Verified</Badge>}
              {location && <span className="profile-hero__meta">📍 {location}</span>}
            </div>
            <div className="mt-8">
              <StarRating rating={business.rating} count={business.reviewCount} />
            </div>
          </div>
          <div className="profile-hero__actions">
            <button type="button" className="btn btn--outline" onClick={contact}>Contact</button>
          </div>
        </div>
      </div>

      {/* Description */}
      {business.description && (
        <div className="panel mt-16">
          <h2 className="panel__title">About</h2>
          <p>{business.description}</p>
        </div>
      )}

      {/* Contact details */}
      <div className="panel mt-16">
        <h2 className="panel__title">Contact &amp; Details</h2>
        <dl className="kv">
          {business.phone && (<><dt>Phone</dt><dd>{business.phone}</dd></>)}
          {business.email && (<><dt>Email</dt><dd>{business.email}</dd></>)}
          {business.website && (<><dt>Website</dt><dd><a href={business.website} target="_blank" rel="noreferrer">{business.website}</a></dd></>)}
          {business.whatsapp && (<><dt>WhatsApp</dt><dd>{business.whatsapp}</dd></>)}
          {business.address && (<><dt>Address</dt><dd>{business.address}</dd></>)}
          {business.registrationNumber && (<><dt>Reg. No.</dt><dd>{business.registrationNumber}</dd></>)}
          {business.category && (<><dt>Category</dt><dd>{business.category}</dd></>)}
        </dl>
      </div>

      {/* Tabs: products / services / reviews */}
      <div className="tabs mt-16">
        <button type="button" className={`tabs__tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>
          Products
        </button>
        <button type="button" className={`tabs__tab ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}>
          Services
        </button>
        <button type="button" className={`tabs__tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>
          Reviews {reviews.data ? `(${reviews.data.length})` : ''}
        </button>
      </div>

      {tab === 'products' && (
        <>
          {products.loading && <Spinner size="sm" />}
          {products.error && <ErrorState message={products.error} onRetry={products.retry} />}
          {!products.loading && !products.error && products.data?.length === 0 && (
            <EmptyState title="No products yet" message="This business hasn't listed any products." />
          )}
          {!products.loading && !products.error && products.data?.length > 0 && (
            <div className="grid grid--products">
              {products.data.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </>
      )}

      {tab === 'services' && (
        <>
          {services.loading && <Spinner size="sm" />}
          {services.error && <ErrorState message={services.error} onRetry={services.retry} />}
          {!services.loading && !services.error && services.data?.length === 0 && (
            <EmptyState title="No services yet" message="This business hasn't listed any services." />
          )}
          {!services.loading && !services.error && services.data?.length > 0 && (
            <div className="grid grid--services">
              {services.data.map((s) => <ServiceCard key={s.id} service={s} />)}
            </div>
          )}
        </>
      )}

      {tab === 'reviews' && (
        <>
          {reviews.loading && <Spinner size="sm" />}
          {!reviews.loading && !reviews.data?.length && <EmptyState title="No reviews yet" />}
          {!reviews.loading && reviews.data?.length > 0 && (
            <div className="panel">
              {reviews.data.map((r) => (
                <div key={r.id} style={{ borderBottom: '1px solid var(--border)', padding: '14px 0' }}>
                  <div className="flex items-center gap-8">
                    <strong>{r.authorName || 'Customer'}</strong>
                    <StarRating rating={r.rating} />
                  </div>
                  <p className="text-muted">{r.comment}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
