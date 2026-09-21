// Small robots.txt parser. We only need "may this UA fetch this path".
import { request } from './http.js';

export function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === 'user-agent') {
      if (!current || current.rules.length) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((field === 'allow' || field === 'disallow') && current) {
      current.rules.push({ allow: field === 'allow', path: value });
    } else if (field === 'crawl-delay' && current) {
      const n = Number(value);
      if (Number.isFinite(n)) current.crawlDelay = n;
    }
  }
  return groups;
}

function matchLength(pattern, path) {
  if (pattern === '') return -1;
  // Support the de-facto '*' wildcard and '$' end anchor.
  const hasEnd = pattern.endsWith('$');
  const body = hasEnd ? pattern.slice(0, -1) : pattern;
  const rx = new RegExp(
    '^' +
      body
        .split('*')
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('.*') +
      (hasEnd ? '$' : ''),
  );
  return rx.test(path) ? body.length : -1;
}

/** True when `path` is crawlable for `ua` under the parsed robots groups. */
export function isAllowed(groups, path, ua = 'd7-leads-finder') {
  if (!groups.length) return true;
  const agent = ua.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const wildcard = groups.filter((g) => g.agents.includes('*'));
  const applicable = specific.length ? specific : wildcard;
  if (!applicable.length) return true;

  let best = { len: -1, allow: true };
  for (const group of applicable) {
    for (const rule of group.rules) {
      const len = matchLength(rule.path, path);
      if (len > best.len || (len === best.len && rule.allow)) best = { len, allow: rule.allow };
    }
  }
  return best.len === -1 ? true : best.allow;
}

export function crawlDelay(groups, ua = 'd7-leads-finder') {
  const agent = ua.toLowerCase();
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
  const wildcard = groups.find((g) => g.agents.includes('*'));
  return (specific || wildcard)?.crawlDelay ?? 0;
}

const robotsByOrigin = new Map();

/** Fetch + cache robots.txt per origin. Unreachable robots.txt means "allowed". */
export async function robotsFor(origin, { timeoutMs = 8000, ua } = {}) {
  if (robotsByOrigin.has(origin)) return robotsByOrigin.get(origin);
  const promise = (async () => {
    try {
      const res = await request(`${origin}/robots.txt`, { timeoutMs, retries: 0, maxBytes: 120_000 });
      if (!res.ok || !res.body) return { groups: [], delay: 0 };
      const groups = parseRobots(res.body);
      return { groups, delay: crawlDelay(groups, ua) };
    } catch {
      return { groups: [], delay: 0 };
    }
  })();
  robotsByOrigin.set(origin, promise);
  return promise;
}

export async function canFetch(url, { ua = 'd7-leads-finder', respect = true } = {}) {
  if (!respect) return true;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const { groups } = await robotsFor(parsed.origin, { ua });
  return isAllowed(groups, parsed.pathname + parsed.search, ua);
}

export function _resetRobotsCache() {
  robotsByOrigin.clear();
}
