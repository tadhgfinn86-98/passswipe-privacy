'use strict';

// Minimal stand-ins for the discord.js objects the bot touches, so the
// verification flows can be driven end to end without a gateway connection.

const { Collection } = require('discord.js');

function makeRole(id, name, options = {}) {
  return { id, name, managed: false, toString: () => `<@&${id}>`, ...options };
}

function makeGuild({ roles = [], botAboveRoles = true, botPerms = true } = {}) {
  const roleCache = new Collection();
  for (const role of roles) roleCache.set(role.id, role);

  const guild = {
    id: 'guild-1',
    roles: { cache: roleCache },
    channels: { fetch: async () => null },
    members: {
      me: {
        permissions: { has: () => botPerms },
        roles: { highest: { comparePositionTo: () => (botAboveRoles ? 1 : -1) } },
      },
      fetch: async (id) => guild._members.get(id),
    },
    _members: new Map(),
  };
  return guild;
}

function makeMember(guild, { id = 'user-1', accountAgeDays = 365, roles = [] } = {}) {
  const held = new Set(roles);
  const member = {
    id,
    guild,
    user: {
      id,
      bot: false,
      tag: `${id}#0001`,
      createdTimestamp: Date.now() - accountAgeDays * 24 * 60 * 60 * 1000,
      displayAvatarURL: () => 'https://example.invalid/avatar.png',
    },
    roles: {
      cache: { has: (roleId) => held.has(roleId) },
      add: async (roleId) => held.add(roleId),
      remove: async (roleId) => held.delete(roleId),
    },
    held,
    toString: () => `<@${id}>`,
  };
  guild._members.set(id, member);
  return member;
}

/** Captures every reply the handler makes, plus any modal it opens. */
function makeInteraction(guild, member, overrides = {}) {
  const interaction = {
    guild,
    guildId: guild.id,
    user: member.user,
    member,
    client: { commands: new Collection() },
    replied: false,
    deferred: false,
    replies: [],
    modals: [],
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => false,
    inGuild: () => true,
    async reply(payload) {
      this.replied = true;
      this.replies.push(payload);
      return payload;
    },
    async deferReply() {
      this.deferred = true;
      return null;
    },
    async editReply(payload) {
      this.replies.push(payload);
      return payload;
    },
    async followUp(payload) {
      this.replies.push(payload);
      return payload;
    },
    async update(payload) {
      this.replies.push(payload);
      return payload;
    },
    async showModal(modal) {
      this.modals.push(modal.toJSON());
      return null;
    },
    ...overrides,
  };
  return interaction;
}

/** Title of the last embed the handler sent. */
function lastTitle(interaction) {
  const payload = interaction.replies.at(-1);
  return payload?.embeds?.[0]?.data?.title ?? null;
}

module.exports = { makeRole, makeGuild, makeMember, makeInteraction, lastTitle };
