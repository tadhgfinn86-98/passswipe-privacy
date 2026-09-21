import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOverpassQuery, elementToLead } from '../src/sources/overpass.js';
import { tagsForKeyword, categoryFromTags } from '../src/sources/keywords.js';
import { placeToLead } from '../src/sources/google.js';
import { bboxAround, parseLatLng } from '../src/geocode.js';

test('known keywords map to exact OSM tags', () => {
  assert.deepEqual(tagsForKeyword('dentist'), [['amenity', 'dentist'], ['healthcare', 'dentist']]);
  assert.deepEqual(tagsForKeyword('Plumbers'), [['craft', 'plumber']]);
  assert.deepEqual(tagsForKeyword('quantum yak grooming'), []);
});

test('buildOverpassQuery uses around: for a radius search', () => {
  const q = buildOverpassQuery('dentist', { lat: 53.34, lon: -6.26, radiusM: 5000 }, { limit: 50 });
  assert.match(q, /\[out:json\]\[timeout:90\]/);
  assert.match(q, /nwr\["amenity"="dentist"\]\(around:5000,53\.34,-6\.26\);/);
  assert.match(q, /out center tags 50;$/m);
});

test('buildOverpassQuery falls back to bbox and regex for unknown niches', () => {
  const q = buildOverpassQuery('escape room', { bbox: { south: 1, west: 2, north: 3, east: 4 } });
  assert.match(q, /\(1,2,3,4\)/);
  assert.match(q, /nwr\["leisure"~"escape.room",i\]/);
  assert.match(q, /nwr\["name"~"escape.room",i\]\["shop"\]/);
});

test('buildOverpassQuery escapes regex metacharacters in keywords', () => {
  const q = buildOverpassQuery('a"b(c', { bbox: { south: 1, west: 2, north: 3, east: 4 } });
  assert.ok(!/~"a"b/.test(q));
  assert.match(q, /a\\"b\\\(c/);
});

test('elementToLead maps OSM tags onto the lead shape', () => {
  const lead = elementToLead({
    type: 'node',
    id: 42,
    lat: 53.34,
    lon: -6.26,
    tags: {
      name: 'Smile Dental',
      amenity: 'dentist',
      'addr:housenumber': '12',
      'addr:street': 'Main St',
      'addr:city': 'Dublin',
      'addr:postcode': 'D02 XY12',
      phone: '+353 1 456 7890',
      'contact:email': 'INFO@smile.ie',
      website: 'smile.ie',
      'contact:facebook': 'smiledental',
      opening_hours: 'Mo-Fr 09:00-17:00',
    },
  });
  assert.equal(lead.name, 'Smile Dental');
  assert.equal(lead.category, 'dentist');
  assert.equal(lead.address, '12 Main St, Dublin');
  assert.equal(lead.city, 'Dublin');
  assert.equal(lead.email, 'info@smile.ie');
  assert.equal(lead.website, 'https://smile.ie/');
  assert.equal(lead.domain, 'smile.ie');
  assert.equal(lead.socials.facebook, 'https://www.facebook.com/smiledental');
  assert.equal(lead.sourceUrl, 'https://www.openstreetmap.org/node/42');
});

test('elementToLead skips unnamed features and reads way centres', () => {
  assert.equal(elementToLead({ type: 'way', id: 1, tags: { amenity: 'dentist' } }), null);
  const lead = elementToLead({ type: 'way', id: 2, center: { lat: 1, lon: 2 }, tags: { name: 'X', shop: 'bakery' } });
  assert.equal(lead.lat, 1);
  assert.equal(lead.lng, 2);
});

test('categoryFromTags prefers meaningful tag values', () => {
  assert.equal(categoryFromTags({ shop: 'yes', amenity: 'fast_food' }), 'fast food');
  assert.equal(categoryFromTags({ cuisine: 'pizza;italian' }), 'pizza italian');
});

test('placeToLead maps a Google Places record', () => {
  const lead = placeToLead({
    id: 'ChIJx',
    displayName: { text: 'Bright Smiles' },
    primaryTypeDisplayName: { text: 'Dentist' },
    formattedAddress: '1 Main St, Dublin, Ireland',
    addressComponents: [
      { longText: 'Dublin', types: ['locality'] },
      { longText: 'Ireland', types: ['country'] },
      { longText: 'D02 XY12', types: ['postal_code'] },
    ],
    internationalPhoneNumber: '+353 1 222 3333',
    websiteUri: 'https://bright.ie',
    rating: 4.7,
    userRatingCount: 128,
    location: { latitude: 53.3, longitude: -6.2 },
    googleMapsUri: 'https://maps.google.com/?cid=1',
  });
  assert.equal(lead.name, 'Bright Smiles');
  assert.equal(lead.city, 'Dublin');
  assert.equal(lead.country, 'Ireland');
  assert.equal(lead.rating, 4.7);
  assert.equal(lead.reviews, 128);
  assert.equal(lead.source, 'google');
});

test('geocode helpers work offline for coordinates', () => {
  assert.deepEqual(parseLatLng('53.3498, -6.2603'), { lat: 53.3498, lon: -6.2603 });
  assert.equal(parseLatLng('Dublin'), null);
  assert.equal(parseLatLng('99.0,0.0'), null);
  const box = bboxAround(53.3498, -6.2603, 1000);
  assert.ok(box.north > 53.3498 && box.south < 53.3498);
  assert.ok(box.east > -6.2603 && box.west < -6.2603);
});
