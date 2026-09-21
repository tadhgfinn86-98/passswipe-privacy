// Local web UI: search form, live progress over SSE, CSV/JSON download.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { findLeads } from '../src/search.js';
import { render } from '../src/export.js';

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), 'public');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Recent results, kept in memory so the UI can download exports.
const results = new Map();
const MAX_RESULTS = 20;

function remember(payload) {
  const id = randomUUID();
  results.set(id, { ...payload, at: Date.now() });
  while (results.size > MAX_RESULTS) results.delete(results.keys().next().value);
  return id;
}

const bool = (v) => v === '1' || v === 'true' || v === 'on';

export function searchParamsToOptions(params) {
  const num = (key, fallback) => {
    const n = Number(params.get(key));
    return Number.isFinite(n) && params.get(key) !== null && params.get(key) !== '' ? n : fallback;
  };
  return {
    keyword: params.get('keyword') || '',
    location: params.get('location') || '',
    radiusKm: num('radius', 10),
    limit: Math.min(num('limit', 50), 500),
    source: params.get('source') || 'overpass',
    enrich: params.get('enrich') === null ? true : bool(params.get('enrich')),
    concurrency: Math.min(num('concurrency', 6), 12),
    sort: params.get('sort') || 'score',
    filters: {
      requireEmail: bool(params.get('requireEmail')),
      requirePhone: bool(params.get('requirePhone')),
      withoutWebsite: bool(params.get('withoutWebsite')),
      requireWebsite: bool(params.get('requireWebsite')),
      minScore: num('minScore', 0),
      minRating: params.get('minRating') ? num('minRating', null) : null,
      category: params.get('category') || '',
    },
  };
}

async function serveStatic(pathname, res) {
  const rel = normalize(pathname === '/' ? '/index.html' : pathname).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
  }
}

function sse(res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });
  return (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

async function handleSearch(url, req, res) {
  const options = searchParamsToOptions(url.searchParams);
  const send = sse(res);
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  if (!options.keyword || !options.location) {
    send('error', { message: 'keyword and location are required' });
    return res.end();
  }

  try {
    const result = await findLeads({
      ...options,
      signal: controller.signal,
      onProgress: (event) => send('progress', event),
    });
    const id = remember(result);
    send('done', { id, leads: result.leads, stats: result.stats, area: result.area });
  } catch (err) {
    send('error', { message: err.message });
  } finally {
    res.end();
  }
}

function handleExport(url, res) {
  const id = url.searchParams.get('id');
  const format = (url.searchParams.get('format') || 'csv').toLowerCase();
  const entry = results.get(id);
  if (!entry) {
    res.writeHead(404, { 'content-type': 'text/plain' }).end('result expired — run the search again');
    return;
  }
  const body = render(entry.leads, format, { title: `leads — ${entry.area?.displayName || ''}` });
  const ext = format === 'ndjson' ? 'ndjson' : format;
  res
    .writeHead(200, {
      'content-type':
        format === 'csv' ? 'text/csv; charset=utf-8' : format === 'html' ? 'text/html; charset=utf-8' : 'application/json',
      'content-disposition': `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.${ext}"`,
    })
    .end(body);
}

export function createApp() {
  return createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    try {
      if (url.pathname === '/api/health') {
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true }));
        return;
      }
      if (url.pathname === '/api/search') return await handleSearch(url, req, res);
      if (url.pathname === '/api/export') return handleExport(url, res);
      return await serveStatic(url.pathname, res);
    } catch (err) {
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(`server error: ${err.message}`);
    }
  });
}

export function startServer({ port = 8787, host = '127.0.0.1' } = {}) {
  const server = createApp();
  return new Promise((resolvePromise) => {
    server.listen(port, host, () => {
      const address = server.address();
      console.log(`d7 leads finder → http://${host}:${address.port}`);
      resolvePromise(server);
    });
  });
}
