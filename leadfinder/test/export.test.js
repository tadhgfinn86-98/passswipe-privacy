import test from 'node:test';
import assert from 'node:assert/strict';
import { csvEscape, toCSV, toNDJSON, toHTML } from '../src/export.js';
import { makeLead } from '../src/lead.js';

test('csvEscape quotes separators and neutralises formulas', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
  assert.equal(csvEscape('=cmd|calc'), "'=cmd|calc");
  assert.equal(csvEscape(null), '');
});

test('toCSV writes a header plus one row per lead', () => {
  const csv = toCSV([makeLead({ name: 'Acme, Ltd', website: 'acme.ie', phone: '+3531', source: 'openstreetmap' })], { bom: false });
  const [header, row] = csv.trim().split('\r\n');
  assert.ok(header.startsWith('name,category,phone,email,website,domain'));
  assert.ok(row.startsWith('"Acme, Ltd"'));
  assert.ok(row.includes('https://acme.ie/'));
  assert.ok(row.includes('acme.ie'));
});

test('toCSV marks missing websites as has_website=no', () => {
  const csv = toCSV([makeLead({ name: 'No Site Co' })], { bom: false });
  const cols = csv.trim().split('\r\n')[1].split(',');
  const header = csv.trim().split('\r\n')[0].split(',');
  assert.equal(cols[header.indexOf('has_website')], 'no');
});

test('ndjson and html render', () => {
  const leads = [makeLead({ name: 'A' }), makeLead({ name: 'B' })];
  assert.equal(toNDJSON(leads).trim().split('\n').length, 2);
  const html = toHTML(leads, { title: 'x' });
  assert.ok(html.includes('<table>'));
  assert.ok(html.includes('(2)'));
});

test('html output escapes lead text', () => {
  const html = toHTML([makeLead({ name: '<script>alert(1)</script>' })]);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});
