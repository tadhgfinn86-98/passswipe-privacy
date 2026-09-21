'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, describe, it } = require('node:test');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-test-'));
process.env.DATA_FILE = path.join(tmpDir, 'guilds.json');

const challenge = require('../src/lib/challenge');
const sessions = require('../src/lib/sessions');
const store = require('../src/lib/store');
const ui = require('../src/lib/ui');
const handler = require('../src/events/interactionCreate');
const { makeGuild, makeInteraction, makeMember, makeRole, lastTitle } = require('./helpers');

const VERIFIED = makeRole('role-verified', 'Verified');
const UNVERIFIED = makeRole('role-unverified', 'Unverified');

function setup(patch = {}) {
  const guild = makeGuild({ roles: [VERIFIED, UNVERIFIED] });
  store.setSettings(guild.id, {
    verifiedRoleId: VERIFIED.id,
    unverifiedRoleId: UNVERIFIED.id,
    mode: 'captcha',
    minAccountAgeDays: 0,
    maxAttempts: 3,
    cooldownMinutes: 10,
    stats: { verified: 0, failed: 0 },
    ...patch,
  });
  return guild;
}

const pressVerify = (guild, member) =>
  makeInteraction(guild, member, { isButton: () => true, customId: ui.IDS.start });

const submit = (guild, member, answer) =>
  makeInteraction(guild, member, {
    isModalSubmit: () => true,
    customId: ui.IDS.modal,
    fields: { getTextInputValue: () => answer },
  });

beforeEach(() => sessions.reset('guild-1', 'user-1'));
after(async () => {
  await store.flush(); // let queued writes finish before the temp dir goes
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('challenge', () => {
  it('renders a code as five rows of block art', () => {
    const rows = challenge.renderCode('ABC123'.replace(/[01]/g, '2')).split('\n');
    assert.equal(rows.length, 5);
  });

  it('accepts the answer regardless of case and spacing', () => {
    assert.ok(challenge.matches('A4K9P2', ' a4 k9p2 '));
    assert.ok(!challenge.matches('A4K9P2', 'A4K9P3'));
  });

  it('generates solvable maths questions', () => {
    for (let i = 0; i < 50; i += 1) {
      const { question, answer } = challenge.mathChallenge();
      const [a, op, b] = question.split(' ');
      const expected = { '+': +a + +b, '-': +a - +b, x: +a * +b }[op];
      assert.equal(answer, String(expected));
    }
  });
});

describe('one-click mode', () => {
  it('grants the verified role and drops the unverified one', async () => {
    const guild = setup({ mode: 'button' });
    const member = makeMember(guild, { roles: [UNVERIFIED.id] });
    const interaction = pressVerify(guild, member);

    await handler.execute(interaction);

    assert.equal(lastTitle(interaction), 'You are verified');
    assert.ok(member.held.has(VERIFIED.id));
    assert.ok(!member.held.has(UNVERIFIED.id));
    assert.equal(store.getSettings(guild.id).stats.verified, 1);
  });
});

describe('captcha mode', () => {
  it('shows a captcha card, then verifies a correct answer', async () => {
    const guild = setup();
    const member = makeMember(guild);

    const start = pressVerify(guild, member);
    await handler.execute(start);
    assert.equal(lastTitle(start), 'Type the code you see');

    const issued = sessions.getChallenge(guild.id, member.id);
    assert.equal(issued.kind, 'captcha');

    const answer = submit(guild, member, issued.answer.toLowerCase());
    await handler.execute(answer);

    assert.equal(lastTitle(answer), 'You are verified');
    assert.ok(member.held.has(VERIFIED.id));
  });

  it('counts down attempts and then locks the member out', async () => {
    const guild = setup({ maxAttempts: 2 });
    const member = makeMember(guild);

    await handler.execute(pressVerify(guild, member));
    const firstMiss = submit(guild, member, 'WRONG1');
    await handler.execute(firstMiss);
    assert.equal(lastTitle(firstMiss), 'Incorrect');
    assert.match(firstMiss.replies.at(-1).embeds[0].data.description, /\*\*1\*\* attempt/);

    await handler.execute(pressVerify(guild, member));
    const secondMiss = submit(guild, member, 'WRONG2');
    await handler.execute(secondMiss);
    assert.match(secondMiss.replies.at(-1).embeds[0].data.description, /Out of attempts/);

    const blocked = pressVerify(guild, member);
    await handler.execute(blocked);
    assert.equal(lastTitle(blocked), 'Too many attempts');
    assert.ok(!member.held.has(VERIFIED.id));
    assert.equal(store.getSettings(guild.id).stats.failed, 2);
  });

  it('asks for a fresh challenge once the old one is gone', async () => {
    const guild = setup();
    const member = makeMember(guild);
    const stale = submit(guild, member, 'ANYTHING');

    await handler.execute(stale);

    assert.equal(lastTitle(stale), 'Challenge expired');
  });
});

describe('maths mode', () => {
  it('opens the modal straight away and accepts the right number', async () => {
    const guild = setup({ mode: 'math' });
    const member = makeMember(guild);

    const start = pressVerify(guild, member);
    await handler.execute(start);
    assert.equal(start.modals.length, 1);

    const issued = sessions.getChallenge(guild.id, member.id);
    const answer = submit(guild, member, issued.answer);
    await handler.execute(answer);

    assert.equal(lastTitle(answer), 'You are verified');
  });
});

describe('gates', () => {
  it('turns away accounts that are too new', async () => {
    const guild = setup({ minAccountAgeDays: 7 });
    const member = makeMember(guild, { accountAgeDays: 1 });
    const interaction = pressVerify(guild, member);

    await handler.execute(interaction);

    assert.equal(lastTitle(interaction), 'Account too new');
    assert.ok(!member.held.has(VERIFIED.id));
  });

  it('short-circuits members who already hold the role', async () => {
    const guild = setup();
    const member = makeMember(guild, { roles: [VERIFIED.id] });
    const interaction = pressVerify(guild, member);

    await handler.execute(interaction);

    assert.equal(lastTitle(interaction), 'Already verified');
  });

  it('explains itself when the bot sits below the verified role', async () => {
    const guild = makeGuild({ roles: [VERIFIED], botAboveRoles: false });
    store.setSettings(guild.id, { verifiedRoleId: VERIFIED.id, mode: 'button' });
    const member = makeMember(guild);
    const interaction = pressVerify(guild, member);

    await handler.execute(interaction);

    assert.equal(lastTitle(interaction), 'Verification is not set up correctly');
    assert.match(interaction.replies.at(-1).embeds[0].data.description, /below \*\*Verified\*\*/);
  });

  it('points admins at setup when no role is configured', async () => {
    const guild = makeGuild({ roles: [] });
    const member = makeMember(guild);
    const interaction = pressVerify(guild, member);

    await handler.execute(interaction);

    assert.match(interaction.replies.at(-1).embeds[0].data.description, /\/verification setup/);
  });
});
