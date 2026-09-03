import { REAL_LOGO } from '../assets';

// Five brand pillars that scroll in a seamless loop.
const ITEMS = ['Buy', 'Sell', 'Manage', 'Grow', 'Connect'];

// Repeat the set enough times per half so the track is always wider than the
// viewport, then duplicate it once more for a gap-free -50% translate loop.
const REPEATS = 4;

export default function LogoMarquee() {
  const half = Array.from({ length: REPEATS }, () => ITEMS).flat();
  const track = [...half, ...half];

  return (
    <div className="logo-marquee" aria-hidden="true">
      <div className="logo-marquee__track">
        {track.map((word, i) => (
          <span className="logo-marquee__item" key={`${word}-${i}`}>
            <img src={REAL_LOGO} alt="" className="logo-marquee__logo" draggable={false} />
            <span className="logo-marquee__word">{word}</span>
            <span className="logo-marquee__dot" />
          </span>
        ))}
      </div>
    </div>
  );
}
