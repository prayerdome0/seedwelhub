import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import Image from '../components/Image';
import ShareTools from '../components/ShareTools';
import Spinner from '../components/Spinner';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getBusiness } from '../services/businessService';
import { getProduct } from '../services/productService';
import { formatCurrency } from '../utils/format';

function setMeta(selector, attribute, value) {
  let element = document.head.querySelector(selector);
  const created = !element;
  if (!element) {
    element = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
    if (selector.includes('property=')) element.setAttribute('property', selector.match(/property="([^"]+)/)?.[1] || '');
    else if (selector.includes('name=')) element.setAttribute('name', selector.match(/name="([^"]+)/)?.[1] || '');
    else if (selector.includes('rel=')) element.setAttribute('rel', selector.match(/rel="([^"]+)/)?.[1] || '');
    document.head.appendChild(element);
  }
  const previous = element.getAttribute(attribute);
  element.setAttribute(attribute, value);
  return () => {
    if (created) element.remove();
    else if (previous == null) element.removeAttribute(attribute);
    else element.setAttribute(attribute, previous);
  };
}

function useShareMetadata({ title, description, image, url }) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const cleanups = [
      setMeta('meta[name="description"]', 'content', description),
      setMeta('meta[property="og:title"]', 'content', title),
      setMeta('meta[property="og:description"]', 'content', description),
      setMeta('meta[property="og:type"]', 'content', 'website'),
      setMeta('meta[property="og:url"]', 'content', url),
      setMeta('meta[property="og:image"]', 'content', image || ''),
      setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image'),
      setMeta('meta[name="twitter:title"]', 'content', title),
      setMeta('meta[name="twitter:description"]', 'content', description),
      setMeta('meta[name="twitter:image"]', 'content', image || ''),
      setMeta('link[rel="canonical"]', 'href', url),
    ];
    return () => {
      document.title = previousTitle;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [title, description, image, url]);
}

export default function ShareLandingPage() {
  const { type, id } = useParams();
  const isProduct = type === 'product';
  const validType = isProduct || type === 'business';
  const page = useAsync(
    () => (validType ? (isProduct ? getProduct(id) : getBusiness(id)) : Promise.resolve(null)),
    [type, id]
  );
  const entity = page.data;
  const titleText = entity?.name || (isProduct ? 'Product listing' : 'Business');
  const description = entity?.description || `Discover ${titleText} on Seedwel Hub.`;
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/share/${type}/${id}` : `/share/${type}/${id}`;
  const targetUrl = `/${isProduct ? 'product' : 'store'}/${id}`;
  const imageUrl = isProduct
    ? (entity?.image || entity?.images?.[0] || '/seedwel-og.png')
    : (entity?.logo || entity?.image || '/seedwel-og.png');

  useShareMetadata({
    title: `${titleText} | Seedwel Hub`,
    description,
    image: imageUrl,
    url: shareUrl,
  });

  if (!validType) return <div className="container page"><EmptyState title="Share page not found" /></div>;
  if (page.loading) return <div className="container page"><Spinner size="large" label="Loading shared page…" /></div>;
  if (page.error) return <div className="container page"><ErrorState message={page.error} onRetry={page.retry} /></div>;
  if (!entity) return <div className="container page"><EmptyState title="This listing is no longer available" message="It may have been removed or its link may be out of date." action={<Link to="/marketplace" className="btn btn--primary">Browse Marketplace</Link>} /></div>;

  const seller = entity.businessName || entity.sellerName;
  const location = entity.city || entity.location || entity.address;

  return (
    <div className="container page page--narrow share-landing">
      <div className="page__header">
        <p className="page__eyebrow">Shared from Seedwel Hub</p>
        <h1 className="page__title">{titleText}</h1>
        <p className="page__subtitle">{isProduct ? 'Product listing' : 'Business storefront'}{location ? ` · ${location}` : ''}</p>
      </div>

      <article className="panel share-landing__card">
        {imageUrl && <Image src={imageUrl} alt={titleText} className="share-landing__image" />}
        <div className="share-landing__body">
          <div className="share-landing__eyebrow">{isProduct ? entity.category || 'Marketplace product' : entity.category || 'Local business'}</div>
          <h2>{titleText}</h2>
          {seller && <p className="share-landing__seller">Sold by {seller}</p>}
          <p>{description}</p>
          {isProduct && entity.price != null && (
            <p className="share-landing__price">{formatCurrency(entity.price, entity.currency || entity.businessCurrency)}</p>
          )}
          <div className="flex gap-8 flex-wrap mt-16">
            <Link to={targetUrl} className="btn btn--primary">{isProduct ? 'View product' : 'Visit store'}</Link>
            {!isProduct && <Link to="/businesses" className="btn btn--outline">Browse businesses</Link>}
          </div>
        </div>
      </article>

      <section className="panel share-landing__sharing">
        <h2 className="panel__title">Share this {isProduct ? 'listing' : 'store'}</h2>
        <p className="text-muted">Send the link to a customer or scan/download its QR code for a poster, counter or flyer.</p>
        <ShareTools url={shareUrl} title={titleText} description={description} showQr />
      </section>
    </div>
  );
}
