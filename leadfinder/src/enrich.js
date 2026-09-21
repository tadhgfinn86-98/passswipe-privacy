// Website enrichment: visit a lead's site, pull contact details + tech signals.
import { request, RateLimiter } from './http.js';
import { canFetch, robotsFor } from './robots.js';
import {
  extractEmails,
  extractPhones,
  extractSocials,
  extractMeta,
  detectTech,
  findContactLinks,
  registrableDomain,
} from './extract.js';

const hostLimiters = new Map();

function limiterFor(host, delaySeconds) {
  const wait = Math.min(Math.max(delaySeconds * 1000, 350), 5000);
  let limiter = hostLimiters.get(host);
  if (!limiter) {
    limiter = new RateLimiter(wait);
    hostLimiters.set(host, limiter);
  } else if (wait > limiter.minIntervalMs) {
    limiter.minIntervalMs = wait;
  }
  return limiter;
}

export function normaliseWebsite(raw) {
  if (!raw) return '';
  let value = String(raw).trim();
  if (!value || /^(n\/?a|none|-)$/i.test(value)) return '';
  if (!/^https?:\/\//i.test(value)) value = `https://${value.replace(/^\/+/, '')}`;
  try {
    const url = new URL(value);
    if (!url.hostname.includes('.')) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Crawl a business website politely and return contact + quality signals.
 * Never throws — failures come back as { reachable: false, error }.
 */
export async function enrichWebsite(website, options = {}) {
  const {
    timeoutMs = 12000,
    maxPages = 3,
    respectRobots = true,
    ua = 'd7-leads-finder',
    defaultCountryCode = '',
    signal,
  } = options;

  const start = normaliseWebsite(website);
  const result = {
    website: start,
    reachable: false,
    finalUrl: '',
    httpStatus: 0,
    https: false,
    emails: [],
    phones: [],
    socials: {},
    tech: [],
    title: '',
    description: '',
    mobileFriendly: false,
    hasContactForm: false,
    hasSchema: false,
    copyrightYear: null,
    pagesCrawled: 0,
    responseMs: 0,
    error: '',
  };
  if (!start) {
    result.error = 'no website';
    return result;
  }

  const host = new URL(start).hostname;
  const domain = registrableDomain(start);
  const { delay } = await robotsFor(new URL(start).origin, { ua }).catch(() => ({ delay: 0 }));
  const limiter = limiterFor(host, delay);

  const fetchPage = async (url) => {
    if (!(await canFetch(url, { ua, respect: respectRobots }))) return null;
    return limiter.run(async () => {
      const t0 = Date.now();
      const res = await request(url, {
        timeoutMs,
        retries: 1,
        maxBytes: 900_000,
        headers: { accept: 'text/html,application/xhtml+xml' },
        signal,
      });
      return { ...res, ms: Date.now() - t0 };
    });
  };

  let home;
  try {
    home = await fetchPage(start);
  } catch (err) {
    // A failed https handshake is common on small-business sites; try http once.
    if (start.startsWith('https://')) {
      try {
        home = await fetchPage(start.replace(/^https:/, 'http:'));
      } catch (err2) {
        result.error = err2.message;
      }
    } else {
      result.error = err.message;
    }
  }

  if (!home) {
    if (!result.error) result.error = respectRobots ? 'blocked by robots.txt' : 'unreachable';
    return result;
  }

  result.reachable = home.ok;
  result.httpStatus = home.status;
  result.finalUrl = home.url;
  result.https = home.url.startsWith('https://');
  result.responseMs = home.ms;
  result.pagesCrawled = 1;

  const headerObj = Object.fromEntries(home.headers?.entries?.() || []);
  const pages = [home.body];

  const meta = extractMeta(home.body);
  Object.assign(result, {
    title: meta.title,
    description: meta.description,
    mobileFriendly: meta.hasViewport,
    hasContactForm: meta.hasContactForm,
    hasSchema: meta.hasSchemaLocalBusiness,
    copyrightYear: meta.copyrightYear,
  });

  let emails = extractEmails(home.body, { siteDomain: domain });
  let socials = extractSocials(home.body);

  // Only dig deeper when the homepage didn't already give us an address.
  if (!emails.length && maxPages > 1) {
    for (const link of findContactLinks(home.body, home.url, maxPages - 1)) {
      let page;
      try {
        page = await fetchPage(link);
      } catch {
        continue;
      }
      if (!page?.ok || !page.body) continue;
      result.pagesCrawled++;
      pages.push(page.body);
      emails = [...emails, ...extractEmails(page.body, { siteDomain: domain })];
      socials = { ...extractSocials(page.body), ...socials };
      if (!result.hasContactForm) result.hasContactForm = extractMeta(page.body).hasContactForm;
      if (emails.length) break;
    }
  }

  const allHtml = pages.join('\n');
  result.emails = [...new Set(emails)].slice(0, 5);
  result.phones = extractPhones(allHtml, { defaultCountryCode });
  result.socials = socials;
  result.tech = detectTech(allHtml, headerObj);
  return result;
}

export function _resetHostLimiters() {
  hostLimiters.clear();
}
