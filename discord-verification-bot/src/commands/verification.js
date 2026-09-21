'use strict';

const {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} = require('discord.js');

const store = require('../lib/store');
const sessions = require('../lib/sessions');
const verification = require('../lib/verification');
const ui = require('../lib/ui');

const MODE_CHOICES = [
  { name: 'Captcha code (recommended)', value: 'captcha' },
  { name: 'Maths question', value: 'math' },
  { name: 'One click, no challenge', value: 'button' },
];

const data = new SlashCommandBuilder()
  .setName('verification')
  .setDescription('Set up and manage member verification')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false)
  .addSubcommand((sub) =>
    sub
      .setName('setup')
      .setDescription('Post the verification panel and choose the role members receive')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel the panel is posted in')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
          .setRequired(true),
      )
      .addRoleOption((opt) =>
        opt.setName('role').setDescription('Role granted once a member verifies').setRequired(true),
      )
      .addStringOption((opt) =>
        opt.setName('mode').setDescription('How members prove they are human').addChoices(...MODE_CHOICES),
      )
      .addStringOption((opt) =>
        opt.setName('message').setDescription('Custom text for the panel (optional)').setMaxLength(2000),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('config')
      .setDescription('Change individual verification settings')
      .addStringOption((opt) =>
        opt.setName('mode').setDescription('How members prove they are human').addChoices(...MODE_CHOICES),
      )
      .addChannelOption((opt) =>
        opt
          .setName('log-channel')
          .setDescription('Channel that receives verification logs')
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
      )
      .addRoleOption((opt) =>
        opt
          .setName('unverified-role')
          .setDescription('Holding role given on join and removed on success'),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('min-account-age')
          .setDescription('Minimum Discord account age in days (0 disables)')
          .setMinValue(0)
          .setMaxValue(365),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('max-attempts')
          .setDescription('Wrong answers allowed before a cooldown (default 3)')
          .setMinValue(1)
          .setMaxValue(10),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('cooldown')
          .setDescription('Cooldown in minutes after too many wrong answers (default 10)')
          .setMinValue(1)
          .setMaxValue(1440),
      ),
  )
  .addSubcommand((sub) =>
    sub.setName('status').setDescription('Show the current configuration and a health check'),
  )
  .addSubcommand((sub) =>
    sub
      .setName('reset')
      .setDescription("Clear a member's failed attempts and cooldown")
      .addUserOption((opt) => opt.setName('member').setDescription('Member to reset').setRequired(true)),
  );

async function execute(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'setup') return setup(interaction);
  if (sub === 'config') return config(interaction);
  if (sub === 'status') return status(interaction);
  if (sub === 'reset') return reset(interaction);
  return undefined;
}

async function setup(interaction) {
  const channel = interaction.options.getChannel('channel');
  const role = interaction.options.getRole('role');
  const mode = interaction.options.getString('mode') || store.getSettings(interaction.guildId).mode;
  const message = interaction.options.getString('message');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const problem = verification.roleProblem(interaction.guild, role.id);
  if (problem) {
    return interaction.editReply({ embeds: [ui.notice('danger', 'Cannot use that role', problem)] });
  }

  const me = interaction.guild.members.me;
  const perms = channel.permissionsFor(me);
  if (!perms?.has(PermissionFlagsBits.ViewChannel) || !perms.has(PermissionFlagsBits.SendMessages)) {
    return interaction.editReply({
      embeds: [
        ui.notice(
          'danger',
          'Cannot post there',
          `I need **View Channel** and **Send Messages** in ${channel}.`,
        ),
      ],
    });
  }

  const panel = ui.panel({ mode, roleName: role.name, description: message });
  let posted;
  try {
    posted = await channel.send(panel);
  } catch (err) {
    return interaction.editReply({
      embeds: [ui.notice('danger', 'Cannot post there', `Discord rejected the message: ${err.message}`)],
    });
  }

  // Tidy up the previous panel so the channel does not collect dead buttons.
  const previous = store.getSettings(interaction.guildId);
  if (previous.panelChannelId && previous.panelMessageId) {
    const oldChannel = await interaction.guild.channels
      .fetch(previous.panelChannelId)
      .catch(() => null);
    const oldMessage = await oldChannel?.messages?.fetch(previous.panelMessageId).catch(() => null);
    await oldMessage?.delete().catch(() => {});
  }

  store.setSettings(interaction.guildId, {
    verifiedRoleId: role.id,
    mode,
    panelChannelId: channel.id,
    panelMessageId: posted.id,
    panelMessage: message || null,
  });

  return interaction.editReply({
    embeds: [
      ui.notice(
        'success',
        'Verification is live',
        [
          `Panel posted in ${channel}.`,
          `Verified members receive ${role}.`,
          `Mode: **${mode}**.`,
          '',
          'Remember to deny **View Channel** on your other channels for `@everyone`, and allow it for the verified role.',
        ].join('\n'),
      ),
    ],
  });
}

