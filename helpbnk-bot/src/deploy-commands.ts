import { REST, Routes } from 'discord.js';
import { commands } from './commands';
import { ConfigurationError, loadEnv } from './utils/env';
import { logger } from './utils/logger';

/**
 * Registers the slash commands with Discord.
 *
 * With GUILD_ID set the commands appear in that server instantly — that is what
 * you want while setting the bot up. Without it they are registered globally,
 * which can take up to an hour to propagate.
 */
async function deploy(): Promise<void> {
  const env = loadEnv();
  const body = commands.map((command) => command.toJSON());
  const rest = new REST({ version: '10' }).setToken(env.token);

  const route = env.guildId
    ? Routes.applicationGuildCommands(env.clientId, env.guildId)
    : Routes.applicationCommands(env.clientId);

  logger.info(
    `Registering ${body.length} command(s) ${env.guildId ? `in guild ${env.guildId}` : 'globally'}`,
  );

  const result = (await rest.put(route, { body })) as unknown[];

  logger.info(
    `Registered ${result.length} command(s): ${body.map((c) => `/${c.name}`).join(', ')}`,
  );
  if (!env.guildId) {
    logger.warn(
      'Global commands can take up to an hour to appear. Set GUILD_ID for instant updates.',
    );
  }
}

void deploy().catch((error: unknown) => {
  if (error instanceof ConfigurationError) {
    logger.error(error.message);
  } else {
    logger.error('Command registration failed', error);
    logger.error('Check that DISCORD_TOKEN and CLIENT_ID belong to the same application.');
  }
  process.exit(1);
});
