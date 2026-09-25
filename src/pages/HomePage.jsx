import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import LocationBar from '../components/LocationBar';
import ProductCard from '../components/ProductCard';
import BusinessCard from '../components/BusinessCard';
import ServiceCard from '../components/ServiceCard';
import Spinner from '../components/Spinner';
import BannerCarousel from '../components/BannerCarousel';
import DealSection from '../components/DealSection';
import PromoCountdown from '../components/PromoCountdown';
import LogoMarquee from '../components/LogoMarquee';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getLatestProducts } from '../services/productService';
import {
  getActivePromotions,
  getActiveBanners,
  decorateProductsWithPromotions,
} from '../services/promotionService';
import { getFeaturedBusinesses } from '../services/businessService';
import { getLatestServices } from '../services/serviceService';
import { BUSINESS_CATEGORIES } from '../utils/constants';
import { useMarketLocation } from '../contexts/LocationContext';
import { useAuth } from '../contexts/AuthContext';
import { getMarketplaceStats } from '../services/marketplaceStatsService';

function homepageCtaFor({ user, isSeller, isVerifiedSeller, isLoading }) {
  if (isLoading) {
    return {
      eyebrow: 'Welcome to Seedwel Hub',
      title: 'Find your next opportunity.',
      body: 'Explore trusted products, local businesses and services while we prepare your account experience.',
      primaryLabel: 'Explore marketplace',
      primaryTo: '/marketplace',
      secondaryLabel: 'Browse services',
      secondaryTo: '/services',
    };
  }

  if (!user) {
    return {
      eyebrow: 'Buy · Sell · Grow',
      title: 'Good trade starts with good connections.',
      body: 'Discover trusted listings, or create your free account to open a store and reach new customers.',
      primaryLabel: 'Create an account',
      primaryTo: '/register',
      secondaryLabel: 'Explore marketplace',
      secondaryTo: '/marketplace',
    };
  }

  if (isSeller && isVerifiedSeller) {
    return {
      eyebrow: 'Your business, in one hub',
      title: 'Keep your business moving.',
      body: 'Manage products, orders, promotions and customer conversations from one workspace.',
      primaryLabel: 'Open seller dashboard',
      primaryTo: '/seller',
      secondaryLabel: 'Browse marketplace',
      secondaryTo: '/marketplace',
    };
  }

  if (isSeller) {
    return {
      eyebrow: 'One account. Both sides of trade.',
      title: 'Your store is nearly ready.',
      body: 'Complete your business setup and verification to unlock your seller dashboard.',
      primaryLabel: 'Complete seller setup',
      primaryTo: '/sell',
      secondaryLabel: 'Explore marketplace',
      secondaryTo: '/marketplace',
    };
  }

  return {
    eyebrow: 'One account. Both sides of trade.',
    title: 'Turn your next idea into a business.',
    body: 'Use your existing Seedwel account to open a store, list products and grow your customer base.',
    primaryLabel: 'Start selling',
    primaryTo: '/sell',
    secondaryLabel: 'Keep exploring',
    secondaryTo: '/marketplace',
  };
}