async function config(interaction) {
  const patch = {};
  const changes = [];

  const mode = interaction.options.getString('mode');
  const logChannel = interaction.options.getChannel('log-channel');
  const unverifiedRole = interaction.options.getRole('unverified-role');
  const minAge = interaction.options.getInteger('min-account-age');
  const maxAttempts = interaction.options.getInteger('max-attempts');
  const cooldown = interaction.options.getInteger('cooldown');

  if (mode) {
    patch.mode = mode;
    changes.push(`Mode set to **${mode}**.`);
  }
  if (logChannel) {
    patch.logChannelId = logChannel.id;
    changes.push(`Logs will go to ${logChannel}.`);
  }
  if (unverifiedRole) {
    const problem = verification.roleProblem(interaction.guild, unverifiedRole.id);
    if (problem) {
      return interaction.reply({
        embeds: [ui.notice('danger', 'Cannot use that role', problem)],
        flags: MessageFlags.Ephemeral,
      });
    }
    patch.unverifiedRoleId = unverifiedRole.id;
    changes.push(`New members will get ${unverifiedRole} until they verify.`);
  }
  if (minAge !== null) {
    patch.minAccountAgeDays = minAge;
    changes.push(minAge === 0 ? 'Account age check disabled.' : `Accounts must be **${minAge} day(s)** old.`);
  }
  if (maxAttempts !== null) {
    patch.maxAttempts = maxAttempts;
    changes.push(`Attempts before cooldown: **${maxAttempts}**.`);
  }
  if (cooldown !== null) {
    patch.cooldownMinutes = cooldown;
    changes.push(`Cooldown: **${cooldown} minute(s)**.`);
  }

  if (changes.length === 0) {
    return interaction.reply({
      embeds: [ui.notice('warn', 'Nothing to change', 'Pass at least one option, or run `/verification status`.')],
      flags: MessageFlags.Ephemeral,
    });
  }

  const settings = store.setSettings(interaction.guildId, patch);

  // The panel text mentions the mode, so keep it in sync.
  if (patch.mode) await refreshPanel(interaction.guild, settings).catch(() => {});

  return interaction.reply({
    embeds: [ui.notice('success', 'Settings updated', changes.join('\n'))],
    flags: MessageFlags.Ephemeral,
  });
}

async function refreshPanel(guild, settings) {
  if (!settings.panelChannelId || !settings.panelMessageId) return;
  const channel = await guild.channels.fetch(settings.panelChannelId).catch(() => null);
  const message = await channel?.messages?.fetch(settings.panelMessageId).catch(() => null);
  if (!message?.editable) return;
  const role = guild.roles.cache.get(settings.verifiedRoleId);
  await message.edit(
    ui.panel({ mode: settings.mode, roleName: role?.name, description: settings.panelMessage }),
  );
}

async function status(interaction) {
  const settings = store.getSettings(interaction.guildId);
  const problem = verification.roleProblem(interaction.guild, settings.verifiedRoleId);
  const show = (id, kind) => (id ? (kind === 'role' ? `<@&${id}>` : `<#${id}>`) : '*not set*');

  const embed = ui
    .notice(
      problem ? 'warn' : 'brand',
      'Verification status',
      problem ? `⚠️ ${problem}` : '✅ Ready to verify members.',
    )
    .addFields(
      { name: 'Verified role', value: show(settings.verifiedRoleId, 'role'), inline: true },
      { name: 'Unverified role', value: show(settings.unverifiedRoleId, 'role'), inline: true },
      { name: 'Mode', value: `\`${settings.mode}\``, inline: true },
      { name: 'Panel', value: show(settings.panelChannelId, 'channel'), inline: true },
      { name: 'Log channel', value: show(settings.logChannelId, 'channel'), inline: true },
      {
        name: 'Min account age',
        value: settings.minAccountAgeDays ? `${settings.minAccountAgeDays} day(s)` : 'off',
        inline: true,
      },
      {
        name: 'Attempts',
        value: `${settings.maxAttempts} then ${settings.cooldownMinutes}m cooldown`,
        inline: true,
      },
      {
        name: 'Totals',
        value: `✅ ${settings.stats.verified} verified · ❌ ${settings.stats.failed} failed`,
        inline: true,
      },
    );

  return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

async function reset(interaction) {
  const user = interaction.options.getUser('member');
  sessions.reset(interaction.guildId, user.id);
  return interaction.reply({
    embeds: [ui.notice('success', 'Attempts cleared', `${user} can verify again straight away.`)],
    flags: MessageFlags.Ephemeral,
  });
}

module.exports = { data, execute };
