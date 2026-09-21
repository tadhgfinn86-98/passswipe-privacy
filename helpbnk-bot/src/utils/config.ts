import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { CONFIG_VERSION, DEFAULT_CONFIG, type BotConfig, type ConfigStore } from '../types/config';
import { logger } from './logger';

const CONFIG_PATH = resolve(process.cwd(), 'data', 'config.json');

let store: ConfigStore = { version: CONFIG_VERSION, guilds: {} };
let loaded = false;

/** Serialises writes so two fast `/setup` calls cannot clobber each other. */
let writeChain: Promise<void> = Promise.resolve();

function emptyStore(): ConfigStore {
  return { version: CONFIG_VERSION, guilds: {} };
}

/** Fills in any key a hand-edited or older config file is missing. */
function normalise(raw: unknown): BotConfig {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<BotConfig>;
  const id = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);
  const flag = (value: unknown, fallback: boolean): boolean =>
    typeof value === 'boolean' ? value : fallback;

  return {
    welcomeChannelId: id(source.welcomeChannelId),
    logChannelId: id(source.logChannelId),
    memberRoleId: id(source.memberRoleId),
    rulesChannelId: id(source.rulesChannelId),
    introductionsChannelId: id(source.introductionsChannelId),
    generalChannelId: id(source.generalChannelId),
    sendGoodbyeMessage: flag(source.sendGoodbyeMessage, DEFAULT_CONFIG.sendGoodbyeMessage),
    welcomeEnabled: flag(source.welcomeEnabled, DEFAULT_CONFIG.welcomeEnabled),
  };
}

function parseStore(contents: string): ConfigStore {
  const parsed: unknown = JSON.parse(contents);
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('config.json does not contain an object');
  }

  const guildsRaw = (parsed as { guilds?: unknown }).guilds;
  const guilds: Record<string, BotConfig> = {};

  if (typeof guildsRaw === 'object' && guildsRaw !== null) {
    for (const [guildId, value] of Object.entries(guildsRaw as Record<string, unknown>)) {
      guilds[guildId] = normalise(value);
    }
  }

  return { version: CONFIG_VERSION, guilds };
}

/**
 * Loads `data/config.json`, creating the directory (and an empty store) the
 * first time the bot runs. A corrupt file is moved aside rather than thrown
 * away, and the bot continues with defaults.
 */
export async function loadConfigStore(): Promise<void> {
  await mkdir(dirname(CONFIG_PATH), { recursive: true });

  try {
    const contents = await readFile(CONFIG_PATH, 'utf8');
    store = parseStore(contents);
    loaded = true;
    const count = Object.keys(store.guilds).length;
    logger.info(`Configuration loaded (${count} guild${count === 1 ? '' : 's'} configured)`);
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      store = emptyStore();
      loaded = true;
      await persist();
      logger.info('No configuration found yet — created data/config.json. Run /setup in Discord.');
      return;
    }

    const backup = `${CONFIG_PATH}.broken-${Date.now()}`;
    logger.error(`Could not read data/config.json, starting from defaults`, error);
    try {
      await rename(CONFIG_PATH, backup);
      logger.warn(`Moved the unreadable config to ${backup}`);
    } catch (renameError) {
      logger.warn(`Could not back up the unreadable config: ${String(renameError)}`);
    }

    store = emptyStore();
    loaded = true;
    await persist();
  }
}

/** Atomic write: a crash mid-save can never leave a half-written config. */
async function persist(): Promise<void> {
  const temporary = `${CONFIG_PATH}.tmp`;
  const payload = `${JSON.stringify(store, null, 2)}\n`;

  writeChain = writeChain
    .catch(() => undefined)
    .then(async () => {
      await mkdir(dirname(CONFIG_PATH), { recursive: true });
      await writeFile(temporary, payload, 'utf8');
      await rename(temporary, CONFIG_PATH);
    });

  await writeChain;
}

/** Current configuration for a guild — always a complete object. */
export function getGuildConfig(guildId: string): BotConfig {
  if (!loaded) {
    logger.warn('Configuration was read before it finished loading — using defaults');
  }
  return { ...DEFAULT_CONFIG, ...store.guilds[guildId] };
}

/** Applies a partial update and saves it to disk. */
export async function updateGuildConfig(
  guildId: string,
  patch: Partial<BotConfig>,
): Promise<BotConfig> {
  const next: BotConfig = { ...getGuildConfig(guildId), ...patch };
  store.guilds[guildId] = next;
  await persist();
  return next;
}

/** Human-readable list of the things still missing, for onboarding messages. */
export function missingConfiguration(config: BotConfig): string[] {
  const missing: string[] = [];
  if (!config.welcomeChannelId) missing.push('`/setup welcome-channel`');
  if (!config.memberRoleId) missing.push('`/setup member-role`');
  if (!config.rulesChannelId) missing.push('`/setup rules-channel`');
  if (!config.introductionsChannelId) missing.push('`/setup introductions-channel`');
  if (!config.generalChannelId) missing.push('`/setup general-channel`');
  return missing;
}

/** The one setting the welcome system cannot work without. */
export function isWelcomeReady(config: BotConfig): boolean {
  return config.welcomeEnabled && config.welcomeChannelId !== null;
}

export const configPath = CONFIG_PATH;
