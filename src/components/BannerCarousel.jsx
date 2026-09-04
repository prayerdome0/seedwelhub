import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { REAL_LOGO } from '../assets';
import PromoCountdown from './PromoCountdown';
import produceMarket from '../assets/banners/produce-market.jpg';
import coffeeBeans from '../assets/banners/coffee-beans.jpg';
import curatedGoods from '../assets/banners/curated-goods.jpg';
import coffeeShop from '../assets/banners/coffee-shop.jpg';
import fashionMarket from '../assets/banners/fashion-market.jpg';

// Every banner auto-advances after AUTOPLAY_MS. The timer restarts whenever the
// index changes, so a manual swipe / arrow / dot press always gets a fresh
// pause before the next automatic change.
const AUTOPLAY_MS = 6000;

// Minimum horizontal drag (in px) before a swipe counts as next/previous.
const SWIPE_THRESHOLD_PX = 48;

// The five Seedwel Hub marketplace banners. Each one uses a real marketplace
// photo (with the Seedwel brand lockup layered on) and the official green /
// navy / white palette. Slide themes: Buy · Sell · Services · Connect ·
// Manage & Grow.
const SLIDES = [
  {
    id: 'buy',
    eyebrow: 'Buy',
    title: (
      <>
        Discover products <span className="accent">near you</span>
      </>
    ),
    subtitle:
      'Shop verified products from trusted sellers across Seedwel Hub — everything you need, closer than you think.',
    cta: [
      { label: 'Shop Products', to: '/products', variant: 'btn--primary' },
      { label: 'Explore Marketplace', to: '/marketplace', variant: 'btn--hero' },
    ],
    image: produceMarket,
    imageAlt: 'Fresh fruit and vegetables arranged in a neighborhood market',
    imageLabel: 'Fresh produce',
    objectPosition: 'center 44%',
  },
  {
    id: 'sell',
    eyebrow: 'Sell',
    title: (
      <>
        Grow your business <span className="accent">on Seedwel Hub</span>
      </>
    ),
    subtitle:
      'List your products once and sell everywhere — manage orders, customers and payments from a single dashboard.',
    cta: [
      { label: 'Start Selling', to: '/sell', variant: 'btn--primary' },
      { label: 'Browse Products', to: '/products', variant: 'btn--hero' },
    ],
    image: fashionMarket,
    imageAlt: 'Clothing and shoes displayed in a retail store',
    imageLabel: 'Fashion & retail',
    objectPosition: 'center 50%',
  },
  {
    id: 'services',
    eyebrow: 'Services',
    title: (
      <>
        Find <span className="accent">trusted service providers</span>
      </>
    ),
    subtitle:
      'Connect with verified professionals for construction, transport, beauty, finance and more — reviewed by the Seedwel community.',
    cta: [
      { label: 'Browse Services', to: '/services', variant: 'btn--primary' },
      { label: 'View Businesses', to: '/businesses', variant: 'btn--hero' },
    ],
    image: curatedGoods,
    imageAlt: 'Basket of packaged goods in a local specialty shop',
    imageLabel: 'Independent shops',
    objectPosition: 'center 58%',
  },
  {
    id: 'connect',
    eyebrow: 'Connect',
    title: (
      <>
        Connect with <span className="accent">buyers and sellers</span>
      </>
    ),
    subtitle:
      'Join the Seedwel community of buyers, sellers and service providers growing together.',
    cta: [
      { label: 'Join Seedwel Hub', to: '/register', variant: 'btn--primary' },
      { label: 'Explore Marketplace', to: '/marketplace', variant: 'btn--hero' },
    ],
    image: coffeeShop,
    imageAlt: 'Products and coffee equipment arranged on shelves in a small shop',
    imageLabel: 'Specialty goods',
    objectPosition: 'center 55%',
  },
  {
    id: 'manage-grow',
    eyebrow: 'Manage & Grow',
    title: (
      <>
        Manage your business <span className="accent">and grow</span>
      </>
    ),
    subtitle:
      'Run your whole business from one hub — quotations, invoices, receipts, payments, reviews and messaging in one place.',
    cta: [
      { label: 'Manage My Business', to: '/seller', variant: 'btn--primary' },
      { label: 'Join Seedwel Hub', to: '/register', variant: 'btn--hero' },
    ],
    image: coffeeBeans,
    imageAlt: 'Coffee beans held in the hands of a local producer',
    imageLabel: 'Made to be discovered',
    objectPosition: 'center 48%',
  },
];

// Maps a seller's promotional banner document onto the same slide shape the
// built-in brand banners use, so both render through one code path.
function toSlide(banner) {
  return {
    id: `promo-${banner.id}`,
    isPromo: true,
    eyebrow: banner.discountPercent ? `\u{1F525} Up to ${banner.discountPercent}% OFF` : '\u{1F525} Promotion',
    title: banner.headline || 'Special offer',
    subtitle: banner.subline || '',
    cta: [
      { label: banner.ctaLabel || 'Shop now', to: banner.ctaTo || '/deals', variant: 'btn--primary' },
      { label: 'All deals', to: '/deals', variant: 'btn--hero' },
    ],
    image: banner.image,
    imageLabel: banner.businessName || '',
    objectPosition: 'center',
    endsAt: banner.endAt,
  };
}

/**
 * Auto-advancing hero banner carousel — one full-width professional banner per
 * theme (Buy, Sell, Services, Connect, Manage & Grow).
 *
 * - Auto-plays every few seconds and pauses on hover / focus.
 * - Restarts its timer after ANY manual navigation (arrows, dots or swipe).
 * - Supports touch + pointer swipes (desktop trackpads too) without hijacking
 *   vertical page scrolling.
 * - Exposes arrows + dots for keyboard and mouse users.
 */
