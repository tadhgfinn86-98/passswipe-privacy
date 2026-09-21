import { Events, type Client, type GuildMember } from 'discord.js';
import { getGuildConfig } from '../utils/config';
import { buildWelcomeEmbed, welcomeContent } from '../utils/embeds';
import { logger } from '../utils/logger';
import { assignMemberRole, resolveSendableChannel } from '../utils/permissions';

async function handleJoin(member: GuildMember): Promise<void> {
  if (member.user.bot) {
    logger.debug(`Ignoring bot join: ${member.user.username}`);
    return;
  }

  const config = getGuildConfig(member.guild.id);
  logger.info(`New member joined: ${member.user.username}`);

  if (!config.welcomeEnabled) {
    logger.debug(`Welcome system is disabled for ${member.guild.name}`);
    return;
  }

  // Role first: it is the part members notice if it is missing, and a failure
  // here must never stop the welcome message.
  const roleResult = await assignMemberRole(member, config.memberRoleId);
  switch (roleResult.status) {
    case 'assigned':
      logger.info(`Assigned member role to ${member.user.username}`);
      break;
    case 'skipped':
      logger.warn(`Member role not assigned — ${roleResult.reason}`);
      break;
    case 'failed':
      logger.error(`Unable to assign member role to ${member.user.username}: ${roleResult.reason}`);
      break;
  }

  const check = await resolveSendableChannel(member.guild, config.welcomeChannelId);
  if (!check.ok) {
    logger.warn(`No welcome message sent — ${check.reason}`);
    return;
  }

  try {
    await check.channel.send({
      content: welcomeContent(member),
      embeds: [buildWelcomeEmbed({ member, config })],
    });
    logger.info(`Welcomed ${member.user.username} in #${check.channel.name}`);
  } catch (error) {
    logger.error(`Failed to send the welcome message for ${member.user.username}`, error);
  }
}

export function register(client: Client): void {
  client.on(Events.GuildMemberAdd, (member) => {
    void handleJoin(member).catch((error: unknown) => {
      logger.error('Unhandled error while welcoming a new member', error);
    });
  });
}
