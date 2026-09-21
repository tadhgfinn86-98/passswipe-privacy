// Tiny on-disk JSON cache so repeated searches don't re-hit public APIs.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

export class DiskCache {
  constructor({ dir = process.env.D7_CACHE_DIR || '.d7cache', ttlMs = 24 * 60 * 60 * 1000, enabled = true } = {}) {
    this.dir = dir;
    this.ttlMs = ttlMs;
    this.enabled = enabled;
    this.ready = null;
  }

  key(...parts) {
    return createHash('sha1').update(parts.map(String).join('\u0000')).digest('hex');
  }

  async #init() {
    if (!this.ready) this.ready = mkdir(this.dir, { recursive: true });
    return this.ready;
  }

  async get(key) {
    if (!this.enabled) return undefined;
    try {
      await this.#init();
      const raw = await readFile(join(this.dir, `${key}.json`), 'utf8');
      const entry = JSON.parse(raw);
      if (this.ttlMs > 0 && Date.now() - entry.at > this.ttlMs) return undefined;
      return entry.value;
    } catch {
      return undefined;
    }
  }

  async set(key, value) {
    if (!this.enabled) return;
    try {
      await this.#init();
      await writeFile(join(this.dir, `${key}.json`), JSON.stringify({ at: Date.now(), value }), 'utf8');
    } catch {
      /* cache failures are never fatal */
    }
  }

  /** get-or-compute helper. */
  async wrap(key, fn) {
    const hit = await this.get(key);
    if (hit !== undefined) return hit;
    const value = await fn();
    await this.set(key, value);
    return value;
  }

  async clear() {
    await rm(this.dir, { recursive: true, force: true });
    this.ready = null;
  }
}

/** Process-local cache — used by the server so one run reuses lookups. */
export const memoryCache = new Map();
