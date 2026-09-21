// De-duplication across sources: same business found twice should merge, not repeat.
const noise = /\b(ltd|limited|llc|inc|plc|gmbh|bv|srl|the|and|co|company|group)\b/gi;

export function normaliseName(name) {
  return String(name)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(noise, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function digits(value) {
  return String(value || '').replace(/\D/g, '').slice(-9);
}

export function leadKeys(lead) {
  const keys = [];
  if (lead.domain) keys.push(`domain:${lead.domain}`);
  const phone = digits(lead.phone);
  if (phone.length >= 7) keys.push(`phone:${phone}`);
  const name = normaliseName(lead.name);
  if (name) keys.push(`name:${name}|${normaliseName(lead.city || '')}`);
  return keys;
}

function prefer(a, b) {
  // Google records carry ratings/verified phones, so they win ties.
  if (a.source === b.source) return a;
  if (a.source === 'google') return a;
  if (b.source === 'google') return b;
  return a;
}

export function mergeLeads(a, b) {
  const primary = prefer(a, b);
  const secondary = primary === a ? b : a;
  const pick = (key) => primary[key] || secondary[key] || (typeof primary[key] === 'number' ? primary[key] : '');
  return {
    ...secondary,
    ...primary,
    name: pick('name'),
    category: pick('category'),
    phone: pick('phone'),
    email: pick('email'),
    website: pick('website'),
    domain: pick('domain'),
    address: pick('address'),
    city: pick('city'),
    region: pick('region'),
    postcode: pick('postcode'),
    country: pick('country'),
    openingHours: pick('openingHours'),
    rating: primary.rating ?? secondary.rating ?? null,
    reviews: primary.reviews ?? secondary.reviews ?? null,
    emails: [...new Set([...(primary.emails || []), ...(secondary.emails || [])])],
    phones: [...new Set([...(primary.phones || []), ...(secondary.phones || [])])],
    socials: { ...secondary.socials, ...primary.socials },
    tech: [...new Set([...(primary.tech || []), ...(secondary.tech || [])])],
    source: primary.source === secondary.source ? primary.source : `${primary.source}+${secondary.source}`,
  };
}

/** Collapse duplicates; later entries merge into the first match. */
export function dedupeLeads(leads) {
  const byKey = new Map();
  const out = [];

  for (const lead of leads) {
    const keys = leadKeys(lead);
    const hitIndex = keys.map((k) => byKey.get(k)).find((i) => i !== undefined);
    if (hitIndex === undefined) {
      const index = out.push(lead) - 1;
      for (const key of keys) byKey.set(key, index);
    } else {
      out[hitIndex] = mergeLeads(out[hitIndex], lead);
      for (const key of leadKeys(out[hitIndex])) if (!byKey.has(key)) byKey.set(key, hitIndex);
    }
  }
  return out;
}
