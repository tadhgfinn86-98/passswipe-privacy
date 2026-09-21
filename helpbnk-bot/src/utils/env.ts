import { config as loadDotenv } from 'dotenv';
import { logger } from './logger';

loadDotenv();

export interface Env {
  token: string;
  clientId: string;
  guildId: string | null;
}

const SNOWFLAKE = /^\d{17,20}$/;

/** Thrown for problems the operator can fix in .env — logged without a stack. */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Reads and validates the environment.
 *
 * Throws with an actionable message rather than letting discord.js fail with
 * an opaque "An invalid token was provided" later on.
 */
export function loadEnv(): Env {
  const problems: string[] = [];

  const token = process.env.DISCORD_TOKEN?.trim() ?? '';
  const clientId = process.env.CLIENT_ID?.trim() ?? '';
  const guildId = process.env.GUILD_ID?.trim() ?? '';

  if (!token) {
    problems.push('DISCORD_TOKEN is missing. Copy it from the Discord Developer Portal → Bot.');
  }

  if (!clientId) {
    problems.push(
      'CLIENT_ID is missing. Copy the Application ID from the Developer Portal → General Information.',
    );
  } else if (!SNOWFLAKE.test(clientId)) {
    problems.push(`CLIENT_ID does not look like a Discord ID: "${clientId}"`);
  }

  if (guildId && !SNOWFLAKE.test(guildId)) {
    problems.push(`GUILD_ID does not look like a Discord ID: "${guildId}"`);
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      logger.error(problem);
    }
    throw new ConfigurationError(
      'Environment validation failed. Copy .env.example to .env and fill in the values.',
    );
  }

  return {
    token,
    clientId,
    guildId: guildId || null,
  };
}
