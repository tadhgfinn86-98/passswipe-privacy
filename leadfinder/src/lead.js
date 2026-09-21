// Canonical lead shape shared by every source, plus CSV flattening.
import { registrableDomain, normalisePhone } from './extract.js';
import { normaliseWebsite } from './enrich.js';

export const CSV_COLUMNS = [
  'name',
  'category',
  'phone',
  'email',
  'website',
  'domain',
  'address',
  'city',
  'region',
  'postcode',
  'country',
  'lat',
  'lng',
  'rating',
  'reviews',
  'has_website',
  'website_live',
  'https',
  'mobile_friendly',
  'contact_form',
  'facebook',
  'instagram',
  'linkedin',
  'twitter',
  'youtube',
  'tiktok',
  'score',
  'opportunities',
  'emails_all',
  'phones_all',
  'tech',
  'opening_hours',
  'title',
  'description',
  'source',
  'source_id',
  'source_url',
  'found_at',
];

/** Tidy international numbers; leave national formats as the source wrote them. */
function tidyPhone(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return /^(\+|00)/.test(value) ? normalisePhone(value) || value : value.replace(/\s+/g, ' ');
}

export function makeLead(partial = {}) {
  const website = normaliseWebsite(partial.website || '');
  return {
    name: (partial.name || '').trim(),
    category: partial.category || '',
    phone: tidyPhone(partial.phone),
    email: partial.email || '',
    emails: partial.emails || [],
    phones: partial.phones || [],
    website,
    domain: website ? registrableDomain(website) : '',
    address: partial.address || '',
    city: partial.city || '',
    region: partial.region || '',
    postcode: partial.postcode || '',
    country: partial.country || '',
    lat: partial.lat ?? null,
    lng: partial.lng ?? null,
    rating: partial.rating ?? null,
    reviews: partial.reviews ?? null,
    openingHours: partial.openingHours || '',
    socials: partial.socials || {},
    websiteLive: partial.websiteLive ?? null,
    https: partial.https ?? null,
    mobileFriendly: partial.mobileFriendly ?? null,
    hasContactForm: partial.hasContactForm ?? null,
    tech: partial.tech || [],
    title: partial.title || '',
    description: partial.description || '',
    score: partial.score ?? null,
    opportunities: partial.opportunities || [],
    source: partial.source || '',
    sourceId: partial.sourceId || '',
    sourceUrl: partial.sourceUrl || '',
    foundAt: partial.foundAt || new Date().toISOString(),
  };
}

/** Merge enrichment output back onto a lead. */
export function applyEnrichment(lead, enrichment) {
  const socials = { ...enrichment.socials, ...lead.socials };
  const emails = [...new Set([...(lead.email ? [lead.email] : []), ...enrichment.emails])];
  const phones = [...new Set([...(lead.phone ? [lead.phone] : []), ...enrichment.phones])];
  return {
    ...lead,
    email: emails[0] || '',
    emails,
    phone: lead.phone || phones[0] || '',
    phones,
    socials,
    websiteLive: enrichment.reachable,
    https: enrichment.https,
    mobileFriendly: enrichment.mobileFriendly,
    hasContactForm: enrichment.hasContactForm,
    tech: enrichment.tech,
    title: lead.title || enrichment.title,
    description: lead.description || enrichment.description,
    copyrightYear: enrichment.copyrightYear,
    responseMs: enrichment.responseMs,
    pagesCrawled: enrichment.pagesCrawled,
    enrichError: enrichment.error || '',
  };
}

const bool = (v) => (v === null || v === undefined ? '' : v ? 'yes' : 'no');

export function toRow(lead) {
  return {
    name: lead.name,
    category: lead.category,
    phone: lead.phone,
    email: lead.email,
    website: lead.website,
    domain: lead.domain,
    address: lead.address,
    city: lead.city,
    region: lead.region,
    postcode: lead.postcode,
    country: lead.country,
    lat: lead.lat ?? '',
    lng: lead.lng ?? '',
    rating: lead.rating ?? '',
    reviews: lead.reviews ?? '',
    has_website: bool(Boolean(lead.website)),
    website_live: bool(lead.websiteLive),
    https: bool(lead.https),
    mobile_friendly: bool(lead.mobileFriendly),
    contact_form: bool(lead.hasContactForm),
    facebook: lead.socials.facebook || '',
    instagram: lead.socials.instagram || '',
    linkedin: lead.socials.linkedin || '',
    twitter: lead.socials.twitter || '',
    youtube: lead.socials.youtube || '',
    tiktok: lead.socials.tiktok || '',
    score: lead.score ?? '',
    opportunities: (lead.opportunities || []).join('; '),
    emails_all: (lead.emails || []).join('; '),
    phones_all: (lead.phones || []).join('; '),
    tech: (lead.tech || []).join('; '),
    opening_hours: lead.openingHours,
    title: lead.title,
    description: lead.description,
    source: lead.source,
    source_id: lead.sourceId,
    source_url: lead.sourceUrl,
    found_at: lead.foundAt,
  };
}