export default function HomePage() {
  // Products are decorated with their live promotion in one extra read, so
  // every section below shows promotional pricing without fetching per card.
  const products = useAsync(
    () => getLatestProducts(48).then(decorateProductsWithPromotions),
    []
  );
  const promotions = useAsync(() => getActivePromotions(24), []);
  const banners = useAsync(() => getActiveBanners(4), []);
  const featuredBusinesses = useAsync(() => getFeaturedBusinesses(6), []);
  const services = useAsync(() => getLatestServices(8), []);
  const marketplaceStats = useAsync(getMarketplaceStats, []);
  const { label: locationLabel } = useMarketLocation();
  const {
    user,
    loading: authLoading,
    businessesLoading,
    isSeller,
    isVerifiedSeller,
  } = useAuth();

  const all = products.data || [];

  // Every homepage row is derived from the same decorated list — one read,
  // many merchandising angles.
  const sections = useMemo(() => {
    const discounted = all.filter((p) => p.promotion);
    const byDiscount = [...discounted].sort(
      (a, b) => (b.discountPercent || 0) - (a.discountPercent || 0)
    );

    // "Flash deals" are the ones ending within 24 hours — genuine urgency,
    // not a decorative label.
    const DAY_MS = 24 * 60 * 60 * 1000;
    const flash = discounted
      .filter((p) => p.promotion.endsInMs > 0 && p.promotion.endsInMs <= DAY_MS)
      .sort((a, b) => a.promotion.endsInMs - b.promotion.endsInMs);

    const tenPlus = byDiscount.filter((p) => (p.discountPercent || 0) >= 10);

    // "Near you" matches the shopper's coarse place against the product's
    // stated location — no coordinates involved.
    const place = (locationLabel || '').toLowerCase();
    const near = place
      ? all.filter((p) => {
          const loc = String(p.location || '').toLowerCase();
          if (!loc) return false;
          return place.split(/[,\s]+/).filter((t) => t.length > 3).some((token) => loc.includes(token));
        })
      : [];

    return {
      best: byDiscount.slice(0, 10),
      tenPlus: tenPlus.slice(0, 10),
      flash: flash.slice(0, 10),
      near: near.slice(0, 10),
      newest: all.slice(0, 10),
    };
  }, [all, locationLabel]);

  const livePromotions = promotions.data || [];
  const accountLoading = authLoading || (Boolean(user) && businessesLoading);
  const homepageCta = homepageCtaFor({
    user,
    isSeller,
    isVerifiedSeller,
    isLoading: accountLoading,
  });

  const statValue = (key) => {
    if (marketplaceStats.loading) return '…';
    if (marketplaceStats.error || !Number.isFinite(marketplaceStats.data?.[key])) return '—';
    return new Intl.NumberFormat().format(marketplaceStats.data[key]);
  };

  return (
    <div>
      {/* Hero — five auto-scrolling professional banners + search + stats */}
      <section className="hero">
        <div className="container">
          <div className="hero__mobile-discovery">
            <SearchBar variant="large" placeholder="Search products, businesses, services…" />
            <LocationBar noun="products" className="hero__location" />
            <div className="hero__mobile-category-block">
              <div className="hero__mobile-category-heading">Browse categories</div>
              <div className="hero__mobile-categories">
                <Link to="/marketplace" className="chip">All</Link>
                {BUSINESS_CATEGORIES.slice(0, 8).map((category) => (
                  <Link key={category} to={`/search?category=${encodeURIComponent(category)}`} className="chip">
                    {category}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <BannerCarousel promoBanners={banners.data || []} />

          <div className="hero__features">
            <div className="hero__feature">
              <span className="hero__feature-icon" aria-hidden="true">✓</span>
              <span className="hero__feature-text">
                <span className="hero__feature-title">Trusted</span>
                <span className="hero__feature-desc">Secure &amp; reliable platform</span>
              </span>
            </div>
            <div className="hero__feature">
              <span className="hero__feature-icon" aria-hidden="true">✓</span>
              <span className="hero__feature-text">
                <span className="hero__feature-title">Connected</span>
                <span className="hero__feature-desc">Buyers, sellers &amp; service providers</span>
              </span>
            </div>
            <div className="hero__feature">
              <span className="hero__feature-icon" aria-hidden="true">✓</span>
              <span className="hero__feature-text">
                <span className="hero__feature-title">Grow</span>
                <span className="hero__feature-desc">Expand your business</span>
              </span>
            </div>
            <div className="hero__feature">
              <span className="hero__feature-icon" aria-hidden="true">✓</span>
              <span className="hero__feature-text">
                <span className="hero__feature-title">Support</span>
                <span className="hero__feature-desc">We're here to help you succeed</span>
              </span>
            </div>
          </div>

          <div className="hero__search">
            <SearchBar variant="large" placeholder="Search products, businesses, services…" />
          </div>
          <div className="hero__stats">
            <div className="hero__stat">
              <div className="hero__stat-value" aria-live="polite" aria-busy={marketplaceStats.loading}>
                {statValue('products')}
              </div>
              <div className="hero__stat-label">Products</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value" aria-live="polite" aria-busy={marketplaceStats.loading}>
                {statValue('businesses')}
              </div>
              <div className="hero__stat-label">Businesses</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value" aria-live="polite" aria-busy={marketplaceStats.loading}>
                {statValue('services')}
              </div>
              <div className="hero__stat-label">Services</div>
            </div>
          </div>
        </div>
      </section>

      {/* Auto-scrolling logo marquee */}
      <LogoMarquee />

      <div className="container page">
        {/* Categories */}
        <section className="section home-desktop-categories">
          <div className="section__header">
            <h2 className="section__title">Browse by category</h2>
            <Link to="/marketplace" className="section__link">View Marketplace →</Link>
          </div>
          <div className="chip-row">
            {BUSINESS_CATEGORIES.map((cat) => (
              <Link key={cat} to={`/search?category=${encodeURIComponent(cat)}`} className="chip">
                {cat}
              </Link>
            ))}
          </div>
        </section>

        {/* ---- Promotional merchandising rows ---------------------------
             Each row renders only when it actually has products, so the page
             never shows an empty heading. ---------------------------------- */}
        <DealSection
          icon="🔥"
          title="Best Deals"
          subtitle="The biggest savings on Seedwel Hub right now"
          products={sections.best}
          loading={products.loading}
          className="home-product-rail"
        />

        <DealSection
          icon="⚡"
          title="Flash Deals"
          subtitle="Ending within 24 hours — grab them before the timer runs out"
          products={sections.flash}
          loading={products.loading}
          className="home-secondary-section"
        />

        <DealSection
          icon="🏷️"
          title="Discounts from 10% Off"
          subtitle="Every product with at least 10% off its usual price"
          products={sections.tenPlus}
          loading={products.loading}
          className="home-secondary-section"
        />

        {/* Seller promotions — the campaigns themselves, not the products */}
        {livePromotions.length > 0 && (
          <section className="section home-secondary-section">
            <div className="deal-section__header">
              <div>
                <h2 className="deal-section__title">
                  <span className="deal-section__title-icon" aria-hidden="true">📢</span>
                  Seller Promotions
                </h2>
                <p className="deal-section__sub">Live campaigns from Seedwel Hub sellers</p>
              </div>
              <Link to="/deals" className="section__link">See all →</Link>
            </div>
            <div className="grid grid--cards">
              {livePromotions.slice(0, 6).map((promo) => (
                <Link key={promo.id} to="/deals" className="promo-card">
                  {promo.image && (
                    <div className="promo-card__media">
                      <img src={promo.image} alt="" loading="lazy" decoding="async" />
                      <span className="promo-card__flag">−{promo.discountPercent}%</span>
                    </div>
                  )}
                  <div className="promo-card__body">
                    <h3 className="promo-card__title">{promo.title}</h3>
                    {promo.businessName && (
                      <div className="promo-card__seller">{promo.businessName}</div>
                    )}
                    {promo.description && (
                      <p className="promo-card__desc">{promo.description}</p>
                    )}
                    <PromoCountdown endsAt={promo.endAt} />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <DealSection
          icon="📍"
          title={locationLabel ? `Deals Near You — ${locationLabel}` : 'Deals Near You'}
          subtitle="Products listed close to your chosen location"
          products={sections.near}
          loading={products.loading}
          to="/marketplace"
          className="home-secondary-section"
        />

        {/* New arrivals — always shown, it is the page's baseline listing */}
        <section className="section">
          <div className="deal-section__header">
            <div>
              <h2 className="deal-section__title">
                <span className="deal-section__title-icon" aria-hidden="true">🆕</span>
                New Arrivals
              </h2>
              <p className="deal-section__sub">The latest products listed on Seedwel Hub</p>
            </div>
            <Link to="/marketplace" className="section__link">See all →</Link>
          </div>
          {products.loading && <Spinner size="sm" />}
          {products.error && <ErrorState message={products.error} onRetry={products.retry} />}
          {!products.loading && !products.error && sections.newest.length === 0 && (
            <EmptyState title="No products yet" message="Products will appear here as businesses list them." />
          )}
          {!products.loading && !products.error && sections.newest.length > 0 && (
            <div className="grid grid--products">
              {sections.newest.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>

        {/* Featured businesses */}
        <section className="section">
          <div className="section__header">
            <h2 className="section__title">Featured businesses</h2>
            <Link to="/businesses" className="section__link">See all →</Link>
          </div>
          {featuredBusinesses.loading && <Spinner size="sm" />}
          {featuredBusinesses.error && <ErrorState message={featuredBusinesses.error} onRetry={featuredBusinesses.retry} />}
          {!featuredBusinesses.loading && !featuredBusinesses.error && featuredBusinesses.data?.length === 0 && (
            <EmptyState title="No businesses yet" message="Businesses will appear here once registered." />
          )}
          {!featuredBusinesses.loading && !featuredBusinesses.error && featuredBusinesses.data?.length > 0 && (
            <div className="grid grid--businesses">
              {featuredBusinesses.data.map((b) => (
                <BusinessCard key={b.id} business={b} />
              ))}
            </div>
          )}
        </section>

        {/* Services */}
        <section className="section home-secondary-section">
          <div className="section__header">
            <h2 className="section__title">Popular services</h2>
            <Link to="/services" className="section__link">See all →</Link>
          </div>
          {services.loading && <Spinner size="sm" />}
          {services.error && <ErrorState message={services.error} onRetry={services.retry} />}
          {!services.loading && !services.error && services.data?.length === 0 && (
            <EmptyState title="No services yet" message="Services will appear here as providers list them." />
          )}
          {!services.loading && !services.error && services.data?.length > 0 && (
            <div className="grid grid--services">
              {services.data.map((s) => (
                <ServiceCard key={s.id} service={s} />
              ))}
            </div>
          )}
        </section>

        {/* Account-aware next step: no logged-in customer is sent back to Sign Up. */}
        <section className="section home-cta" aria-labelledby="home-cta-title">
          <div className="home-cta__copy">
            <p className="home-cta__eyebrow">{homepageCta.eyebrow}</p>
            <h2 className="home-cta__title" id="home-cta-title">{homepageCta.title}</h2>
            <p className="home-cta__body">{homepageCta.body}</p>
          </div>
          <div className="home-cta__actions">
            <Link to={homepageCta.primaryTo} className="btn btn--primary">
              {homepageCta.primaryLabel}
            </Link>
            <Link to={homepageCta.secondaryTo} className="btn btn--hero">
              {homepageCta.secondaryLabel}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
