// HTML scraping helpers: contact details, social profiles and tech signals.
// Regex-based on purpose — no DOM dependency, and resilient to broken markup.

const EMAIL_RX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,24}/gi;
const OBFUSCATED_RX =
  /([A-Z0-9._%+-]+)\s*(?:\[|\(|&#91;|\s)?\s*(?:at|@)\s*(?:\]|\)|&#93;|\s)?\s*([A-Z0-9.-]+)\s*(?:\[|\(|\s)?\s*(?:dot|\.)\s*(?:\]|\)|\s)?\s*([A-Z]{2,24})/gi;

const BAD_EMAIL_SUFFIX = /\.(png|jpe?g|gif|svg|webp|css|js|json|ico|woff2?|mp4|pdf)$/i;
const BAD_EMAIL_DOMAIN =
  /(sentry\.io|sentry-cdn|wixpress\.com|example\.(com|org|net)|domain\.com|yourdomain|email\.com|company\.com|sentry\.wixpress|\.png|placeholder)/i;
const ROLE_PREFIX = /^(info|hello|contact|enquiries|enquiry|inquiries|sales|admin|office|support|team|mail|reception|bookings?|hi)@/i;

const SOCIAL_PATTERNS = [
  ['facebook', /^(?:https?:\/\/)?(?:[\w-]+\.)?facebook\.com\/(?!(?:sharer|share\.php|dialog|plugins|tr\b))[^"'\s<>]+/i],
  ['instagram', /^(?:https?:\/\/)?(?:[\w-]+\.)?instagram\.com\/(?!(?:p|reel|explore)\/)[^"'\s<>]+/i],
  ['linkedin', /^(?:https?:\/\/)?(?:[\w-]+\.)?linkedin\.com\/(?:company|in|school)\/[^"'\s<>]+/i],
  ['twitter', /^(?:https?:\/\/)?(?:[\w-]+\.)?(?:twitter|x)\.com\/(?!(?:intent|share|home)\b)[^"'\s<>]+/i],
  ['youtube', /^(?:https?:\/\/)?(?:[\w-]+\.)?(?:youtube\.com\/(?:c|channel|user|@)|youtu\.be\/)[^"'\s<>]*/i],
  ['tiktok', /^(?:https?:\/\/)?(?:[\w-]+\.)?tiktok\.com\/@[^"'\s<>]+/i],
  ['pinterest', /^(?:https?:\/\/)?(?:[\w-]+\.)?pinterest\.[a-z.]{2,6}\/[^"'\s<>]+/i],
  ['yelp', /^(?:https?:\/\/)?(?:[\w-]+\.)?yelp\.[a-z.]{2,6}\/biz\/[^"'\s<>]+/i],
];

const TECH_SIGNALS = [
  ['wordpress', /wp-content|wp-includes|content=["']WordPress/i],
  ['shopify', /cdn\.shopify\.com|Shopify\.theme/i],
  ['wix', /static\.wixstatic\.com|wix-code|X-Wix/i],
  ['squarespace', /squarespace\.com|static1\.squarespace/i],
  ['webflow', /webflow\.(?:com|io)|data-wf-page/i],
  ['godaddy-builder', /godaddysites\.com|wsimg\.com/i],
  ['react', /__NEXT_DATA__|data-reactroot|_next\/static/i],
  ['google-analytics', /gtag\(|googletagmanager\.com|google-analytics\.com/i],
  ['facebook-pixel', /connect\.facebook\.net\/[^"']*fbevents/i],
  ['hubspot', /js\.hs-scripts\.com|hs-analytics/i],
  ['calendly', /calendly\.com/i],
  ['stripe', /js\.stripe\.com/i],
];

export function stripTags(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normaliseEmail(raw) {
  const email = String(raw).trim().toLowerCase().replace(/^mailto:/, '').split('?')[0];
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,24}$/i.test(email)) return null;
  if (BAD_EMAIL_SUFFIX.test(email) || BAD_EMAIL_DOMAIN.test(email)) return null;
  if (/^[0-9a-f]{16,}@/i.test(email)) return null; // hashed/tracking addresses
  return email;
}

/** All plausible contact emails on a page, best-first (role addresses win). */
export function extractEmails(html, { siteDomain } = {}) {
  const found = new Set();
  const push = (value) => {
    const email = normaliseEmail(value);
    if (email) found.add(email);
  };

  for (const m of String(html).matchAll(/mailto:([^"'?\s>]+)/gi)) push(m[1]);
  for (const m of stripTags(html).matchAll(EMAIL_RX)) push(m[0]);
  for (const m of stripTags(html).matchAll(OBFUSCATED_RX)) push(`${m[1]}@${m[2]}.${m[3]}`);

  const rank = (email) => {
    const domain = email.split('@')[1];
    let score = 0;
    if (siteDomain && (domain === siteDomain || domain.endsWith(`.${siteDomain}`))) score -= 4;
    if (ROLE_PREFIX.test(email)) score -= 2;
    if (/(gmail|yahoo|hotmail|outlook|aol|icloud)\./.test(domain)) score += 1;
    if (/(wordpress|wix|squarespace|godaddy|sentry|shopify)/.test(domain)) score += 5;
    return score;
  };

  return [...found].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

export function normalisePhone(raw, { defaultCountryCode = '' } = {}) {
  let value = String(raw).trim();
  const plus = value.trimStart().startsWith('+') || value.startsWith('00');
  value = value.replace(/^00/, '+');
  const digits = value.replace(/[^\d]/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (plus) return `+${digits}`;
  if (defaultCountryCode) {
    const cc = String(defaultCountryCode).replace(/[^\d]/g, '');
    return `+${cc}${digits.replace(/^0+/, '')}`;
  }
  return digits;
}

export function extractPhones(html, opts = {}) {
  const found = new Set();
  for (const m of String(html).matchAll(/tel:([+\d()\s.\-]{6,})/gi)) {
    const phone = normalisePhone(m[1], opts);
    if (phone) found.add(phone);
  }
  const text = stripTags(html);
  for (const m of text.matchAll(/(?:\+|00)?[\d][\d\s().-]{6,18}\d/g)) {
    const candidate = m[0];
    if (/^\d{4}\s?\d{4}$/.test(candidate.trim()) && !/\+/.test(candidate)) continue; // too ambiguous
    if (/(19|20)\d{2}\s*[-–]\s*(19|20)\d{2}/.test(candidate)) continue; // year ranges
    const phone = normalisePhone(candidate, opts);
    if (phone) found.add(phone);
  }
  return [...found].slice(0, 5);
}

export function extractSocials(html) {
  const socials = {};
  const urls = new Set();
  for (const m of String(html).matchAll(/(?:href|content|src)\s*=\s*["']([^"']+)["']/gi)) urls.add(m[1]);
  for (const m of String(html).matchAll(/https?:\/\/[^\s"'<>)]+/gi)) urls.add(m[0]);

  for (const url of urls) {
    const clean = url.replace(/^\/\//, 'https://').split(/[?#]/)[0].replace(/\/$/, '');
    const bare = clean.replace(/^https?:\/\//i, '');
    for (const [network, rx] of SOCIAL_PATTERNS) {
      if (socials[network]) continue;
      if (rx.test(bare)) socials[network] = clean.startsWith('http') ? clean : `https://${clean}`;
    }
  }
  return socials;
}

export function extractMeta(html) {
  const pick = (rx) => (String(html).match(rx)?.[1] || '').trim();
  const title = pick(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    pick(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
    pick(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const years = [...String(html).matchAll(/(?:©|&copy;|copyright)[^<]{0,40}?((?:19|20)\d{2})/gi)].map((m) => Number(m[1]));
  return {
    title: stripTags(title).slice(0, 200),
    description: stripTags(description).slice(0, 300),
    hasViewport: /<meta[^>]+name=["']viewport["']/i.test(html),
    hasContactForm: /<form[\s\S]{0,400}?(?:type=["']email["']|name=["'][^"']*email)/i.test(html),
    hasSchemaLocalBusiness: /"@type"\s*:\s*"(?:LocalBusiness|[A-Za-z]*(?:Store|Restaurant|Dentist|Business))"/i.test(html),
    copyrightYear: years.length ? Math.max(...years) : null,
  };
}

export function detectTech(html, headers = {}) {
  const hay = `${html}\n${Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')}`;
  return TECH_SIGNALS.filter(([, rx]) => rx.test(hay)).map(([name]) => name);
}

/** Internal links that most often hold contact details. */
export function findContactLinks(html, baseUrl, limit = 3) {
  const wanted = /(contact|about|impressum|kontakt|get-in-touch|reach-us|team|support|legal|privacy)/i;
  const out = [];
  const seen = new Set();
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    return out;
  }
  for (const m of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1];
    const label = stripTags(m[2]);
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) continue;
    if (!wanted.test(href) && !wanted.test(label)) continue;
    let abs;
    try {
      abs = new URL(href, base);
    } catch {
      continue;
    }
    if (abs.hostname !== base.hostname) continue;
    abs.hash = '';
    const key = abs.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= limit) break;
  }
  return out;
}

export function registrableDomain(urlOrHost) {
  try {
    const host = urlOrHost.includes('://') ? new URL(urlOrHost).hostname : urlOrHost;
    return host.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}
