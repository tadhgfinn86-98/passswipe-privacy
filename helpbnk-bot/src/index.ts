import { Client, Events, GatewayIntentBits, Partials, RESTEvents } from 'discord.js';
import { eventRegistrars } from './events';
import { loadConfigStore } from './utils/config';
import { ConfigurationError, loadEnv } from './utils/env';
import { describeError, logger } from './utils/logger';

/**
 * Only the intents the bot actually needs:
 *  - Guilds       : channel and role caches, slash command routing
 *  - GuildMembers : join and leave events (privileged — enable it in the portal)
 */
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
  // Members who were never cached still fire a usable leave event.
  partials: [Partials.GuildMember],
});

function attachProcessGuards(): void {
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception — the bot is still running', error);
  });

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down`);
    client
      .destroy()
      .catch((error: unknown) => logger.error('Error while disconnecting', error))
      .finally(() => process.exit(0));
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

function attachClientLogging(): void {
  client.on(Events.Error, (error) => logger.error('Discord client error', error));
  client.on(Events.Warn, (message) => logger.warn(`Discord: ${message}`));
  client.on(Events.ShardDisconnect, (_event, shardId) =>
    logger.warn(`Shard ${shardId} disconnected — discord.js will reconnect`),
  );
  client.on(Events.ShardReconnecting, (shardId) => logger.info(`Shard ${shardId} reconnecting`));

  // discord.js queues and retries rate limited requests itself; this is here so
  // the behaviour is visible rather than looking like the bot is stuck.
  client.rest.on(RESTEvents.RateLimited, (info) => {
    logger.warn(`Rate limited on ${info.method} ${info.route} — retrying in ${info.timeToReset}ms`);
  });
}

async function main(): Promise<void> {
  const env = loadEnv();

  attachProcessGuards();
  attachClientLogging();

  await loadConfigStore();

  for (const register of eventRegistrars) {
    register(client);
  }

  try {
    await client.login(env.token);
  } catch (error) {
    const message = describeError(error);
    const status = (error as { status?: number }).status;

    if (message.includes('disallowed intents')) {
      logger.error(
        'Login failed: enable the SERVER MEMBERS INTENT in the Discord Developer Portal → Bot → Privileged Gateway Intents',
      );
    } else if (status === 401 || message.toLowerCase().includes('token')) {
      logger.error(
        'Login failed: DISCORD_TOKEN is invalid. Reset it in the Developer Portal → Bot',
      );
    } else if (message.includes('ENOTFOUND') || message.includes('fetch failed')) {
      logger.error('Login failed: could not reach discord.com. Check the network connection.');
    } else {
      logger.error('Login failed', error);
    }

    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  if (error instanceof ConfigurationError) {
    // Already logged line by line above — no stack trace needed for a typo in .env.
    logger.error(error.message);
  } else {
    logger.error('The bot could not start', error);
  }
  process.exit(1);
});
