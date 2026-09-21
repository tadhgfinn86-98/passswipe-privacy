// Optional source: Google Places API (New). Set GOOGLE_MAPS_API_KEY to enable.
// Richer than OSM (ratings, review counts, verified phones) but billed per call.
import { request } from '../http.js';
import { DiskCache } from '../cache.js';
import { makeLead } from '../lead.js';

const ENDPOINT = process.env.D7_GOOGLE_PLACES_URL || 'https://places.googleapis.com/v1/places:searchText';
const cache = new DiskCache();

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.internationalPhoneNumber',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryTypeDisplayName',
  'places.types',
  'places.location',
  'places.googleMapsUri',
  'places.businessStatus',
  'places.regularOpeningHours.weekdayDescriptions',
  'nextPageToken',
].join(',');

function component(place, type) {
  return (place.addressComponents || []).find((c) => (c.types || []).includes(type))?.longText || '';
}

export function placeToLead(place) {
  return makeLead({
    name: place.displayName?.text || '',
    category: place.primaryTypeDisplayName?.text || (place.types || [])[0]?.replace(/_/g, ' ') || '',
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || '',
    website: place.websiteUri || '',
    address: place.formattedAddress || '',
    city: component(place, 'locality') || component(place, 'postal_town'),
    region: component(place, 'administrative_area_level_1'),
    postcode: component(place, 'postal_code'),
    country: component(place, 'country'),
    lat: place.location?.latitude ?? null,
    lng: place.location?.longitude ?? null,
    rating: place.rating ?? null,
    reviews: place.userRatingCount ?? null,
    openingHours: (place.regularOpeningHours?.weekdayDescriptions || []).join('; '),
    source: 'google',
    sourceId: place.id || '',
    sourceUrl: place.googleMapsUri || '',
  });
}

/** Text Search with pagination (20 results per page, 3 pages max per Google's cap). */
export async function searchGoogle(keyword, area, options = {}) {
  const { limit = 60, signal, apiKey = process.env.GOOGLE_MAPS_API_KEY, useCache = true, timeoutMs = 20000 } = options;
  if (!apiKey) throw new Error('Google source needs GOOGLE_MAPS_API_KEY (or pass --source overpass)');

  const leads = [];
  let pageToken = '';
  for (let page = 0; page < 3 && leads.length < limit; page++) {
    const body = {
      textQuery: `${keyword} in ${area.displayName || `${area.lat},${area.lon}`}`,
      pageSize: Math.min(20, limit - leads.length),
      ...(area.lat != null && area.radiusM
        ? {
            locationBias: {
              circle: { center: { latitude: area.lat, longitude: area.lon }, radius: Math.min(area.radiusM, 50_000) },
            },
          }
        : {}),
      ...(pageToken ? { pageToken } : {}),
    };

    const key = cache.key('google', JSON.stringify(body));
    const run = async () => {
      const res = await request(ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        timeoutMs,
        retries: 1,
        signal,
      });
      if (!res.ok) {
        let detail = '';
        try {
          detail = JSON.parse(res.body)?.error?.message || '';
        } catch {
          /* non-JSON error body */
        }
        throw new Error(`Google Places HTTP ${res.status}${detail ? `: ${detail}` : ''}`);
      }
      return JSON.parse(res.body);
    };

    const data = useCache ? await cache.wrap(key, run) : await run();
    for (const place of data.places || []) {
      if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') continue;
      leads.push(placeToLead(place));
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  return leads.slice(0, limit);
}

export const googleSource = {
  name: 'google',
  requiresKey: true,
  search: searchGoogle,
};
