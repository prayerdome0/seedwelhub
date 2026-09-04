import { useEffect, useState } from 'react';
import { formatCountdown } from '../utils/promotions';

/**
 * Live "Ends in 2h 35m" countdown.
 *
 * Ticks once a second while under a minute remains and once a minute
 * otherwise, so a grid full of deals does not re-render 60 times a second for
 * a label that only changes hourly. Renders nothing once the deal has lapsed —
 * the parent's own resolver will drop the promotion on its next read.
 */
export default function PromoCountdown({ endsAt, label = 'Ends in', className = '' }) {
  const target = endsAt ? new Date(endsAt).getTime() : 0;
  const [remaining, setRemaining] = useState(() => Math.max(0, target - Date.now()));

  useEffect(() => {
    if (!target) return undefined;
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    // Under a minute the seconds matter; above it they do not.
    const interval = setInterval(tick, target - Date.now() < 60000 ? 1000 : 30000);
    return () => clearInterval(interval);
  }, [target]);

  if (!target || remaining <= 0) return null;

  return (
    <span className={`promo-countdown ${className}`}>
      <span aria-hidden="true">⏳</span> {label} {formatCountdown(remaining)}
    </span>
  );
}
