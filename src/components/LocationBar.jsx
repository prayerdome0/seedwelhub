import { useEffect, useRef, useState } from 'react';
import { useMarketLocation } from '../contexts/LocationContext';
import { LOCATION_COUNTRIES } from '../utils/location';

// ---------------------------------------------------------------------------
// LocationBar — the location-aware marketplace controls.
//
// Renders a slim bar above listings:
//   • no location yet → invite the user to make results location-aware
//     ("Use my location" needs the browser permission, so it always runs
//     from this button press) or choose a place manually;
//   • location set    → "Showing {noun} near {label}." with Change / Clear.
//
// The picker modal only stores coarse places (country/region/city/area).
// Precise coordinates are never shown, saved or sent anywhere except the
// one-time reverse-geocode lookup (see utils/location.js).
// ---------------------------------------------------------------------------

export default function LocationBar({ noun = 'listings', className = '' }) {
  const {
    place,
    label,
    status,
    statusMessage,
    setPlace,
    clearPlace,
    detectLocation,
  } = useMarketLocation();

  const [open, setOpen] = useState(false);
  const [detecting, setDetecting] = useState(false);

  const handleDetect = async () => {
    setDetecting(true);
    const detected = await detectLocation();
    setDetecting(false);
    if (detected) setOpen(false);
  };

  return (
    <div className={`loc-bar ${className}`}>
      <span className="loc-bar__icon" aria-hidden="true">📍</span>
      {place ? (
        <>
          <p className="loc-bar__text">
            Showing {noun} near <strong>{label}</strong>. Nearby listings appear first — other
            locations stay visible below.
          </p>
          <div className="loc-bar__actions">
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(true)}>
              Change
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => clearPlace()}
              aria-label="Clear location"
              title="Show listings from all locations"
            >
              Clear
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="loc-bar__text">
            <strong>Location-aware marketplace:</strong> listings near you are shown first — nothing
            from other locations is hidden.
          </p>
          <div className="loc-bar__actions">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={handleDetect}
              disabled={detecting}
            >
              {detecting ? 'Locating…' : 'Use my location'}
            </button>
            <button type="button" className="btn btn--outline btn--sm" onClick={() => setOpen(true)}>
              Set location
            </button>
          </div>
        </>
      )}

      {status === 'denied' || status === 'error' ? (
        !place && (
          <p className="loc-bar__status" role="status" aria-live="polite">
            {statusMessage}
          </p>
        )
      ) : null}

      {open && (
        <LocationModal
          noun={noun}
          initial={place}
          detecting={detecting}
          statusMessage={status === 'denied' || status === 'error' ? statusMessage : ''}
          onDetect={handleDetect}
          onSave={(next) => {
            setPlace(next);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Location picker modal — permission-based detection or a manual coarse place.
// ---------------------------------------------------------------------------

function LocationModal({ initial, detecting, statusMessage, onDetect, onSave, onClose }) {
  const [country, setCountry] = useState(initial?.country || '');
  const [region, setRegion] = useState(initial?.region || '');
  const [city, setCity] = useState(initial?.city || '');
  const [area, setArea] = useState(initial?.area || '');
  const [error, setError] = useState('');
  const cardRef = useRef(null);

  // Close on Escape; keep focus inside the dialog.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousFocus = document.activeElement;
    cardRef.current?.querySelector?.('input, select, button')?.focus?.();
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    };
  }, [onClose]);

  const handleSave = () => {
    if (!country.trim() && !region.trim() && !city.trim() && !area.trim()) {
      setError('Enter at least a country or a town so we can rank listings near you.');
      return;
    }
    setError('');
    onSave({
      country: country.trim(),
      region: region.trim(),
      city: city.trim(),
      area: area.trim(),
      source: 'manual',
      label: area.trim() || city.trim() || region.trim() || country.trim() || 'your location',
    });
  };

  return (
    <div className="loc-modal" role="dialog" aria-modal="true" aria-label="Choose your location">
      <div className="loc-modal__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="loc-modal__card" ref={cardRef}>
        <div className="loc-modal__head">
          <div>
            <h3 className="loc-modal__title">Your location</h3>
            <p className="loc-modal__subtitle">
              Results near you are shown first — listings from other locations stay visible.
            </p>
          </div>
          <button type="button" className="loc-modal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="loc-modal__body">
          <button type="button" className="loc-detect" onClick={onDetect} disabled={detecting}>
            <span className="loc-detect__icon" aria-hidden="true">📍</span>
            <span className="loc-detect__text">
              <strong>{detecting ? 'Finding your approximate location…' : 'Use my current location'}</strong>
              <span>Detect your country, region and town automatically (browser permission).</span>
            </span>
            {detecting && <span className="loc-detect__spinner" aria-hidden="true" />}
          </button>

          {!detecting && statusMessage && (
            <p className="loc-modal__status" role="status" aria-live="polite">
              {statusMessage}
            </p>
          )}

          <div className="loc-modal__divider"><span>or choose manually</span></div>

          <div className="form">
            <div className="form__row">
              <label className="form__group">
                <span className="form__label">Country</span>
                <select
                  className="form__input form__select"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                >
                  <option value="">Select country…</option>
                  {LOCATION_COUNTRIES.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="form__group">
                <span className="form__label">Region / Province <span className="form__hint">(optional)</span></span>
                <input
                  className="form__input"
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  placeholder="e.g. Eastern Province"
                />
              </label>
            </div>
            <div className="form__row">
              <label className="form__group">
                <span className="form__label">City / Town</span>
                <input
                  className="form__input"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="e.g. Chama"
                />
              </label>
              <label className="form__group">
                <span className="form__label">Nearest area <span className="form__hint">(optional)</span></span>
                <input
                  className="form__input"
                  value={area}
                  onChange={(event) => setArea(event.target.value)}
                  placeholder="e.g. Chama town centre"
                />
              </label>
            </div>
          </div>

          <p className="loc-modal__privacy">
            🔒 We only keep the town and country you choose — never your exact coordinates.
          </p>
          {error && <p className="form__error loc-modal__error">{error}</p>}
        </div>

        <div className="loc-modal__foot">
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={handleSave}>
            Save location
          </button>
        </div>
      </div>
    </div>
  );
}
