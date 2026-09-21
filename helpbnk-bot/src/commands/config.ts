import {
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from 'discord.js';
import type { Command } from '../types/command';
import { getGuildConfig, missingConfiguration } from '../utils/config';
import { buildConfigEmbed } from '../utils/embeds';
import { isAdministrator } from '../utils/permissions';

const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription('Show the current HelpBnk bot configuration')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .setContexts(InteractionContextType.Guild);

export const configCommand: Command = {
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
        content: 'You need the Administrator permission to view the bot configuration.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const config = getGuildConfig(interaction.guildId);
    const embed = buildConfigEmbed(interaction.guild, config);
    const missing = missingConfiguration(config);

    if (missing.length > 0) {
      embed.addFields({
        name: 'Still to configure',
        value: missing.join('\n'),
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
