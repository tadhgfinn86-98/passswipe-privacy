// Default source: OpenStreetMap via Overpass API. Free, keyless, worldwide.
import { request, RateLimiter } from '../http.js';
import { DiskCache } from '../cache.js';
import { makeLead } from '../lead.js';
import { tagsForKeyword, categoryFromTags, escapeRegex, GENERIC_KEYS } from './keywords.js';

export const OVERPASS_ENDPOINTS = (process.env.D7_OVERPASS_URL || 'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const limiter = new RateLimiter(1200);
const cache = new DiskCache();

/** Build Overpass QL for a keyword within an area ({radiusM,lat,lon} or bbox). */
export function buildOverpassQuery(keyword, area, { timeoutSec = 90, limit = 500 } = {}) {
  const filter =
    area.radiusM && area.lat != null
      ? `(around:${Math.round(area.radiusM)},${area.lat},${area.lon})`
      : `(${area.bbox.south},${area.bbox.west},${area.bbox.north},${area.bbox.east})`;

  const exact = tagsForKeyword(keyword);
  const clauses = [];
  if (exact.length) {
    for (const [k, v] of exact) clauses.push(`nwr["${k}"="${v}"]${filter};`);
  } else {
    // Escape first, then let whitespace become a wildcard: "escape room" → escape.room
    const rx = escapeRegex(String(keyword).trim()).replace(/\s+/g, '.');
    for (const key of GENERIC_KEYS) clauses.push(`nwr["${key}"~"${rx}",i]${filter};`);
    clauses.push(`nwr["name"~"${rx}",i]["shop"]${filter};`);
    clauses.push(`nwr["name"~"${rx}",i]["amenity"]${filter};`);
    clauses.push(`nwr["name"~"${rx}",i]["office"]${filter};`);
    clauses.push(`nwr["name"~"${rx}",i]["craft"]${filter};`);
  }

  return `[out:json][timeout:${timeoutSec}];\n(\n  ${clauses.join('\n  ')}\n);\nout center tags ${Math.max(1, limit)};`;
}

function addressFromTags(tags) {
  const line = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
  const parts = [line, tags['addr:suburb'], tags['addr:city'] || tags['addr:town'] || tags['addr:village']].filter(Boolean);
  return {
    address: parts.join(', ') || tags['addr:full'] || '',
    city: tags['addr:city'] || tags['addr:town'] || tags['addr:village'] || '',
    region: tags['addr:state'] || tags['addr:county'] || '',
    postcode: tags['addr:postcode'] || '',
    country: tags['addr:country'] || '',
  };
}

function socialsFromTags(tags) {
  const socials = {};
  const map = {
    facebook: ['contact:facebook', 'facebook'],
    instagram: ['contact:instagram', 'instagram'],
    linkedin: ['contact:linkedin', 'linkedin'],
    twitter: ['contact:twitter', 'twitter'],
    youtube: ['contact:youtube', 'youtube'],
    tiktok: ['contact:tiktok', 'tiktok'],
  };
  for (const [network, keys] of Object.entries(map)) {
    for (const key of keys) {
      const value = tags[key];
      if (!value) continue;
      socials[network] = /^https?:\/\//i.test(value)
        ? value
        : `https://www.${network === 'twitter' ? 'twitter' : network}.com/${String(value).replace(/^@/, '')}`;
      break;
    }
  }
  return socials;
}

export function elementToLead(el) {
  const tags = el.tags || {};
  if (!tags.name) return null;
  const lat = el.lat ?? el.center?.lat ?? null;
  const lon = el.lon ?? el.center?.lon ?? null;
  return makeLead({
    name: tags.name,
    category: categoryFromTags(tags),
    phone: tags.phone || tags['contact:phone'] || tags['contact:mobile'] || '',
    email: (tags.email || tags['contact:email'] || '').toLowerCase(),
    website: tags.website || tags['contact:website'] || tags.url || '',
    ...addressFromTags(tags),
    lat,
    lng: lon,
    openingHours: tags.opening_hours || '',
    socials: socialsFromTags(tags),
    source: 'openstreetmap',
    sourceId: `${el.type}/${el.id}`,
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  });
}

async function postOverpass(query, { signal, timeoutMs }) {
  let lastErr;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await limiter.run(() =>
        request(endpoint, {
          method: 'POST',
          body: new URLSearchParams({ data: query }).toString(),
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          timeoutMs,
          retries: 1,
          maxBytes: 12_000_000,
          signal,
        }),
      );
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      return JSON.parse(res.body);
    } catch (err) {
      lastErr = err;
    }
  }
  throw new Error(`Overpass request failed: ${lastErr?.message || 'unknown error'}`);
}

/** Search OpenStreetMap for businesses matching `keyword` inside `area`. */
export async function searchOverpass(keyword, area, options = {}) {
  const { limit = 200, signal, timeoutMs = 120_000, useCache = true } = options;
  const query = buildOverpassQuery(keyword, area, { limit: limit * 3 });
  const key = cache.key('overpass', query);

  const run = async () => {
    const data = await postOverpass(query, { signal, timeoutMs });
    return (data.elements || []).map(elementToLead).filter(Boolean);
  };

  const leads = useCache ? await cache.wrap(key, run) : await run();
  return leads.map((lead) => makeLead(lead));
}

export const overpassSource = {
  name: 'openstreetmap',
  requiresKey: false,
  search: searchOverpass,
};
