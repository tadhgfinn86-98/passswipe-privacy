'use strict';

const { Events, MessageFlags } = require('discord.js');

const challenge = require('../lib/challenge');
const sessions = require('../lib/sessions');
const store = require('../lib/store');
const ui = require('../lib/ui');
const verification = require('../lib/verification');

const ephemeral = { flags: MessageFlags.Ephemeral };

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      if (interaction.isChatInputCommand()) return await runCommand(interaction);
      if (interaction.isButton()) {
        if (interaction.customId === ui.IDS.start) return await startVerification(interaction);
        if (interaction.customId === ui.IDS.open) return await openModal(interaction);
      }
      if (interaction.isModalSubmit() && interaction.customId === ui.IDS.modal) {
        return await submitAnswer(interaction);
      }
    } catch (err) {
      console.error('[interaction] unhandled error:', err);
      await respond(interaction, {
        embeds: [ui.notice('danger', 'Something went wrong', 'Please try again, or ping a moderator if it keeps happening.')],
        ...ephemeral,
      }).catch(() => {});
    }
    return undefined;
  },
};

/** Reply or follow up, depending on what the interaction has already seen. */
async function respond(interaction, payload) {
  if (interaction.deferred) return interaction.editReply(payload);
  if (interaction.replied) return interaction.followUp(payload);
  return interaction.reply(payload);
}

async function runCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) return undefined;
  if (!interaction.inGuild()) {
    return interaction.reply({
      embeds: [ui.notice('warn', 'Server only', 'Run this command inside a server.')],
      ...ephemeral,
    });
  }
  return command.execute(interaction);
}

/** Shared preamble: fetch the member, load settings, run the gate checks. */
async function prepare(interaction) {
  const settings = store.getSettings(interaction.guildId);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const gate = verification.checkEligibility(member, settings);

  if (!gate.ok) {
    const color = gate.outcome === 'blocked' ? 'danger' : 'warn';
    await respond(interaction, { embeds: [ui.notice(color, gate.title, gate.message)], ...ephemeral });
    if (gate.outcome === 'blocked') {
      await verification.log(interaction.guild, settings, {
        member,
        outcome: 'blocked',
        reason: gate.message,
      });
    }
    return null;
  }

  return { settings, member };
}

async function startVerification(interaction) {
  const context = await prepare(interaction);
  if (!context) return undefined;
  const { settings, member } = context;

  if (settings.mode === 'button') {
    await interaction.deferReply(ephemeral);
    const result = await verification.grantAccess(member, settings);
    if (!result.ok) {
      return interaction.editReply({ embeds: [ui.notice('danger', 'Verification failed', result.message)] });
    }
    await verification.log(interaction.guild, settings, { member, outcome: 'verified', reason: 'One-click verification' });
    return interaction.editReply({
      embeds: [ui.notice('success', 'You are verified', 'Welcome in — the rest of the server is open to you now.')],
    });
  }

  const issued = challenge.createChallenge(settings.mode);
  sessions.putChallenge(interaction.guildId, interaction.user.id, issued);

  if (issued.kind === 'math') {
    return interaction.showModal(ui.answerModal('math', issued.prompt));
  }
  return interaction.reply({ ...ui.captchaCard(issued.prompt), ...ephemeral });
}

async function openModal(interaction) {
  const issued = sessions.getChallenge(interaction.guildId, interaction.user.id);
  if (!issued) {
    return interaction.update({
      embeds: [ui.notice('warn', 'Code expired', 'Press **Verify** on the panel again to get a fresh code.')],
      components: [],
    });
  }
  return interaction.showModal(ui.answerModal(issued.kind, issued.prompt));
}

async function submitAnswer(interaction) {
  await interaction.deferReply(ephemeral);

  const settings = store.getSettings(interaction.guildId);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const issued = sessions.getChallenge(interaction.guildId, interaction.user.id);

  if (!issued) {
    return interaction.editReply({
      embeds: [ui.notice('warn', 'Challenge expired', 'Press **Verify** on the panel again to get a fresh one.')],
    });
  }

  const answer = interaction.fields.getTextInputValue(ui.IDS.input);
  if (!challenge.matches(issued.answer, answer)) {
    const { remaining, lockedUntil } = sessions.recordFailure(
      interaction.guildId,
      interaction.user.id,
      settings.maxAttempts,
      settings.cooldownMinutes,
    );
    sessions.clearChallenge(interaction.guildId, interaction.user.id);
    store.bumpStat(interaction.guildId, 'failed');
    await verification.log(interaction.guild, settings, {
      member,
      outcome: 'failed',
      reason: lockedUntil ? 'Wrong answer — now on cooldown' : 'Wrong answer',
    });

    const message = lockedUntil
      ? `Out of attempts. You can try again <t:${Math.floor(lockedUntil / 1000)}:R>.`
      : `That was not right. Press **Verify** again for a new challenge — **${remaining}** attempt(s) left.`;
    return interaction.editReply({ embeds: [ui.notice('warn', 'Incorrect', message)] });
  }

  sessions.reset(interaction.guildId, interaction.user.id);
  const result = await verification.grantAccess(member, settings);
  if (!result.ok) {
    return interaction.editReply({ embeds: [ui.notice('danger', 'Verification failed', result.message)] });
  }

  await verification.log(interaction.guild, settings, {
    member,
    outcome: 'verified',
    reason: `Solved the ${issued.kind} challenge`,
  });
  return interaction.editReply({
    embeds: [ui.notice('success', 'You are verified', 'Welcome in — the rest of the server is open to you now.')],
  });
}
