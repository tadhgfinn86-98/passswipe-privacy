import { EmbedBuilder, type Guild, type GuildMember } from 'discord.js';
import type { BotConfig } from '../types/config';

/** Everything brand-related lives here so a rebrand is a one-file change. */
export const BRAND = {
  name: 'HelpBnk',
  tagline: 'Build. Connect. Grow.',
  footer: 'HelpBnk • Build. Connect. Grow.',
  /** Deep indigo — confident without looking like a default Discord bot. */
  colour: 0x4f46e5,
  colourMuted: 0x4b5563,
  colourSuccess: 0x10b981,
  colourWarning: 0xf59e0b,
} as const;

/** `<#123>` renders as a clickable channel; nothing renders when unset. */
function channelMention(channelId: string | null): string | null {
  return channelId ? `<#${channelId}>` : null;
}

function baseEmbed(guild: Guild | null): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colour)
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  if (guild) {
    const icon = guild.iconURL({ size: 128 });
    embed.setAuthor(icon ? { name: guild.name, iconURL: icon } : { name: guild.name });
  }

  return embed;
}

/**
 * The line posted above the embed. The mention lives here (and not in the
 * embed) because only message content produces a real ping.
 */
export function welcomeContent(member: GuildMember): string {
  return `Welcome to ${BRAND.name}, <@${member.id}>! 🚀`;
}

export interface WelcomeEmbedOptions {
  member: GuildMember;
  config: BotConfig;
  /** Overridden by /testwelcome so the preview is obviously a preview. */
  memberCount?: number;
  preview?: boolean;
}

export function buildWelcomeEmbed({
  member,
  config,
  memberCount,
  preview = false,
}: WelcomeEmbedOptions): EmbedBuilder {
  const count = memberCount ?? member.guild.memberCount;
  const lines: string[] = [
    `**${member.user.username}** just joined — you're member **#${count}**.`,
    'A community for entrepreneurs, creators and builders.',
  ];

  const startHere = [
    ['📜', 'Read the rules', channelMention(config.rulesChannelId)],
    ['💬', 'Introduce yourself', channelMention(config.introductionsChannelId)],
    ['🤝', 'Meet the community', channelMention(config.generalChannelId)],
  ]
    .filter((entry): entry is [string, string, string] => entry[2] !== null)
    .map(([emoji, label, mention]) => `${emoji} ${label} → ${mention}`);

  if (startHere.length > 0) {
    lines.push('', '**Start here**', ...startHere);
  }

  lines.push('', 'Glad to have you here. Build something great.');

  const embed = baseEmbed(member.guild)
    .setTitle(`Welcome to ${BRAND.name} 🚀`)
    .setDescription(lines.join('\n'))
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }));

  if (preview) {
    embed.setColor(BRAND.colourMuted).setTitle(`Welcome to ${BRAND.name} 🚀 (test)`);
  }

  return embed;
}

/**
 * Goodbye is deliberately plain text: it keeps the tone low-key and works
 * even when the bot is missing Embed Links in the log channel.
 */
export function buildGoodbyeMessage(username: string, memberCountBefore: number): string {
  return [
    `👋 **${username}** has left ${BRAND.name}.`,
    `We had ${memberCountBefore} members before they left.`,
  ].join('\n');
}

function settingLine(label: string, value: string | null, fallback = '*Not set*'): string {
  return `**${label}:** ${value ?? fallback}`;
}

export function buildConfigEmbed(guild: Guild, config: BotConfig): EmbedBuilder {
  const roleMention = config.memberRoleId ? `<@&${config.memberRoleId}>` : null;

  return baseEmbed(guild)
    .setTitle(`${BRAND.name} Bot Configuration`)
    .setDescription(
      [
        settingLine('Welcome system', config.welcomeEnabled ? 'Enabled' : 'Disabled'),
        settingLine('Welcome channel', channelMention(config.welcomeChannelId)),
        settingLine('Member role', roleMention),
        settingLine('Rules', channelMention(config.rulesChannelId)),
        settingLine('Introductions', channelMention(config.introductionsChannelId)),
        settingLine('General', channelMention(config.generalChannelId)),
        settingLine('Log channel', channelMention(config.logChannelId), '*Not set (uses welcome)*'),
        settingLine('Goodbye messages', config.sendGoodbyeMessage ? 'Enabled' : 'Disabled'),
      ].join('\n'),
    );
}

/** Small helpers so command replies look consistent. */
export function successEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.colourSuccess)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: BRAND.footer });
}

export function warningEmbed(title: string, description: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND.colourWarning)
    .setTitle(title)
    .setDescription(description)
    .setFooter({ text: BRAND.footer });
}
