import { WATERMARK_LOGO } from '../assets';

export default function Spinner({ size = 'large', label = 'Loading…', children }) {
  return (
    <div className={`spinner spinner--${size}`} role="status" aria-live="polite">
      <img loading="lazy" decoding="async" src={WATERMARK_LOGO} alt="Seedwel Hub" className="spinner__logo" />
      <span className="spinner__label">{label}</span>
      <span className="spinner__dots" aria-hidden="true">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </span>
      {children}
    </div>
  );
}
