import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRobots, isAllowed, crawlDelay } from '../src/robots.js';

const ROBOTS = `
# comment
User-agent: *
Disallow: /private
Allow: /private/public-page
Crawl-delay: 2

User-agent: badbot
Disallow: /
`;

test('parseRobots groups rules per agent', () => {
  const groups = parseRobots(ROBOTS);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].agents, ['*']);
  assert.equal(groups[0].rules.length, 2);
});

test('isAllowed honours longest-match and wildcard groups', () => {
  const groups = parseRobots(ROBOTS);
  assert.equal(isAllowed(groups, '/about'), true);
  assert.equal(isAllowed(groups, '/private/secret'), false);
  assert.equal(isAllowed(groups, '/private/public-page'), true);
});

test('agent-specific group overrides the wildcard group', () => {
  const groups = parseRobots(ROBOTS);
  assert.equal(isAllowed(groups, '/about', 'badbot/1.0'), false);
});

test('empty robots allows everything, crawl-delay is read', () => {
  assert.equal(isAllowed([], '/anything'), true);
  assert.equal(crawlDelay(parseRobots(ROBOTS)), 2);
});

test('wildcards and end anchors are supported', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /*.pdf$\n');
  assert.equal(isAllowed(groups, '/files/report.pdf'), false);
  assert.equal(isAllowed(groups, '/files/report.pdf?x=1'), true);
});
