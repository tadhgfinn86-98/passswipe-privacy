import {
  ChannelType,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { Command } from '../types/command';
import type { BotConfig } from '../types/config';
import { missingConfiguration, updateGuildConfig } from '../utils/config';
import { successEmbed, warningEmbed } from '../utils/embeds';
import { logger } from '../utils/logger';
import { isAdministrator, resolveSendableChannel } from '../utils/permissions';

const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement] as const;

const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configure the HelpBnk welcome bot')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .addSubcommand((sub) =>
    sub
      .setName('welcome-channel')
      .setDescription('Where new member welcomes are posted')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The welcome channel')
          .addChannelTypes(...TEXT_CHANNEL_TYPES)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('member-role')
      .setDescription('Role automatically given to new members')
      .addRoleOption((option) =>
        option.setName('role').setDescription('The member role').setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('rules-channel')
      .setDescription('Channel linked as "Read the rules"')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The rules channel')
          .addChannelTypes(...TEXT_CHANNEL_TYPES)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('introductions-channel')
      .setDescription('Channel linked as "Introduce yourself"')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The introductions channel')
          .addChannelTypes(...TEXT_CHANNEL_TYPES)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('general-channel')
      .setDescription('Channel linked as "Meet the community"')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The general channel')
          .addChannelTypes(...TEXT_CHANNEL_TYPES)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('log-channel')
      .setDescription('Optional channel for goodbye messages (defaults to the welcome channel)')
      .addChannelOption((option) =>
        option
          .setName('channel')
          .setDescription('The log channel')
          .addChannelTypes(...TEXT_CHANNEL_TYPES)
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('goodbye')
      .setDescription('Turn goodbye messages on or off')
      .addBooleanOption((option) =>
        option
          .setName('enabled')
          .setDescription('Send a message when someone leaves')
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName('welcome-messages')
      .setDescription('Turn the whole welcome system on or off')
      .addBooleanOption((option) =>
        option.setName('enabled').setDescription('Greet new members').setRequired(true),
      ),
  );

/** Shown after every change so an owner always knows what is left. */
function nextSteps(config: BotConfig): string {
  const missing = missingConfiguration(config);
  if (missing.length === 0) {
    return '\n\nEverything is configured. Try `/testwelcome` to see it in action.';
  }
  return `\n\nStill to do: ${missing.join(' · ')}`;
}

const CHANNEL_SETTINGS: Record<string, { key: keyof BotConfig; label: string }> = {
  'welcome-channel': { key: 'welcomeChannelId', label: 'Welcome channel' },
  'rules-channel': { key: 'rulesChannelId', label: 'Rules channel' },
  'introductions-channel': { key: 'introductionsChannelId', label: 'Introductions channel' },
  'general-channel': { key: 'generalChannelId', label: 'General channel' },
  'log-channel': { key: 'logChannelId', label: 'Log channel' },
};

async function handleChannel(
  interaction: ChatInputCommandInteraction,
  subcommand: string,
): Promise<void> {
  const setting = CHANNEL_SETTINGS[subcommand];
  const guild = interaction.guild;
  if (!setting || !guild) {
    return;
  }

  const channel = interaction.options.getChannel('channel', true);
  const config = await updateGuildConfig(guild.id, { [setting.key]: channel.id });

  // Posting happens in the welcome/log channel, so check those two now rather
  // than letting the first real join fail silently.
  const warnings: string[] = [];
  if (setting.key === 'welcomeChannelId' || setting.key === 'logChannelId') {
    const check = await resolveSendableChannel(guild, channel.id);
    if (!check.ok) {
      warnings.push(`Heads up — ${check.reason}.`);
    }
  }

  const description = `${setting.label} set to <#${channel.id}>.${
    warnings.length > 0 ? `\n\n⚠️ ${warnings.join(' ')}` : ''
  }${nextSteps(config)}`;

  await interaction.reply({
    embeds: [successEmbed('Saved', description)],
    flags: MessageFlags.Ephemeral,
  });
  logger.info(`${setting.label} set to #${channel.name} by ${interaction.user.username}`);
}

async function handleMemberRole(interaction: ChatInputCommandInteraction): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const role = interaction.options.getRole('role', true);
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));

  const warnings: string[] = [];
  if (!me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    warnings.push('the bot is missing the **Manage Roles** permission');
  } else if (me.roles.highest.comparePositionTo(role.id) <= 0) {
    warnings.push(
      `**${role.name}** sits above the bot's highest role — move the bot's role higher in Server Settings → Roles`,
    );
  }

  const config = await updateGuildConfig(guild.id, { memberRoleId: role.id });
  const description = `Member role set to <@&${role.id}>.${
    warnings.length > 0 ? `\n\n⚠️ Heads up — ${warnings.join(' ')}.` : ''
  }${nextSteps(config)}`;

  await interaction.reply({
    embeds: [
      warnings.length > 0
        ? warningEmbed('Saved, with a warning', description)
        : successEmbed('Saved', description),
    ],
    flags: MessageFlags.Ephemeral,
  });
  logger.info(`Member role set to @${role.name} by ${interaction.user.username}`);
}

async function handleToggle(
  interaction: ChatInputCommandInteraction,
  key: 'sendGoodbyeMessage' | 'welcomeEnabled',
  label: string,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) return;

  const enabled = interaction.options.getBoolean('enabled', true);
  const config = await updateGuildConfig(guild.id, { [key]: enabled });

  await interaction.reply({
    embeds: [
      successEmbed(
        'Saved',
        `${label} are now **${enabled ? 'enabled' : 'disabled'}**.${nextSteps(config)}`,
      ),
    ],
    flags: MessageFlags.Ephemeral,
  });
  logger.info(`${label} ${enabled ? 'enabled' : 'disabled'} by ${interaction.user.username}`);
}

export const setupCommand: Command = {
  name: data.name,
  toJSON: () => data.toJSON(),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({
        content: 'Run this inside your server.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    if (!isAdministrator(interaction.member as GuildMember)) {
      await interaction.reply({
        content: 'You need the Administrator permission to change the bot configuration.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'member-role':
        await handleMemberRole(interaction);
        return;
      case 'goodbye':
        await handleToggle(interaction, 'sendGoodbyeMessage', 'Goodbye messages');
        return;
      case 'welcome-messages':
        await handleToggle(interaction, 'welcomeEnabled', 'Welcome messages');
        return;
      default:
        await handleChannel(interaction, subcommand);
        return;
    }
  },
};
