import { REAL_LOGO } from '../assets';

/**
 * A real marketplace photo with a small Seedwel Hub brand lockup layered over
 * it. Keeping the logo separate from the source image means the original photo
 * stays natural while every banner still carries the Seedwel mark consistently.
 */
export default function BrandPhoto({ src, alt, label, objectPosition = 'center', className = '' }) {
  return (
    <div className={`banner-photo ${className}`}>
      <img loading="lazy" decoding="async"
        src={src}
        alt={alt}
        className="banner-photo__image"
        style={{ objectPosition }}
        draggable={false}
      />
      <div className="banner-photo__shade" aria-hidden="true" />
      <div className="banner-photo__brand" aria-label="Seedwel Hub">
        <img loading="lazy" decoding="async" src={REAL_LOGO} alt="" draggable={false} />
        <span>Seedwel <strong>Hub</strong></span>
      </div>
      {label && (
        <div className="banner-photo__label">
          <span className="banner-photo__label-dot" aria-hidden="true" />
          {label}
        </div>
      )}
    </div>
  );
}
