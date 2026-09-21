import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichWebsite, normaliseWebsite, _resetHostLimiters } from '../src/enrich.js';
import { _resetRobotsCache } from '../src/robots.js';
import { startSite, OLD_SITE_HOME, OLD_SITE_CONTACT, MODERN_SITE_HOME } from './helpers/site.js';

test('normaliseWebsite fixes bare domains and rejects junk', () => {
  assert.equal(normaliseWebsite('acme.ie'), 'https://acme.ie/');
  assert.equal(normaliseWebsite('http://acme.ie/x?y=1'), 'http://acme.ie/x?y=1');
  assert.equal(normaliseWebsite('n/a'), '');
  assert.equal(normaliseWebsite('localhost'), '');
  assert.equal(normaliseWebsite(''), '');
});

test('enrichWebsite follows a contact link to find the email', async (t) => {
  _resetRobotsCache();
  _resetHostLimiters();
  const site = await startSite({ '/': OLD_SITE_HOME, '/contact-us': OLD_SITE_CONTACT });
  t.after(() => site.close());

  const data = await enrichWebsite(site.origin, { maxPages: 3 });
  assert.equal(data.reachable, true);
  assert.equal(data.pagesCrawled, 2);
  assert.deepEqual(data.emails, ['joe@joesplumbing.ie']);
  assert.ok(data.phones.includes('+35315550100'));
  assert.equal(data.socials.facebook, 'https://www.facebook.com/joesplumbing');
  assert.equal(data.title, "Joe's Plumbing");
  assert.equal(data.mobileFriendly, false);
  assert.equal(data.https, false);
  assert.equal(data.copyrightYear, 2016);
  assert.ok(data.tech.includes('wordpress'));
  assert.equal(data.hasContactForm, true);
});

test('enrichWebsite stops at the homepage when it already has an email', async (t) => {
  _resetRobotsCache();
  _resetHostLimiters();
  const site = await startSite({ '/': MODERN_SITE_HOME, '/contact': OLD_SITE_CONTACT });
  t.after(() => site.close());

  const data = await enrichWebsite(site.origin, { maxPages: 3 });
  assert.equal(data.pagesCrawled, 1);
  assert.deepEqual(data.emails, ['info@brightdental.ie']);
  assert.equal(data.mobileFriendly, true);
  assert.ok(data.tech.includes('google-analytics'));
});

test('enrichWebsite obeys robots.txt and can be told not to', async (t) => {
  _resetRobotsCache();
  _resetHostLimiters();
  const site = await startSite({ '/': MODERN_SITE_HOME }, { robots: 'User-agent: *\nDisallow: /\n' });
  t.after(() => site.close());

  const blocked = await enrichWebsite(site.origin, { maxPages: 1 });
  assert.equal(blocked.reachable, false);
  assert.match(blocked.error, /robots/);

  _resetRobotsCache();
  const allowed = await enrichWebsite(site.origin, { maxPages: 1, respectRobots: false });
  assert.equal(allowed.reachable, true);
});

test('enrichWebsite reports unreachable hosts instead of throwing', async () => {
  _resetRobotsCache();
  const data = await enrichWebsite('http://127.0.0.1:1/', { maxPages: 1, timeoutMs: 1500 });
  assert.equal(data.reachable, false);
  assert.ok(data.error);
});

test('enrichWebsite handles a missing website input', async () => {
  const data = await enrichWebsite('', {});
  assert.equal(data.reachable, false);
  assert.equal(data.error, 'no website');
});
