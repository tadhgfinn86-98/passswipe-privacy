// Minimal HTTP helpers: timeouts, retries, byte caps and a concurrency pool.
// Zero dependencies — Node 20+ global fetch only.

export const DEFAULT_UA =
  process.env.D7_USER_AGENT ||
  'd7-leads-finder/1.0 (+https://github.com/tadhgfinn86-98/passswipe-privacy; contact: set D7_USER_AGENT)';

export class HttpError extends Error {
  constructor(message, { status = 0, url = '' } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Bounded-concurrency task runner. Results keep input order. */
export async function mapPool(items, limit, worker) {
  const list = [...items];
  const results = new Array(list.length);
  let next = 0;
  const size = Math.max(1, Math.min(limit, list.length || 1));
  const runners = Array.from({ length: size }, async () => {
    for (;;) {
      const i = next++;
      if (i >= list.length) return;
      try {
        results[i] = await worker(list[i], i);
      } catch (err) {
        results[i] = { error: err };
      }
    }
  });
  await Promise.all(runners);
  return results;
}

/** Serialises calls to a host so we never hammer a free API. */
export class RateLimiter {
  constructor(minIntervalMs = 0) {
    this.minIntervalMs = minIntervalMs;
    this.chain = Promise.resolve();
    this.last = 0;
  }

  run(fn) {
    const task = this.chain.then(async () => {
      const wait = this.last + this.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await fn();
      } finally {
        this.last = Date.now();
      }
    });
    // Keep the chain alive even when a task rejects.
    this.chain = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
}

/**
 * fetch with timeout, retry-on-transient and a response size cap.
 * Returns { ok, status, url, headers, body } — body is '' for non-text types.
 */
export async function request(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 15000,
    retries = 2,
    retryDelayMs = 700,
    maxBytes = 1_500_000,
    acceptText = true,
    signal,
  } = options;

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const onAbort = () => ac.abort(signal?.reason);
    if (signal) {
      if (signal.aborted) throw new HttpError('aborted', { url });
      signal.addEventListener('abort', onAbort, { once: true });
    }
    const timer = setTimeout(() => ac.abort(new Error('timeout')), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'user-agent': DEFAULT_UA, accept: '*/*', ...headers },
        body,
        redirect: 'follow',
        signal: ac.signal,
      });

      const retryable = res.status === 429 || res.status === 408 || res.status >= 500;
      if (retryable && attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : retryDelayMs * (attempt + 1));
        continue;
      }

      const type = res.headers.get('content-type') || '';
      const textual = /text\/|json|xml|javascript|html/i.test(type) || !type;
      let text = '';
      if (acceptText && textual) {
        text = await readCapped(res, maxBytes);
      } else {
        try {
          await res.body?.cancel();
        } catch {
          /* already consumed */
        }
      }
      return {
        ok: res.ok,
        status: res.status,
        url: res.url || url,
        headers: res.headers,
        body: text,
      };
    } catch (err) {
      lastErr = err;
      if (signal?.aborted) throw new HttpError('aborted', { url });
      if (attempt < retries) await sleep(retryDelayMs * (attempt + 1));
    } finally {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', onAbort);
    }
  }
  throw new HttpError(`request failed: ${lastErr?.message || 'unknown error'}`, { url });
}

async function readCapped(res, maxBytes) {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    chunks.push(value);
    if (total >= maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString('utf8');
}

export async function getJSON(url, options = {}) {
  const res = await request(url, { ...options, headers: { accept: 'application/json', ...(options.headers || {}) } });
  if (!res.ok) throw new HttpError(`HTTP ${res.status}`, { status: res.status, url });
  try {
    return JSON.parse(res.body);
  } catch {
    throw new HttpError('invalid JSON response', { status: res.status, url });
  }
}
