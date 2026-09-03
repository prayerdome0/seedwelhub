import { useId } from 'react';
import { REAL_LOGO } from '../assets';

// Front-facing t-shirt silhouette (outline follows the classic blank-tee shape).
const TSHIRT_PATH =
  'M631.2 96.5L436.5 0C416.4 27.8 371.9 47.2 320 47.2S223.6 27.8 203.5 0L8.8 96.5' +
  'c-7.9 4-11.1 13.6-7.2 21.5l57.2 114.5c4 7.9 13.6 11.1 21.5 7.2l56.6-27.7' +
  'c10.6-5.2 23 2.5 23 14.4V480c0 17.7 14.3 32 32 32h256c17.7 0 32-14.3 32-32V226.3' +
  'c0-11.8 12.4-19.6 23-14.4l56.6 27.7c7.9 4 17.5.8 21.5-7.2L638.3 118c4-7.9.8-17.6-7.1-21.5z';

/**
 * Animated t-shirt "mockup" with the Seedwel logo screen-printed on the chest.
 * The shirt is drawn as a vector silhouette (so it scales crisply) and the real
 * Seedwel mark (REAL_LOGO) is overlaid on the chest like a printed graphic.
 */
export default function TshirtLogo({ logo = REAL_LOGO, color = '#e7f6ea', className = '' }) {
  const uid = useId().replace(/[:]/g, '');
  const shadeId = `tshirt-shade-${uid}`;
  const clipId = `tshirt-clip-${uid}`;
  const shineId = `tshirt-shine-${uid}`;

  // Respect prefers-reduced-motion for the shine sweep (SMIL ignores media queries).
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className={`tshirt ${className}`} aria-hidden="true">
      <svg viewBox="0 0 640 512" className="tshirt__svg" role="img">
        <defs>
          <linearGradient id={shadeId} x1="0" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="1" stopColor="#0f1722" stopOpacity="0.14" />
          </linearGradient>
          <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.45" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipId}>
            <path d={TSHIRT_PATH} />
          </clipPath>
        </defs>

        {/* Body */}
        <path d={TSHIRT_PATH} fill={color} />
        {/* Soft fabric shading */}
        <path d={TSHIRT_PATH} fill={`url(#${shadeId})`} />
        {/* Outline for crisp edges on any background */}
        <path d={TSHIRT_PATH} fill="none" stroke="#0f1722" strokeOpacity="0.08" strokeWidth="2" />

        {/* Screen-print shine sweeping across the shirt (clipped to the silhouette) */}
        <g clipPath={`url(#${clipId})`}>
          <rect y="0" width="170" height="512" fill={`url(#${shineId})`} opacity="0.6">
            {!reducedMotion && (
              <animate attributeName="x" values="-220;820" dur="6s" repeatCount="indefinite" />
            )}
          </rect>
        </g>
      </svg>
      <img src={logo} alt="" className="tshirt__logo" draggable={false} />
    </div>
  );
}
