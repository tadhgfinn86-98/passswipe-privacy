import test from 'node:test';
import assert from 'node:assert/strict';
import { dedupeLeads, normaliseName, leadKeys } from '../src/dedupe.js';
import { makeLead } from '../src/lead.js';

test('normaliseName strips suffixes and punctuation', () => {
  assert.equal(normaliseName('Smile Dental Ltd.'), 'smile dental');
  // '&' and 'and' both drop out, so the two spellings collapse to one key.
  assert.equal(normaliseName('Smith & Sons Limited'), 'smith sons');
  assert.equal(normaliseName('Smith and Sons'), normaliseName('Smith & Sons Ltd'));
});

test('leadKeys covers domain, phone and name+city', () => {
  const keys = leadKeys(makeLead({ name: 'Acme', city: 'Dublin', phone: '+353 1 456 7890', website: 'acme.ie' }));
  assert.ok(keys.includes('domain:acme.ie'));
  assert.ok(keys.some((k) => k.startsWith('phone:')));
  assert.ok(keys.includes('name:acme|dublin'));
});

test('dedupeLeads merges records that share a domain', () => {
  const merged = dedupeLeads([
    makeLead({ name: 'Acme Dental', website: 'https://acme.ie', source: 'openstreetmap', phone: '+3531111111' }),
    makeLead({ name: 'Acme Dental Clinic', website: 'http://www.acme.ie/home', source: 'google', rating: 4.6, reviews: 82 }),
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].rating, 4.6);
  assert.equal(merged[0].phone, '+3531111111');
  assert.ok(merged[0].source.includes('google'));
});

test('dedupeLeads keeps genuinely different businesses apart', () => {
  const leads = dedupeLeads([
    makeLead({ name: 'Acme Dental', city: 'Dublin', website: 'acme.ie' }),
    makeLead({ name: 'Bright Smiles', city: 'Dublin', website: 'bright.ie' }),
  ]);
  assert.equal(leads.length, 2);
});

test('dedupeLeads merges websiteless records by name + city', () => {
  const leads = dedupeLeads([
    makeLead({ name: 'Joe The Plumber', city: 'Cork' }),
    makeLead({ name: 'Joe the Plumber Ltd', city: 'Cork', phone: '+353211111111' }),
  ]);
  assert.equal(leads.length, 1);
  assert.equal(leads[0].phone, '+353211111111');
});
