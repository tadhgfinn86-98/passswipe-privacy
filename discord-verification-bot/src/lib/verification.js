'use strict';

const { PermissionFlagsBits } = require('discord.js');
const sessions = require('./sessions');
const store = require('./store');
const ui = require('./ui');

const DAY_MS = 24 * 60 * 60 * 1000;

/** Can the bot actually hand out this role? Returns null when everything is fine. */
function roleProblem(guild, roleId) {
  if (!roleId) return 'No verified role is configured yet. An admin needs to run `/verification setup`.';
  const role = guild.roles.cache.get(roleId);
  if (!role) return 'The configured verified role no longer exists. An admin needs to run `/verification setup` again.';
  const me = guild.members.me;
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) return 'I am missing the **Manage Roles** permission.';
  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return `My highest role sits below **${role.name}**, so I cannot assign it. Move my role above it in Server Settings → Roles.`;
  }
  if (role.managed) return `**${role.name}** is managed by an integration and cannot be assigned manually.`;
  return null;
}

/**
 * Gate checks that run before a challenge is issued.
 * Returns { ok } or { ok: false, title, message, outcome }.
 */
function checkEligibility(member, settings) {
  if (settings.verifiedRoleId && member.roles.cache.has(settings.verifiedRoleId)) {
    return { ok: false, title: 'Already verified', message: 'You already have access to the server.', outcome: null };
  }

  const problem = roleProblem(member.guild, settings.verifiedRoleId);
  if (problem) {
    return { ok: false, title: 'Verification is not set up correctly', message: problem, outcome: 'blocked' };
  }

  const minAgeMs = (settings.minAccountAgeDays || 0) * DAY_MS;
  if (minAgeMs > 0) {
    const age = Date.now() - member.user.createdTimestamp;
    if (age < minAgeMs) {
      const readyAt = Math.floor((member.user.createdTimestamp + minAgeMs) / 1000);
      return {
        ok: false,
        title: 'Account too new',
        message: `This server requires Discord accounts to be at least **${settings.minAccountAgeDays} day(s)** old. You can verify <t:${readyAt}:R>.`,
        outcome: 'blocked',
      };
    }
  }

  const lockout = sessions.lockoutRemaining(member.guild.id, member.id);
  if (lockout > 0) {
    const until = Math.floor((Date.now() + lockout) / 1000);
    return {
      ok: false,
      title: 'Too many attempts',
      message: `You have run out of attempts. Try again <t:${until}:R>.`,
      outcome: 'blocked',
    };
  }

  return { ok: true };
}

/** Add the verified role (and drop the unverified one). Returns { ok, message }. */
async function grantAccess(member, settings) {
  const problem = roleProblem(member.guild, settings.verifiedRoleId);
  if (problem) return { ok: false, message: problem };

  try {
    await member.roles.add(settings.verifiedRoleId, 'Passed verification');
  } catch (err) {
    console.error(`[verify] could not add role in ${member.guild.id}:`, err.message);
    return { ok: false, message: 'I could not assign the role. Please ping a moderator.' };
  }

  if (settings.unverifiedRoleId && member.roles.cache.has(settings.unverifiedRoleId)) {
    try {
      await member.roles.remove(settings.unverifiedRoleId, 'Passed verification');
    } catch (err) {
      // Non-fatal: they are verified either way, the holding role just lingers.
      console.error(`[verify] could not remove unverified role in ${member.guild.id}:`, err.message);
    }
  }

  store.bumpStat(member.guild.id, 'verified');
  return { ok: true };
}

/** Best-effort audit log; never throws into the interaction path. */
async function log(guild, settings, payload) {
  if (!settings.logChannelId) return;
  try {
    const channel = await guild.channels.fetch(settings.logChannelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    const me = guild.members.me;
    if (me && !channel.permissionsFor(me)?.has(PermissionFlagsBits.SendMessages)) return;
    await channel.send({ embeds: [ui.logEntry(payload)] });
  } catch (err) {
    console.error(`[verify] log failed in ${guild.id}:`, err.message);
  }
}

module.exports = { DAY_MS, roleProblem, checkEligibility, grantAccess, log };
