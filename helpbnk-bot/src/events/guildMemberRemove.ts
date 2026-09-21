import { Events, type Client, type GuildMember, type PartialGuildMember } from 'discord.js';
import { getGuildConfig } from '../utils/config';
import { buildGoodbyeMessage } from '../utils/embeds';
import { logger } from '../utils/logger';
import { resolveSendableChannel } from '../utils/permissions';

async function handleLeave(member: GuildMember | PartialGuildMember): Promise<void> {
  if (member.user.bot) {
    return;
  }

  const config = getGuildConfig(member.guild.id);
  logger.info(`Member left: ${member.user.username}`);

  if (!config.sendGoodbyeMessage) {
    return;
  }

  // Goodbyes go to the log channel when one is set, otherwise the welcome channel.
  const targetId = config.logChannelId ?? config.welcomeChannelId;
  const check = await resolveSendableChannel(member.guild, targetId, { requireEmbeds: false });
  if (!check.ok) {
    logger.warn(`No goodbye message sent — ${check.reason}`);
    return;
  }

  // memberCount has already been decremented by the time this event fires.
  const countBeforeLeaving = member.guild.memberCount + 1;

  try {
    await check.channel.send({
      content: buildGoodbyeMessage(member.user.username, countBeforeLeaving),
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    logger.error(`Failed to send the goodbye message for ${member.user.username}`, error);
  }
}

export function register(client: Client): void {
  client.on(Events.GuildMemberRemove, (member) => {
    void handleLeave(member).catch((error: unknown) => {
      logger.error('Unhandled error while handling a member leaving', error);
    });
  });
}
