import test from 'node:test';
import assert from 'node:assert/strict';
import { findLeads, SOURCES, applyFilters, summarise } from '../src/search.js';
import { makeLead } from '../src/lead.js';
import { _resetRobotsCache } from '../src/robots.js';
import { _resetHostLimiters } from '../src/enrich.js';
import { startSite, OLD_SITE_HOME, OLD_SITE_CONTACT, MODERN_SITE_HOME } from './helpers/site.js';

async function fixtureWorld(t) {
  _resetRobotsCache();
  _resetHostLimiters();
  const oldSite = await startSite({ '/': OLD_SITE_HOME, '/contact-us': OLD_SITE_CONTACT });
  // Separate loopback IPs: the de-duplicator keys on host, so both sites need distinct hosts.
  const modernSite = await startSite({ '/': MODERN_SITE_HOME }, { host: '127.0.0.2' });
  t.after(() => Promise.all([oldSite.close(), modernSite.close()]));

  SOURCES.fixture = {
    name: 'fixture',
    requiresKey: false,
    search: async () => [
      makeLead({ name: "Joe's Plumbing", category: 'plumber', website: oldSite.origin, city: 'Dublin', source: 'fixture', sourceId: '1' }),
      makeLead({ name: 'Bright Dental', category: 'dentist', website: modernSite.origin, city: 'Dublin', phone: '+35312223333', rating: 4.8, reviews: 120, source: 'fixture', sourceId: '2' }),
      makeLead({ name: 'No Website Cafe', category: 'cafe', city: 'Dublin', phone: '+35319998888', source: 'fixture', sourceId: '3' }),
    ],
  };
  return { oldSite, modernSite };
}

test('findLeads runs the whole pipeline offline against fixture sites', async (t) => {
  await fixtureWorld(t);
  const phases = [];
  const { leads, stats, area } = await findLeads({
    keyword: 'plumber',
    location: '53.3498,-6.2603',
    source: 'fixture',
    radiusKm: 5,
    useCache: false,
    onProgress: (e) => phases.push(e.phase),
  });

  assert.equal(area.lat, 53.3498);
  assert.equal(leads.length, 3);
  assert.deepEqual([...new Set(phases)], ['geocode', 'search', 'dedupe', 'enrich', 'score', 'done']);

  const joe = leads.find((l) => l.name === "Joe's Plumbing");
  assert.equal(joe.email, 'joe@joesplumbing.ie');
  assert.ok(joe.opportunities.includes('not-mobile-friendly'));
  assert.ok(joe.opportunities.includes('stale-site'));

  const cafe = leads.find((l) => l.name === 'No Website Cafe');
  assert.ok(cafe.opportunities.includes('no-website'));

  // Highest-opportunity lead sorts first by default.
  assert.ok(leads[0].score >= leads[leads.length - 1].score);
  assert.equal(stats.count, 3);
  assert.equal(stats.withEmail, 2);
  assert.equal(stats.withoutWebsite, 1);
});

test('findLeads honours filters and limits', async (t) => {
  await fixtureWorld(t);

  const emailOnly = await findLeads({
    keyword: 'plumber',
    location: '53.3498,-6.2603',
    source: 'fixture',
    useCache: false,
    filters: { requireEmail: true },
  });
  assert.ok(emailOnly.leads.every((l) => l.email));

  const noSite = await findLeads({
    keyword: 'plumber',
    location: '53.3498,-6.2603',
    source: 'fixture',
    useCache: false,
    filters: { withoutWebsite: true },
  });
  assert.deepEqual(noSite.leads.map((l) => l.name), ['No Website Cafe']);

  const capped = await findLeads({
    keyword: 'plumber',
    location: '53.3498,-6.2603',
    source: 'fixture',
    useCache: false,
    limit: 1,
  });
  assert.equal(capped.leads.length, 1);
});

test('findLeads can skip enrichment', async (t) => {
  await fixtureWorld(t);
  const { leads } = await findLeads({
    keyword: 'plumber',
    location: '53.3498,-6.2603',
    source: 'fixture',
    enrich: false,
    useCache: false,
  });
  assert.equal(leads.find((l) => l.name === "Joe's Plumbing").email, '');
});

test('findLeads validates its inputs', async () => {
  await assert.rejects(() => findLeads({ location: 'Dublin' }), /keyword is required/);
  await assert.rejects(() => findLeads({ keyword: 'x' }), /location is required/);
  await assert.rejects(() => findLeads({ keyword: 'x', location: '1,1', source: 'nope' }), /unknown source/);
});

test('applyFilters and summarise work on their own', () => {
  const leads = [
    { ...makeLead({ name: 'A', email: 'a@a.ie', website: 'https://a.ie' }), score: 80 },
    { ...makeLead({ name: 'B', phone: '+1' }), score: 20 },
  ];
  assert.equal(applyFilters(leads, { minScore: 50 }).length, 1);
  assert.equal(applyFilters(leads, { requirePhone: true })[0].name, 'B');
  const stats = summarise(leads);
  assert.equal(stats.count, 2);
  assert.equal(stats.withEmail, 1);
  assert.equal(stats.avgScore, 50);
});