export default function BannerCarousel({ promoBanners = [] }) {
  // Seller promotional banners are prepended so a live campaign is the first
  // thing a visitor sees, then the evergreen brand banners follow.
  const slides = useMemo(() => [...promoBanners.map(toSlide), ...SLIDES], [promoBanners]);
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  // Touch / pointer swipe tracking (started when a horizontal intent is seen).
  const gestureRef = useRef(null);

  // A campaign banner arriving (or expiring) must never leave the carousel
  // pointing past the end of the list.
  useEffect(() => {
    setIndex((current) => (current < count ? current : 0));
  }, [count]);

  const go = useCallback(
    (nextIndex) => {
      const target = ((nextIndex % count) + count) % count;
      setDirection(target > index ? 1 : target < index ? -1 : 0);
      setIndex(target);
    },
    [count, index]
  );

  const next = useCallback(() => {
    setDirection(1);
    setIndex((current) => (current + 1) % count);
  }, [count]);

  const prev = useCallback(() => {
    setDirection(-1);
    setIndex((current) => (current - 1 + count) % count);
  }, [count]);

  // Auto-play: the effect re-runs whenever `index`, `paused` or `count`
  // changes, which gives a full AUTOPLAY_MS of calm after every manual
  // navigation, while hovering keeps the carousel paused.
  useEffect(() => {
    if (paused) return undefined;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return undefined;
    }
    timerRef.current = setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, AUTOPLAY_MS);
    return () => clearInterval(timerRef.current);
  }, [paused, index, count]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  // Pause while the user is actively touching the banner; resume once the
  // gesture ends (or when the pointer leaves without an interaction).
  const onPointerDown = (event) => {
    if (event.pointerType === 'mouse') return;
    pause();
    gestureRef.current = { x: event.clientX, y: event.clientY, active: true };
    // Keep receiving the pointerup even when the finger leaves the banner
    // mid-swipe, so the gesture always completes cleanly.
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* capture unavailable — the fallback touch handlers still apply */
    }
  };

  const onPointerUp = (event) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    resume();
    if (!gesture.active) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    // Only horizontal swipes navigate — vertical swipes keep scrolling the page.
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) next();
      else prev();
    }
  };

  // Pointer cancel (scroll capture, browser gesture) — drop the gesture so the
  // page keeps scrolling naturally.
  const onPointerCancel = () => {
    gestureRef.current = null;
    resume();
  };

  // Legacy touch fallback for browsers without Pointer Events.
  const onTouchStart = (event) => {
    if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
    pause();
    const touch = event.touches?.[0];
    if (touch) gestureRef.current = { x: touch.clientX, y: touch.clientY, active: true };
  };

  const onTouchEnd = (event) => {
    if (typeof window !== 'undefined' && 'PointerEvent' in window) return;
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    resume();
    const touch = event.changedTouches?.[0];
    if (!touch || !gesture.active) return;
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) next();
      else prev();
    }
  };

  return (
    <div
      className={`banner-carousel ${paused ? 'is-paused' : ''}`}
      data-direction={direction}
      aria-roledescription="carousel"
      aria-label="Seedwel Hub highlights"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="banner-carousel__slides">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            className={`banner-slide ${i === index ? 'is-active' : ''} ${slide.isPromo ? 'banner-slide--promo' : ''}`}
            role="group"
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${count}`}
            aria-hidden={i !== index}
          >
            {/* The photo IS the banner background. It is dimmed by the
                gradient scrim below so the promotional wording on top stays
                legible on any photo, on any screen size. */}
            <div className="banner-slide__bg" aria-hidden="true">
              <img
                src={slide.image}
                alt=""
                className="banner-slide__bg-img"
                style={{ objectPosition: slide.objectPosition }}
                draggable={false}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
              <div className="banner-slide__scrim" />
            </div>

            <div className="banner-slide__content">
              <p className="banner-slide__eyebrow">
                <span aria-hidden="true">◆</span> {slide.eyebrow}
              </p>
              <h1 className="banner-slide__title">{slide.title}</h1>
              <p className="banner-slide__subtitle">{slide.subtitle}</p>
              {slide.endsAt && (
                <PromoCountdown endsAt={slide.endsAt} className="promo-countdown--banner" />
              )}
              <div className="banner-slide__actions">
                {slide.cta.map((cta) => (
                  <Link
                    key={cta.label}
                    to={cta.to}
                    className={`btn ${cta.variant}`}
                    tabIndex={i === index ? 0 : -1}
                  >
                    {cta.label}
                  </Link>
                ))}
              </div>
            </div>

            {slide.imageLabel && (
              <div className="banner-slide__tag">
                <span className="banner-slide__tag-dot" aria-hidden="true" />
                {slide.imageLabel}
              </div>
            )}

            <div className="banner-slide__brand" aria-label="Seedwel Hub">
              <img src={REAL_LOGO} alt="" draggable={false} />
              <span>
                Seedwel <strong>Hub</strong>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="banner-carousel__nav">
        <button
          type="button"
          className="banner-carousel__arrow"
          onClick={prev}
          aria-label="Previous banner"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className="banner-carousel__dots" role="tablist" aria-label="Choose banner">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to banner ${i + 1}: ${slide.eyebrow}`}
              aria-current={i === index ? 'true' : undefined}
              className={`banner-carousel__dot ${i === index ? 'is-active' : ''}`}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button
          type="button"
          className="banner-carousel__arrow"
          onClick={next}
          aria-label="Next banner"
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  );
}
