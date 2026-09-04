import { Link } from 'react-router-dom';
import SearchBar from '../components/SearchBar';
import ProductCard from '../components/ProductCard';
import BusinessCard from '../components/BusinessCard';
import ServiceCard from '../components/ServiceCard';
import Spinner from '../components/Spinner';
import BannerCarousel from '../components/BannerCarousel';
import LogoMarquee from '../components/LogoMarquee';
import { EmptyState, ErrorState } from '../components/PageState';
import useAsync from '../hooks/useAsync';
import { getFeaturedProducts, getLatestProducts } from '../services/productService';
import { getFeaturedBusinesses } from '../services/businessService';
import { getLatestServices } from '../services/serviceService';
import { BUSINESS_CATEGORIES } from '../utils/constants';

export default function HomePage() {
  const products = useAsync(() => getLatestProducts(12), []);
  const featuredBusinesses = useAsync(() => getFeaturedBusinesses(6), []);
  const services = useAsync(() => getLatestServices(8), []);

  return (
    <div>
      {/* Hero — five auto-scrolling professional banners + search + stats */}
      <section className="hero">
        <div className="container">
          <BannerCarousel />

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
              <div className="hero__stat-value">{products.data?.length || 0}+</div>
              <div className="hero__stat-label">Products</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{featuredBusinesses.data?.length || 0}+</div>
              <div className="hero__stat-label">Businesses</div>
            </div>
            <div className="hero__stat">
              <div className="hero__stat-value">{services.data?.length || 0}+</div>
              <div className="hero__stat-label">Services</div>
            </div>
          </div>
        </div>
      </section>

      {/* Auto-scrolling logo marquee */}
      <LogoMarquee />

      <div className="container page">
        {/* Categories */}
        <section className="section">
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

        {/* Featured products */}
        <section className="section">
          <div className="section__header">
            <h2 className="section__title">Featured products</h2>
            <Link to="/marketplace" className="section__link">See all →</Link>
          </div>
          {products.loading && <Spinner size="sm" />}
          {products.error && <ErrorState message={products.error} onRetry={products.retry} />}
          {!products.loading && !products.error && products.data?.length === 0 && (
            <EmptyState title="No products yet" message="Products will appear here as businesses list them." />
          )}
          {!products.loading && !products.error && products.data?.length > 0 && (
            <div className="grid grid--products">
              {products.data.map((p) => (
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
        <section className="section">
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

        {/* CTA */}
        <section className="section">
          <div className="panel panel--muted text-center">
            <h2 className="section__title">Ready to grow your business?</h2>
            <p className="text-muted">Create an account to list products, manage orders and connect with customers.</p>
            <div className="flex gap-16 justify-center mt-16">
              <Link to="/register" className="btn btn--primary">Get Started</Link>
              <Link to="/marketplace" className="btn btn--secondary">Explore Marketplace</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
