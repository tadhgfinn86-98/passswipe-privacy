import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractEmails,
  extractPhones,
  extractSocials,
  extractMeta,
  detectTech,
  findContactLinks,
  normalisePhone,
  normaliseEmail,
  stripTags,
  registrableDomain,
} from '../src/extract.js';

test('extractEmails finds mailto, plain text and obfuscated addresses', () => {
  const html = `
    <a href="mailto:Hello@Smiledental.ie?subject=hi">mail us</a>
    <p>accounts@smiledental.ie</p>
    <p>bookings [at] smiledental [dot] ie</p>
    <img src="logo@2x.png">
  `;
  const emails = extractEmails(html, { siteDomain: 'smiledental.ie' });
  assert.ok(emails.includes('hello@smiledental.ie'));
  assert.ok(emails.includes('accounts@smiledental.ie'));
  assert.ok(emails.includes('bookings@smiledental.ie'));
  assert.ok(!emails.some((e) => e.includes('2x.png')));
});

test('extractEmails ranks role addresses on the site domain first', () => {
  const html = 'random.person@gmail.com info@acme.ie dev@wixpress.com';
  const [first] = extractEmails(html, { siteDomain: 'acme.ie' });
  assert.equal(first, 'info@acme.ie');
});

test('normaliseEmail rejects junk', () => {
  assert.equal(normaliseEmail('user@example.com'), null);
  assert.equal(normaliseEmail('sprite@icon.png'), null);
  assert.equal(normaliseEmail(' Info@Acme.IE '), 'info@acme.ie');
});

test('normalisePhone keeps international format', () => {
  assert.equal(normalisePhone('+353 (1) 456 7890'), '+35314567890');
  assert.equal(normalisePhone('00353 1 456 7890'), '+35314567890');
  assert.equal(normalisePhone('01 456 7890', { defaultCountryCode: '353' }), '+35314567890');
  assert.equal(normalisePhone('123'), null);
});

test('extractPhones reads tel: links and ignores year ranges', () => {
  const phones = extractPhones('<a href="tel:+353-1-456-7890">call</a> <p>© 2011 - 2019 Acme</p>');
  assert.deepEqual(phones, ['+35314567890']);
});

test('extractSocials picks real profiles, not share widgets', () => {
  const html = `
    <a href="https://facebook.com/sharer.php?u=x">share</a>
    <a href="https://www.facebook.com/acmedental">fb</a>
    <a href="//instagram.com/acmedental/">ig</a>
    <a href="https://www.linkedin.com/company/acme-dental">li</a>
    <a href="https://x.com/acmedental">x</a>
  `;
  const socials = extractSocials(html);
  assert.equal(socials.facebook, 'https://www.facebook.com/acmedental');
  assert.equal(socials.instagram, 'https://instagram.com/acmedental');
  assert.equal(socials.linkedin, 'https://www.linkedin.com/company/acme-dental');
  assert.equal(socials.twitter, 'https://x.com/acmedental');
});

test('extractMeta reads title, viewport and copyright year', () => {
  const meta = extractMeta(`<title>Acme Dental</title>
    <meta name="viewport" content="width=device-width">
    <meta name="description" content="Family dentist">
    <footer>&copy; 2019 Acme</footer>`);
  assert.equal(meta.title, 'Acme Dental');
  assert.equal(meta.description, 'Family dentist');
  assert.equal(meta.hasViewport, true);
  assert.equal(meta.copyrightYear, 2019);
});

test('detectTech spots platforms and analytics', () => {
  const tech = detectTech('<link href="/wp-content/themes/x.css"><script src="https://www.googletagmanager.com/gtag/js">');
  assert.ok(tech.includes('wordpress'));
  assert.ok(tech.includes('google-analytics'));
});

test('findContactLinks returns same-host contact pages only', () => {
  const html = `
    <a href="/contact-us">Contact</a>
    <a href="https://other.com/contact">Nope</a>
    <a href="/about">About us</a>
    <a href="/blog">Blog</a>`;
  const links = findContactLinks(html, 'https://acme.ie/');
  assert.deepEqual(links, ['https://acme.ie/contact-us', 'https://acme.ie/about']);
});

test('helpers', () => {
  assert.equal(stripTags('<p>Hi <b>there</b></p>'), 'Hi there');
  assert.equal(registrableDomain('https://WWW.Acme.IE/path'), 'acme.ie');
});
