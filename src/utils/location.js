// ---------------------------------------------------------------------------
// Location utilities for the location-aware marketplace.
//
// Privacy model:
//  - The browser reports precise GPS coordinates ONLY to the reverse-geocoder
//    call below; the result is converted immediately into a coarse, safe
//    place (country / region / city / nearest area) plus a display label.
//  - Exact coordinates are NEVER persisted, NEVER stored in Firestore,
//    NEVER shown in the UI and never part of any state object that outlives
//    the reverse-geocode request. localStorage keeps only the coarse place.
//  - If permission is denied or detection fails the app simply falls back to
//    the user's manually chosen location, or to the default ordering.
// ---------------------------------------------------------------------------

// Ordered ranking tiers. Nearest area beats same city, which beats same
// region, which beats same country; everything else comes last.
export const LOCATION_TIERS = {
  AREA: 0, // nearest area / neighbourhood of the user
  CITY: 1, // same city / town
  REGION: 2, // same region / province
  COUNTRY: 3, // same country
  OTHER: 4, // everywhere else
};

export const LOCATION_TIER_LABELS = {
  [LOCATION_TIERS.AREA]: 'Near you',
  [LOCATION_TIERS.CITY]: 'Same city/town',
  [LOCATION_TIERS.REGION]: 'Same region',
  [LOCATION_TIERS.COUNTRY]: 'Same country',
  [LOCATION_TIERS.OTHER]: 'Other locations',
};

// Fields that can carry location text on marketplace entities (products,
// services, businesses). Kept generous because sellers describe locations in
// free text ("Chama", "Chama, Eastern Province", "Plot 3, Lusaka, Zambia").
const LOCATION_FIELDS = [
  'area',
  'location',
  'city',
  'town',
  'region',
  'province',
  'state',
  'country',
  'address',
];

/** Lowercases and flattens free-text location into a comparable phrase. */
export function normalizeLocation(value) {
  return String(value || '')
    .toLowerCase()
    // Collapse punctuation into single spaces but keep letters incl. accents.
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Joins every location-ish field of an entity into one normalized phrase. */
export function entityLocationText(entity, extraFields = []) {
  const fields = [...LOCATION_FIELDS, ...extraFields];
  const parts = fields
    .map((key) => entity?.[key])
    .filter((value) => typeof value === 'string' && value.trim().length > 1);
  return normalizeLocation(parts.join(' '));
}

/** Normalises the coarse place tokens used for ranking. */
export function normalizePlace(place) {
  const out = {};
  if (!place) return out;
  for (const key of ['country', 'region', 'province', 'city', 'town', 'area']) {
    const value = place[key];
    const norm = normalizeLocation(value);
    if (norm) out[key] = norm;
  }
  return out;
}

/**
 * Computes the best ranking tier of one listing against the user's place.
 *
 * Tier order (see LOCATION_TIERS): nearest area → same city → same region →
 * same country → other locations. Each tier only counts when the previous
 * one did not match, so a listing in the user's town ranks above one merely
 * in the same country.
 */
export function tierForEntity(entity, place, extraFields = []) {
  if (!place) return LOCATION_TIERS.OTHER;
  const tokens = normalizePlace(place);
  const text = entityLocationText(entity, extraFields);
  if (!text) return LOCATION_TIERS.OTHER;

  if (tokens.area && text.includes(tokens.area)) return LOCATION_TIERS.AREA;
  if (tokens.city && text.includes(tokens.city)) return LOCATION_TIERS.CITY;
  if (tokens.region && text.includes(tokens.region)) return LOCATION_TIERS.REGION;
  if (tokens.country && text.includes(tokens.country)) return LOCATION_TIERS.COUNTRY;
  return LOCATION_TIERS.OTHER;
}

/**
 * Ranks a list of entities by proximity to `place` (stable sort — entities in
 * the same tier keep their original order). Nearby results come first and
 * nothing is ever hidden.
 *
 * Returns `{ items, near, rest, counts }`:
 *   items  – the full list, nearest first (area+city, then region, country,
 *            then other locations — all present)
 *   near   – the sub-list that is in the user's area/city (may be empty)
 *   rest   – every other listing (regions/countries/other, still ordered)
 *   counts – how many listings matched each tier
 */
export function rankByLocation(items = [], place, extraFields = []) {
  const result = (items || []).map((item, index) => ({
    item,
    index,
    tier: tierForEntity(item, place, extraFields),
  }));

  result.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.index - b.index;
  });

  const sorted = result.map((entry) => entry.item);
  const counts = { [LOCATION_TIERS.AREA]: 0, [LOCATION_TIERS.CITY]: 0, [LOCATION_TIERS.REGION]: 0, [LOCATION_TIERS.COUNTRY]: 0, [LOCATION_TIERS.OTHER]: 0 };
  for (const entry of result) counts[entry.tier] = (counts[entry.tier] || 0) + 1;

  return {
    items: sorted,
    near: sorted.slice(0, counts[LOCATION_TIERS.AREA] + counts[LOCATION_TIERS.CITY]),
    rest: sorted.slice(counts[LOCATION_TIERS.AREA] + counts[LOCATION_TIERS.CITY]),
    counts,
  };
}

