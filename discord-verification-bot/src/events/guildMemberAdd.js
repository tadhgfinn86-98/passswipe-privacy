'use strict';

const { Events } = require('discord.js');
const store = require('../lib/store');
const verification = require('../lib/verification');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    if (member.user.bot) return;

    const settings = store.getSettings(member.guild.id);
    if (!settings.unverifiedRoleId) return;

    const problem = verification.roleProblem(member.guild, settings.unverifiedRoleId);
    if (problem) {
      console.error(`[join] cannot apply the unverified role in ${member.guild.id}: ${problem}`);
      return;
    }

    try {
      await member.roles.add(settings.unverifiedRoleId, 'Awaiting verification');
    } catch (err) {
      console.error(`[join] could not add the unverified role in ${member.guild.id}:`, err.message);
    }
  },
};
