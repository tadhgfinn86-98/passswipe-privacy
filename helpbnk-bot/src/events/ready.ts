import { ActivityType, Events, type Client } from 'discord.js';
import { getGuildConfig, isWelcomeReady } from '../utils/config';
import { logger } from '../utils/logger';

export function register(client: Client): void {
  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Bot logged in as ${readyClient.user.tag}`);

    try {
      readyClient.user.setPresence({
        status: 'online',
        activities: [{ name: 'builders arrive 🚀', type: ActivityType.Watching }],
      });
    } catch (error) {
      logger.warn(`Could not set the bot presence: ${String(error)}`);
    }

    for (const guild of readyClient.guilds.cache.values()) {
      const config = getGuildConfig(guild.id);

      if (isWelcomeReady(config)) {
        logger.info(`Welcome system enabled for ${guild.name}`);
      } else if (!config.welcomeEnabled) {
        logger.warn(`Welcome system is switched off for ${guild.name} (/setup welcome-messages)`);
      } else {
        logger.warn(`No welcome channel configured for ${guild.name} — run /setup in Discord`);
      }

      if (!config.memberRoleId) {
        logger.warn(`Member role is not configured for ${guild.name}`);
      }
    }
  });
}
