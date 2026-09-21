/**
 * Per-guild bot configuration.
 *
 * Every field is nullable so the bot can boot with nothing configured and
 * explain what still needs setting up instead of crashing.
 */
export interface BotConfig {
  welcomeChannelId: string | null;
  logChannelId: string | null;
  memberRoleId: string | null;
  rulesChannelId: string | null;
  introductionsChannelId: string | null;
  generalChannelId: string | null;
  sendGoodbyeMessage: boolean;
  welcomeEnabled: boolean;
}

/**
 * Shape of `data/config.json`.
 *
 * Configuration is keyed by guild id so the same bot process can serve more
 * than one server without leaking channels between them.
 */
export interface ConfigStore {
  version: number;
  guilds: Record<string, BotConfig>;
}

export const CONFIG_VERSION = 1;

export const DEFAULT_CONFIG: Readonly<BotConfig> = Object.freeze({
  welcomeChannelId: null,
  logChannelId: null,
  memberRoleId: null,
  rulesChannelId: null,
  introductionsChannelId: null,
  generalChannelId: null,
  sendGoodbyeMessage: true,
  welcomeEnabled: true,
});
