import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead } from '../src/score.js';
import { makeLead } from '../src/lead.js';

test('a business with no website scores as a strong opportunity', () => {
  const { score, opportunities } = scoreLead(makeLead({ name: 'X', phone: '+3531', socials: { facebook: 'x' } }));
  assert.ok(opportunities.includes('no-website'));
  assert.ok(opportunities.includes('social-only-presence'));
  assert.ok(score >= 40);
});

test('a modern, well-run site scores low', () => {
  const lead = makeLead({
    name: 'Modern Co',
    website: 'https://modern.ie',
    email: 'info@modern.ie',
    phone: '+3531',
    socials: { facebook: 'f', instagram: 'i' },
  });
  const { score, opportunities } = scoreLead(
    { ...lead, websiteLive: true, https: true, mobileFriendly: true, hasContactForm: true, tech: ['google-analytics'], copyrightYear: new Date().getFullYear() },
  );
  assert.deepEqual(opportunities, []);
  assert.equal(score, 26); // contactability only
});

test('dated sites surface fixable problems', () => {
  const lead = {
    ...makeLead({ name: 'Old Co', website: 'http://old.ie' }),
    websiteLive: true,
    https: false,
    mobileFriendly: false,
    hasContactForm: false,
    tech: ['wix'],
    copyrightYear: 2015,
    responseMs: 4000,
  };
  const { opportunities } = scoreLead(lead, { now: new Date('2026-01-01') });
  for (const expected of ['no-https', 'not-mobile-friendly', 'no-analytics', 'diy-site-builder', 'stale-site', 'slow-site']) {
    assert.ok(opportunities.includes(expected), `expected ${expected}`);
  }
});

test('an unreachable website is its own angle and the score is capped', () => {
  const lead = { ...makeLead({ name: 'Dead Co', website: 'https://dead.ie' }), websiteLive: false };
  const { score, opportunities } = scoreLead(lead);
  assert.ok(opportunities.includes('website-unreachable'));
  assert.ok(score <= 100);
});
