import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createServer } from 'node:http';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startSite, OLD_SITE_HOME, OLD_SITE_CONTACT } from './helpers/site.js';

const run = promisify(execFile);
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'd7.js');

test('--help documents the main flags', async () => {
  const { stdout } = await run(process.execPath, [CLI, '--help']);
  assert.match(stdout, /d7 "<keyword>" --in "<location>"/);
  assert.match(stdout, /--no-website/);
  assert.match(stdout, /--require-email/);
});

test('a missing location fails with a helpful message', async () => {
  const { stdout, stderr } = await run(process.execPath, [CLI, 'dentist'], { reject: false }).catch((e) => e);
  assert.match(`${stdout}${stderr}`, /missing --in <location>/);
});

test('end-to-end: mocked Overpass → enriched CSV on disk', async (t) => {
  const site = await startSite({ '/': OLD_SITE_HOME, '/contact-us': OLD_SITE_CONTACT });
  t.after(() => site.close());

  // Stand in for the Overpass API so the CLI runs without internet access.
  const overpass = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      assert.match(decodeURIComponent(body), /nwr\["craft"="plumber"\]/);
      res.writeHead(200, { 'content-type': 'application/json' }).end(
        JSON.stringify({
          elements: [
            {
              type: 'node',
              id: 1,
              lat: 53.34,
              lon: -6.26,
              tags: { name: "Joe's Plumbing", craft: 'plumber', website: site.origin, 'addr:city': 'Dublin' },
            },
            { type: 'node', id: 2, lat: 53.35, lon: -6.25, tags: { name: 'Pipe Dreams', craft: 'plumber', phone: '+353 1 999 8888' } },
          ],
        }),
      );
    });
  });
  await new Promise((resolve) => overpass.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => overpass.close(resolve)));

  const dir = await mkdtemp(join(tmpdir(), 'd7-'));
  const out = join(dir, 'leads.csv');

  const { stdout } = await run(process.execPath, [CLI, 'plumber', '--in', '53.34,-6.26', '--out', out, '--no-cache', '--quiet'], {
    env: {
      ...process.env,
      D7_OVERPASS_URL: `http://127.0.0.1:${overpass.address().port}/api/interpreter`,
      D7_CACHE_DIR: join(dir, 'cache'),
    },
  });

  const csv = await readFile(out, 'utf8');
  assert.match(csv, /name,category,phone,email/);
  assert.match(csv, /Joe's Plumbing/);
  assert.match(csv, /joe@joesplumbing\.ie/);
  assert.match(csv, /Pipe Dreams/);
  assert.match(csv, /no-website/);
  assert.match(stdout, /SCORE\s+NAME/);
});
