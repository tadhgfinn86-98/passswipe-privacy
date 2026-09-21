import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { Command } from '../types/command';
import { getGuildConfig } from '../utils/config';
import { buildWelcomeEmbed, warningEmbed, welcomeContent, successEmbed } from '../utils/embeds';
import { describeError, logger } from '../utils/logger';
import { isAdministrator, resolveSendableChannel } from '../utils/permissions';

const data = new SlashCommandBuilder()
  .setName('testwelcome')
  .setDescription('Post a test welcome message in the configured welcome channel')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild)
  .addUserOption((option) =>
    option
      .setName('member')
      .setDescription('Preview the welcome for this member (defaults to you)')
      .setRequired(false),
  );

export const testWelcomeCommand: Command = {
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
        content: 'You need the Administrator permission to send a test welcome.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = getGuildConfig(interaction.guildId);

    if (!config.welcomeChannelId) {
      await interaction.reply({
        embeds: [
          warningEmbed(
            'No welcome channel yet',
            'Set one with `/setup welcome-channel` and run this again.',
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const check = await resolveSendableChannel(interaction.guild, config.welcomeChannelId);
    if (!check.ok) {
      await interaction.reply({
        embeds: [
          warningEmbed(
            'Could not post the test',
            `The welcome channel is unusable: ${check.reason}.`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      logger.warn(`/testwelcome blocked: ${check.reason}`);
      return;
    }

    // A test never touches roles — it only shows what the message looks like.
    const target =
      (interaction.options.getMember('member') as GuildMember | null) ??
      (interaction.member as GuildMember);

    try {
      await check.channel.send({
        content: welcomeContent(target),
        embeds: [buildWelcomeEmbed({ member: target, config, preview: true })],
      });

      await interaction.reply({
        embeds: [
          successEmbed(
            'Test welcome sent',
            `Posted in <#${check.channel.id}>. No role was assigned — this was only a preview.`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
      logger.info(`Test welcome sent by ${interaction.user.username}`);
    } catch (error) {
      logger.error('Failed to send the test welcome message', error);
      await interaction.reply({
        embeds: [
          warningEmbed(
            'Could not post the test',
            `Discord rejected the message: ${describeError(error)}`,
          ),
        ],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
