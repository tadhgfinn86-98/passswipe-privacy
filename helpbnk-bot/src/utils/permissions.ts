import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildMember,
  type GuildTextBasedChannel,
  type PermissionsBitField,
} from 'discord.js';
import { describeError, logger } from './logger';

export type ChannelCheck =
  { ok: true; channel: GuildTextBasedChannel } | { ok: false; reason: string };

export type RoleResult =
  | { status: 'assigned'; roleName: string }
  | { status: 'skipped'; reason: string }
  | { status: 'failed'; reason: string };

const SENDABLE_TYPES = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
]);

function missingNames(permissions: PermissionsBitField, required: bigint[]): string[] {
  const labels: Array<[bigint, string]> = [
    [PermissionFlagsBits.ViewChannel, 'View Channel'],
    [PermissionFlagsBits.SendMessages, 'Send Messages'],
    [PermissionFlagsBits.EmbedLinks, 'Embed Links'],
    [PermissionFlagsBits.SendMessagesInThreads, 'Send Messages in Threads'],
  ];

  return labels
    .filter(([flag]) => required.includes(flag) && !permissions.has(flag))
    .map(([, label]) => label);
}

/**
 * Resolves a configured channel id and confirms the bot can actually post an
 * embed there. Every failure comes back as a readable reason instead of an
 * exception, so callers can log it and carry on.
 */
export async function resolveSendableChannel(
  guild: Guild,
  channelId: string | null,
  { requireEmbeds = true }: { requireEmbeds?: boolean } = {},
): Promise<ChannelCheck> {
  if (!channelId) {
    return { ok: false, reason: 'no channel is configured' };
  }

  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) {
    return { ok: false, reason: 'the bot member could not be resolved in this server' };
  }

  let channel;
  try {
    channel = await guild.channels.fetch(channelId);
  } catch (error) {
    return {
      ok: false,
      reason: `channel ${channelId} could not be fetched (${describeError(error)})`,
    };
  }

  if (!channel) {
    return { ok: false, reason: `channel ${channelId} no longer exists` };
  }

  if (!SENDABLE_TYPES.has(channel.type) || !channel.isTextBased()) {
    return { ok: false, reason: `<#${channelId}> is not a text channel the bot can post in` };
  }

  const permissions = channel.permissionsFor(me);
  if (!permissions) {
    return { ok: false, reason: `permissions for <#${channelId}> could not be read` };
  }

  const required = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
  if (requireEmbeds) {
    required.push(PermissionFlagsBits.EmbedLinks);
  }
  if (channel.isThread()) {
    required.push(PermissionFlagsBits.SendMessagesInThreads);
  }

  const missing = missingNames(permissions, required);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `the bot is missing ${missing.join(', ')} in <#${channelId}>`,
    };
  }

  return { ok: true, channel: channel as GuildTextBasedChannel };
}

/**
 * Assigns the configured member role, checking Manage Roles and the role
 * hierarchy first. A member who leaves mid-flight is a `skipped`, not an error.
 */
export async function assignMemberRole(
  member: GuildMember,
  roleId: string | null,
): Promise<RoleResult> {
  if (!roleId) {
    return { status: 'skipped', reason: 'member role is not configured' };
  }

  const guild = member.guild;
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) {
    return { status: 'failed', reason: 'the bot member could not be resolved' };
  }

  if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
    return { status: 'failed', reason: 'the bot is missing the Manage Roles permission' };
  }

  const role = guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
  if (!role) {
    return { status: 'failed', reason: `role ${roleId} no longer exists` };
  }

  if (role.managed) {
    return {
      status: 'failed',
      reason: `${role.name} is managed by an integration and cannot be assigned`,
    };
  }

  if (me.roles.highest.comparePositionTo(role) <= 0) {
    return {
      status: 'failed',
      reason: `${role.name} sits above the bot's highest role — move the bot's role higher in Server Settings → Roles`,
    };
  }

  if (member.roles.cache.has(role.id)) {
    return { status: 'skipped', reason: `${member.user.username} already has ${role.name}` };
  }

  try {
    await member.roles.add(role, 'HelpBnk welcome: automatic member role');
    return { status: 'assigned', roleName: role.name };
  } catch (error) {
    // 10007 = Unknown Member: they left between joining and this call.
    const code = (error as { code?: number }).code;
    if (code === 10007) {
      return { status: 'skipped', reason: 'the member left before the role could be assigned' };
    }
    logger.debug(`Role assignment raised: ${describeError(error)}`);
    return { status: 'failed', reason: describeError(error) };
  }
}

/**
 * Runtime guard for administrator-only commands. Discord already hides these
 * commands from non-admins, but server owners can override that per command.
 */
export function isAdministrator(member: GuildMember | null): boolean {
  return member?.permissions.has(PermissionFlagsBits.Administrator) ?? false;
}