/** Human label of the user's coarse place ("Chama", "Lusaka", …). */
export function placeLabel(place) {
  if (!place) return '';
  return (
    place.label ||
    place.area ||
    place.city ||
    place.town ||
    place.region ||
    place.province ||
    place.country ||
    ''
  );
}

// ---------------------------------------------------------------------------
// Reverse geocoding — coordinates → coarse place (country/region/city/area).
// ---------------------------------------------------------------------------

// Free, keyless, CORS-enabled reverse-geocoder (BigDataCloud). It is only
// ever called with the user's explicit consent (they pressed "Use my
// location") and only returns coarse admin areas, not an address.
const REVERSE_GEOCODE_URL =
  'https://api.bigdatacloud.net/data/reverse-geocode-client';

/**
 * Converts one set of coordinates into a coarse place object.
 * Resolves `null` (never throws) when the lookup fails so callers can fall
 * back to the manual selector gracefully.
 */
export async function reverseGeocode(latitude, longitude) {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: 'en',
  });

  let response;
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), 9000)
      : null;
    response = await fetch(`${REVERSE_GEOCODE_URL}?${params.toString()}`, {
      signal: controller?.signal,
    });
    if (timeout) clearTimeout(timeout);
  } catch (error) {
    console.warn('[SeedwelHub] Reverse geocoding unavailable:', error?.name || error);
    return null;
  }

  if (!response.ok) return null;

  let data;
  try {
    data = await response.json();
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  // Coarse admin areas only — intentionally NO street/postcode/plus-code and
  // no coordinates. `area` is the locality/district returned by the geocoder
  // (e.g. "Chama"); city falls back to the same value.
  const locality = String(data.locality || data.city || '').trim();
  const city = String(data.city || data.locality || '').trim();
  const region = String(data.principalSubdivision || '').trim();
  const country = String(data.countryName || '').trim();

  const place = {
    area: locality,
    city,
    region,
    country,
    source: 'detected',
    label: '',
  };
  place.label = placeLabel(place) || 'your location';
  if (!place.area && !place.city && !place.region && !place.country) return null;
  return place;
}

// Curated country list for the manual location selector (alphabetical-ish by
// marketplace relevance). Users may type their own country too.
export const LOCATION_COUNTRIES = [
  'Zambia',
  'Uganda',
  'Kenya',
  'Tanzania',
  'Rwanda',
  'Burundi',
  'Malawi',
  'Mozambique',
  'Zimbabwe',
  'South Africa',
  'Botswana',
  'Namibia',
  'Angola',
  'Democratic Republic of the Congo',
  'South Sudan',
  'Nigeria',
  'Ghana',
  'Ethiopia',
  'Egypt',
  'Morocco',
  'United Kingdom',
  'Ireland',
  'United States',
  'Canada',
  'Australia',
  'New Zealand',
  'India',
  'China',
  'Japan',
  'South Korea',
  'Singapore',
  'United Arab Emirates',
  'Saudi Arabia',
  'Qatar',
  'Germany',
  'France',
  'Netherlands',
  'Belgium',
  'Switzerland',
  'Austria',
  'Italy',
  'Spain',
  'Portugal',
  'Poland',
  'Sweden',
  'Norway',
  'Denmark',
  'Turkey',
  'Brazil',
  'Mexico',
  'Other',
];

/** Builds a coarse place from the manual selector form values. */
export function manualPlace({ country = '', region = '', city = '', area = '' }) {
  const place = {
    country: String(country || '').trim(),
    region: String(region || '').trim(),
    city: String(city || '').trim(),
    area: String(area || '').trim(),
    source: 'manual',
    label: '',
  };
  const labelSource = place.area || place.city || place.region || place.country;
  place.label = labelSource || 'your location';
  return place;
}
