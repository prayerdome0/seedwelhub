import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import TshirtLogo from './TshirtLogo';

const AUTOPLAY_MS = 5000;

const SLIDES = [
  {
    id: 'grow',
    eyebrow: 'Seedwel Investment Limited',
    title: (
      <>
        The marketplace to <span className="accent">buy, sell, manage</span> &amp; grow
      </>
    ),
    subtitle:
      'Discover trusted businesses, products and services. Connect, transact and grow your business with Seedwel Hub.',
    cta: [
      { label: 'Get Started', to: '/register', variant: 'btn--primary' },
      { label: 'Explore Marketplace', to: '/marketplace', variant: 'btn--hero' },
    ],
    shirt: '#e7f6ea',
  },
  {
    id: 'discover',
    eyebrow: 'Discover',
    title: (
      <>
        Trusted businesses <span className="accent">near you</span>
      </>
    ),
    subtitle:
      'Browse verified businesses and connect directly with the people behind them — all in one place.',
    cta: [
      { label: 'Browse Businesses', to: '/businesses', variant: 'btn--primary' },
      { label: 'View Services', to: '/services', variant: 'btn--hero' },
    ],
    shirt: '#ffffff',
  },
  {
    id: 'sell',
    eyebrow: 'Sell',
    title: (
      <>
        Put your products in front of <span className="accent">thousands</span>
      </>
    ),
    subtitle:
      'List once and reach everyone. Manage orders, payments and growth from a single dashboard.',
    cta: [
      { label: 'Start Selling', to: '/sell', variant: 'btn--primary' },
      { label: 'Browse Products', to: '/products', variant: 'btn--hero' },
    ],
    shirt: '#eef2f8',
  },
  {
    id: 'manage',
    eyebrow: 'Manage',
    title: (
      <>
        Run your whole business <span className="accent">from one hub</span>
      </>
    ),
    subtitle:
      'Quotations, invoices, receipts, reviews and messaging — everything you need to operate and scale.',
    cta: [
      { label: 'Create Account', to: '/register', variant: 'btn--primary' },
      { label: 'See How It Works', to: '/marketplace', variant: 'btn--hero' },
    ],
    shirt: '#e7f6ea',
  },
  {
    id: 'community',
    eyebrow: 'Buy. Sell. Manage. Grow.',
    title: (
      <>
        One hub. <span className="accent">Endless opportunities.</span>
      </>
    ),
    subtitle:
      'Join the Seedwel community of buyers, sellers and service providers growing together.',
    cta: [
      { label: 'Join Seedwel Hub', to: '/register', variant: 'btn--primary' },
      { label: 'Explore Marketplace', to: '/marketplace', variant: 'btn--hero' },
    ],
    shirt: '#ffffff',
  },
];

/**
 * Auto-advancing hero banner carousel. Five animated brand banners, each with a
 * t-shirt mockup wearing the Seedwel logo. Auto-plays every few seconds, pauses
 * on hover/focus and exposes arrows + dots for manual control.
 */
export default function BannerCarousel() {
  const count = SLIDES.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);

  const go = useCallback((i) => {
    setIndex(((i % count) + count) % count);
  }, [count]);

  useEffect(() => {
    if (paused) return undefined;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(timerRef.current);
  }, [paused, count]);

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);

  return (
    <div
      className="banner-carousel"
      aria-roledescription="carousel"
      aria-label="Seedwel Hub highlights"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <div className="banner-carousel__slides">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.id}
            className={`banner-slide ${i === index ? 'is-active' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
          >
            <div className="banner-slide__content">
              <p className="banner-slide__eyebrow">{slide.eyebrow}</p>
              <h1 className="banner-slide__title">{slide.title}</h1>
              <p className="banner-slide__subtitle">{slide.subtitle}</p>
              <div className="banner-slide__actions">
                {slide.cta.map((cta) => (
                  <Link key={cta.label} to={cta.to} className={`btn ${cta.variant}`}>
                    {cta.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="banner-slide__visual">
              <TshirtLogo color={slide.shirt} className="banner-slide__tshirt" />
            </div>
          </div>
        ))}
      </div>

      <div className="banner-carousel__nav">
        <button
          type="button"
          className="banner-carousel__arrow"
          onClick={() => go(index - 1)}
          aria-label="Previous banner"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className="banner-carousel__dots" aria-label="Choose banner">
          {SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to banner ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              className={`banner-carousel__dot ${i === index ? 'is-active' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="banner-carousel__arrow"
          onClick={() => go(index + 1)}
          aria-label="Next banner"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
