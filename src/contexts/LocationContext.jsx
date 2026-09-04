import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { placeLabel, reverseGeocode } from '../utils/location';

// ---------------------------------------------------------------------------
// LocationContext — coarse, consent-based marketplace location.
//
// The context stores ONLY a coarse place (country / region / city / nearest
// area) plus a display label. Precise GPS coordinates never enter this state,
// never persist and never render anywhere; they exist only inside the brief
// browser geolocation callback and are converted to a place immediately.
//
// The coarse place is cached in localStorage (key below) so a refresh keeps
// the chosen location without re-asking. localStorage never receives
// coordinates.
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'seedwel:location:v1';

function readStoredPlace() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    // Reject anything that looks like it carries coordinates.
    if (
      typeof parsed.latitude === 'number' ||
      typeof parsed.longitude === 'number' ||
      typeof parsed.lat === 'number' ||
      typeof parsed.lng === 'number'
    ) {
      return null;
    }
    if (!parsed.label && !parsed.city && !parsed.country) return null;
    return { ...parsed, source: parsed.source === 'manual' ? 'manual' : 'detected' };
  } catch {
    return null;
  }
}

function writeStoredPlace(place) {
  try {
    if (!place) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(place));
  } catch {
    // Storage may be unavailable (private mode) — the location still works
    // for this session.
  }
}

const LocationContext = createContext({
  place: null, // coarse place { country, region, city, area, label, source }
  status: 'idle', // idle | detecting | granted | denied | error
  statusMessage: '',
  setPlace: () => {},
  clearPlace: () => {},
  detectLocation: () => {},
});

export function LocationProvider({ children }) {
  const [place, setPlaceState] = useState(() => readStoredPlace());
  const [status, setStatus] = useState('idle'); // idle|detecting|granted|denied|error
  const [statusMessage, setStatusMessage] = useState('');

  // Keep the stored copy in sync (refreshes keep the choice).
  useEffect(() => {
    writeStoredPlace(place);
  }, [place]);

  const setPlace = useCallback((next) => {
    if (!next || typeof next !== 'object') return;
    const safe = {
      country: String(next.country || '').trim(),
      region: String(next.region || '').trim(),
      city: String(next.city || '').trim(),
      area: String(next.area || '').trim(),
      source: next.source === 'manual' ? 'manual' : 'detected',
      label: String(next.label || placeLabel(next) || '').trim() || 'your location',
    };
    setPlaceState(safe);
    setStatus('granted');
    setStatusMessage('');
  }, []);

  const clearPlace = useCallback(() => {
    setPlaceState(null);
    setStatus('idle');
    setStatusMessage('');
  }, []);

  /**
   * Requests browser location permission (must run from a user gesture, e.g.
   * a button press) and converts the approximate position into a coarse
   * place. Resolves with the coarse place, or null when denied/unavailable.
   */
  const detectLocation = useCallback(async () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setStatus('denied');
      setStatusMessage('Location is not supported on this device. Choose a location manually instead.');
      return null;
    }
    setStatus('detecting');
    setStatusMessage('Finding your approximate location…');

    const position = await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
        enableHighAccuracy: false, // approximate is all we need
        timeout: 12000,
        maximumAge: 10 * 60 * 1000,
      });
    });

    if (!position) {
      setStatus('denied');
      setStatusMessage(
        'Location access was denied or timed out. You can still choose a location manually — nothing is hidden.'
      );
      return null;
    }

    // Coarse conversion happens immediately; the coordinates are local to
    // this block and are never stored or displayed.
    const detected = await reverseGeocode(
      position.coords.latitude,
      position.coords.longitude
    );

    if (!detected) {
      setStatus('error');
      setStatusMessage('We could not identify your area. Please choose your location manually.');
      return null;
    }

    setPlace(detected);
    return detected;
  }, [setPlace]);

  return (
    <LocationContext.Provider
      value={{
        place,
        status,
        statusMessage,
        setPlace,
        clearPlace,
        detectLocation,
        // Convenience: does the user currently have a (manual or detected)
        // location to rank against?
        hasPlace: Boolean(place),
        label: place?.label || '',
      }}
    >
      {children}
    </LocationContext.Provider>
  );
}

export function useMarketLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useMarketLocation must be used within a LocationProvider.');
  }
  return context;
}

