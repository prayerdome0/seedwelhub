import { useEffect, useRef, useState } from 'react';
import { REAL_LOGO } from '../assets';

// Cinematic intro timeline (ms). CSS drives the visuals; JS only handles the
// leave/skip window and unmounting so the app is revealed underneath.
const LEAVE_AT = 3200;
const DONE_AT = 3600;
const LEAVE_MS = DONE_AT - LEAVE_AT; // fade-out duration

// Sparkle field (deterministic, so it never shifts between renders).
const SPARKS = [
  { left: '8%', top: '22%', delay: 2.15, size: 3 },
  { left: '16%', top: '68%', delay: 2.45, size: 2 },
  { left: '24%', top: '34%', delay: 2.3, size: 2 },
  { left: '31%', top: '82%', delay: 2.6, size: 3 },
  { left: '42%', top: '16%', delay: 2.2, size: 2 },
  { left: '55%', top: '72%', delay: 2.5, size: 3 },
  { left: '63%', top: '26%', delay: 2.35, size: 2 },
  { left: '72%', top: '80%', delay: 2.2, size: 2 },
  { left: '81%', top: '38%', delay: 2.55, size: 3 },
  { left: '90%', top: '64%', delay: 2.4, size: 2 },
  { left: '68%', top: '48%', delay: 2.7, size: 2 },
  { left: '36%', top: '52%', delay: 2.8, size: 2 },
  { left: '50%', top: '88%', delay: 2.62, size: 3 },
  { left: '14%', top: '12%', delay: 2.72, size: 2 },
];

/**
 * Action-movie style opening sequence: cinematic letterbox bars, a "presents"
 * tag, the Seedwel logo slamming in with a flash and screen shake, the SEEDWEL
 * HUB wordmark, a light streak and sparkles — then a fade-out into the app.
 * Plays once per app open and can be skipped (click / tap / any key).
 */
export default function AppIntro({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  const timersRef = useRef([]);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    onDone?.();
  };

  const skip = () => {
    if (doneRef.current || leaving) return;
    setLeaving(true);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    const t = setTimeout(finish, LEAVE_MS);
    timersRef.current.push(t);
  };

  useEffect(() => {
    // Respect reduced motion — skip straight to the app.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return undefined;
    }

    const leave = setTimeout(() => {
      setLeaving(true);
    }, LEAVE_AT);
    const done = setTimeout(finish, DONE_AT);
    timersRef.current.push(leave, done);

    const onKey = () => skip();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`app-intro ${leaving ? 'is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Seedwel Hub intro"
      onClick={skip}
    >
      {/* Letterbox bars */}
      <div className="app-intro__bar app-intro__bar--top" aria-hidden="true" />
      <div className="app-intro__bar app-intro__bar--bottom" aria-hidden="true" />

      {/* Backdrop glow + streak + flash */}
      <div className="app-intro__glow" aria-hidden="true" />
      <div className="app-intro__streak" aria-hidden="true" />
      <div className="app-intro__flash" aria-hidden="true" />

      {/* Sparkles */}
      <div className="app-intro__sparks" aria-hidden="true">
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className="app-intro__spark"
            style={{
              left: s.left,
              top: s.top,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Center content */}
      <div className="app-intro__content">
        <p className="app-intro__presents">
          <span>Seedwel Investment Limited</span>
          <em>Presents</em>
        </p>
        <div className="app-intro__logo">
          <img loading="lazy" decoding="async" src={REAL_LOGO} alt="Seedwel Hub" draggable={false} />
        </div>
        <h1 className="app-intro__wordmark">SEEDWEL HUB</h1>
        <p className="app-intro__tagline">BUY · SELL · MANAGE · GROW</p>
      </div>

      <button type="button" className="app-intro__skip" onClick={skip}>
        Skip intro ›
      </button>
    </div>
  );
}
