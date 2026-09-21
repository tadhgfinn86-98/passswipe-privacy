import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, searchParamsToOptions } from '../server/server.js';
import { SOURCES } from '../src/search.js';
import { makeLead } from '../src/lead.js';

function parseSSE(text) {
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((chunk) => {
      const event = chunk.match(/^event: (.+)$/m)?.[1];
      const data = chunk.match(/^data: (.+)$/m)?.[1];
      return { event, data: data ? JSON.parse(data) : null };
    });
}

async function withServer(t) {
  const app = createApp();
  await new Promise((resolve) => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => app.close(resolve)));
  return `http://127.0.0.1:${app.address().port}`;
}

test('searchParamsToOptions maps query strings onto search options', () => {
  const opts = searchParamsToOptions(
    new URLSearchParams('keyword=dentist&location=Dublin&radius=25&limit=999&enrich=0&requireEmail=1&minScore=40'),
  );
  assert.equal(opts.keyword, 'dentist');
  assert.equal(opts.radiusKm, 25);
  assert.equal(opts.limit, 500, 'limit is capped server-side');
  assert.equal(opts.enrich, false);
  assert.equal(opts.filters.requireEmail, true);
  assert.equal(opts.filters.minScore, 40);
});

test('the UI and health endpoint are served', async (t) => {
  const base = await withServer(t);
  const health = await fetch(`${base}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { ok: true });

  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /d7 leads finder/);

  assert.equal((await fetch(`${base}/nope.js`)).status, 404);
});

test('search streams progress then a done event, and exports CSV', async (t) => {
  SOURCES.servertest = {
    name: 'servertest',
    requiresKey: false,
    search: async () => [makeLead({ name: 'Fixture Cafe', city: 'Dublin', phone: '+35311111111', source: 'servertest', sourceId: 'a' })],
  };
  const base = await withServer(t);

  const res = await fetch(`${base}/api/search?keyword=cafe&location=53.3,-6.2&source=servertest&enrich=0`);
  assert.equal(res.headers.get('content-type'), 'text/event-stream');
  const events = parseSSE(await res.text());
  const done = events.find((e) => e.event === 'done');
  assert.ok(events.some((e) => e.event === 'progress'));
  assert.ok(done, 'expected a done event');
  assert.equal(done.data.leads.length, 1);
  assert.equal(done.data.leads[0].name, 'Fixture Cafe');

  const csv = await fetch(`${base}/api/export?id=${done.data.id}&format=csv`);
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-disposition'), /attachment; filename="leads-/);
  assert.match(await csv.text(), /Fixture Cafe/);

  const json = await fetch(`${base}/api/export?id=${done.data.id}&format=json`);
  assert.equal(JSON.parse(await json.text())[0].name, 'Fixture Cafe');

  assert.equal((await fetch(`${base}/api/export?id=missing`)).status, 404);
});

test('missing parameters produce an error event, not a crash', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/api/search?keyword=cafe`);
  const events = parseSSE(await res.text());
  assert.equal(events[0].event, 'error');
  assert.match(events[0].data.message, /required/);
});

test('static serving cannot escape the public directory', async (t) => {
  const base = await withServer(t);
  const res = await fetch(`${base}/../../package.json`, { redirect: 'manual' });
  assert.ok(res.status === 404 || res.status === 403 || res.status === 301);
});
