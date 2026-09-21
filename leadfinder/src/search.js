// Orchestrator: location → source query → dedupe → enrich → score → filter → sort.
import { resolveArea } from './geocode.js';
import { overpassSource } from './sources/overpass.js';
import { googleSource } from './sources/google.js';
import { enrichWebsite } from './enrich.js';
import { applyEnrichment, makeLead } from './lead.js';
import { withScore } from './score.js';
import { dedupeLeads } from './dedupe.js';
import { mapPool } from './http.js';

export const SOURCES = {
  overpass: overpassSource,
  openstreetmap: overpassSource,
  osm: overpassSource,
  google: googleSource,
};

export const SORTS = {
  score: (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  rating: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
  reviews: (a, b) => (b.reviews ?? -1) - (a.reviews ?? -1),
};

export function applyFilters(leads, filters = {}) {
  const { requireEmail, requirePhone, requireWebsite, withoutWebsite, minScore = 0, minRating, category } = filters;
  return leads.filter((lead) => {
    if (requireEmail && !lead.email) return false;
    if (requirePhone && !lead.phone) return false;
    if (requireWebsite && !lead.website) return false;
    if (withoutWebsite && lead.website) return false;
    if (minScore && (lead.score ?? 0) < minScore) return false;
    if (minRating != null && !(typeof lead.rating === 'number' && lead.rating >= minRating)) return false;
    if (category && !new RegExp(category, 'i').test(`${lead.category} ${lead.name}`)) return false;
    return true;
  });
}

/**
 * Run a full lead search.
 *
 * @param {object} opts
 * @param {string|string[]} opts.keyword  Niche(s), e.g. "dentist" or ["dentist","orthodontist"].
 * @param {string} opts.location          Place name or "lat,lng".
 * @param {number} [opts.radiusKm=10]
 * @param {number} [opts.limit=100]
 * @param {'overpass'|'google'} [opts.source='overpass']
 * @param {boolean} [opts.enrich=true]    Visit websites for emails/socials/tech.
 * @param {function} [opts.onProgress]    Receives {phase, message, done, total}.
 */
export async function findLeads(opts = {}) {
  const {
    keyword,
    location,
    radiusKm = 10,
    limit = 100,
    source = 'overpass',
    enrich = true,
    concurrency = 6,
    maxPages = 3,
    respectRobots = true,
    filters = {},
    sort = 'score',
    signal,
    useCache = true,
    onProgress = () => {},
  } = opts;

  const keywords = (Array.isArray(keyword) ? keyword : String(keyword || '').split(','))
    .map((k) => k.trim())
    .filter(Boolean);
  if (!keywords.length) throw new Error('keyword is required (e.g. "dentist")');
  if (!location) throw new Error('location is required (e.g. "Dublin, Ireland" or "53.34,-6.26")');

  const picked = SOURCES[String(source).toLowerCase()];
  if (!picked) throw new Error(`unknown source "${source}" (use: overpass, google)`);

  const progress = (phase, message, extra = {}) => onProgress({ phase, message, ...extra });

  progress('geocode', `Resolving ${location}…`);
  const area = await resolveArea(location, { radiusKm, signal, useCache });
  progress('geocode', `Area: ${area.displayName} (${radiusKm} km radius)`, { area });

  let collected = [];
  for (const [i, kw] of keywords.entries()) {
    progress('search', `Searching ${picked.name} for "${kw}"…`, { done: i, total: keywords.length });
    const found = await picked.search(kw, area, { limit: limit * 2, signal, useCache });
    progress('search', `"${kw}": ${found.length} raw results`, { done: i + 1, total: keywords.length });
    collected = collected.concat(found.map((l) => makeLead({ ...l, searchKeyword: kw })));
  }

  let leads = dedupeLeads(collected);
  progress('dedupe', `${leads.length} unique businesses after de-duplication`, { total: leads.length });

  // Trim before enrichment — crawling is the expensive step.
  const preScored = leads.map((lead) => withScore(lead));
  const shortlist = applyFilters(preScored, { ...filters, requireEmail: false, minScore: 0 })
    .sort(SORTS[sort] || SORTS.score)
    .slice(0, Math.max(limit, 0) || preScored.length);

  if (enrich) {
    const targets = shortlist.filter((l) => l.website);
    progress('enrich', `Enriching ${targets.length} websites…`, { done: 0, total: targets.length });
    let done = 0;
    const enriched = await mapPool(targets, concurrency, async (lead) => {
      const data = await enrichWebsite(lead.website, {
        maxPages,
        respectRobots,
        signal,
        defaultCountryCode: '',
      });
      done++;
      progress('enrich', `${lead.name}`, { done, total: targets.length, lead: lead.name });
      return applyEnrichment(lead, data);
    });

    const byId = new Map();
    for (const item of enriched) {
      if (!item || item.error) continue;
      byId.set(`${item.source}:${item.sourceId}`, item);
    }
    leads = shortlist.map((lead) => byId.get(`${lead.source}:${lead.sourceId}`) || lead);
  } else {
    leads = shortlist;
  }

  progress('score', 'Scoring leads…', { total: leads.length });
  leads = leads.map((lead) => withScore(lead));
  leads = applyFilters(leads, filters).sort(SORTS[sort] || SORTS.score);
  if (limit > 0) leads = leads.slice(0, limit);

  const stats = summarise(leads);
  progress('done', `${leads.length} leads ready`, { total: leads.length, stats });
  return { leads, area, stats, keywords, source: picked.name };
}

export function summarise(leads) {
  const count = leads.length;
  const withEmail = leads.filter((l) => l.email).length;
  const withPhone = leads.filter((l) => l.phone).length;
  const withWebsite = leads.filter((l) => l.website).length;
  const avgScore = count ? Math.round(leads.reduce((sum, l) => sum + (l.score || 0), 0) / count) : 0;
  const topOpportunities = {};
  for (const lead of leads) for (const opp of lead.opportunities || []) topOpportunities[opp] = (topOpportunities[opp] || 0) + 1;
  return {
    count,
    withEmail,
    withPhone,
    withWebsite,
    withoutWebsite: count - withWebsite,
    avgScore,
    topOpportunities: Object.entries(topOpportunities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, n]) => ({ name, count: n })),
  };
}
