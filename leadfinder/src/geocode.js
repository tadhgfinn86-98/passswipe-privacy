// Location resolution via OpenStreetMap Nominatim (keyless, 1 req/sec policy).
import { getJSON, RateLimiter } from './http.js';
import { DiskCache } from './cache.js';

const nominatimLimiter = new RateLimiter(1100);
const cache = new DiskCache({ ttlMs: 30 * 24 * 60 * 60 * 1000 });

export const NOMINATIM_URL = process.env.D7_NOMINATIM_URL || 'https://nominatim.openstreetmap.org/search';

/** Metres → degrees box around a point (latitude-corrected). */
export function bboxAround(lat, lon, radiusMetres) {
  const dLat = radiusMetres / 111_320;
  const dLon = radiusMetres / (111_320 * Math.max(Math.cos((lat * Math.PI) / 180), 0.01));
  return {
    south: +(lat - dLat).toFixed(6),
    west: +(lon - dLon).toFixed(6),
    north: +(lat + dLat).toFixed(6),
    east: +(lon + dLon).toFixed(6),
  };
}

/** "53.34,-6.26" → coordinates, so users can skip geocoding entirely. */
export function parseLatLng(input) {
  const m = String(input).trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon };
}

export async function geocode(place, { signal, useCache = true } = {}) {
  const direct = parseLatLng(place);
  if (direct) {
    return { displayName: `${direct.lat}, ${direct.lon}`, lat: direct.lat, lon: direct.lon, countryCode: '', bbox: null };
  }

  const key = cache.key('nominatim', place);
  const run = async () => {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(place)}&format=jsonv2&limit=1&addressdetails=1`;
    const data = await nominatimLimiter.run(() => getJSON(url, { timeoutMs: 15000, signal }));
    if (!Array.isArray(data) || !data.length) throw new Error(`could not geocode location: "${place}"`);
    const hit = data[0];
    const [s, n, w, e] = (hit.boundingbox || []).map(Number);
    return {
      displayName: hit.display_name,
      lat: Number(hit.lat),
      lon: Number(hit.lon),
      countryCode: (hit.address?.country_code || '').toUpperCase(),
      bbox: Number.isFinite(s) ? { south: s, north: n, west: w, east: e } : null,
    };
  };

  return useCache ? cache.wrap(key, run) : run();
}

/** Resolve a user location + radius into the search area used by sources. */
export async function resolveArea(place, { radiusKm = 10, signal, useCache = true } = {}) {
  const geo = await geocode(place, { signal, useCache });
  const radiusM = Math.round(Math.max(0.5, radiusKm) * 1000);
  return {
    ...geo,
    radiusM,
    bbox: bboxAround(geo.lat, geo.lon, radiusM),
  };
}
