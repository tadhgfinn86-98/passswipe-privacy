'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_SETTINGS = {
  verifiedRoleId: null,
  unverifiedRoleId: null,
  logChannelId: null,
  panelChannelId: null,
  panelMessageId: null,
  panelMessage: null,
  mode: 'captcha', // 'captcha' | 'math' | 'button'
  minAccountAgeDays: 0,
  maxAttempts: 3,
  cooldownMinutes: 10,
  stats: { verified: 0, failed: 0 },
};

const dataFile = path.resolve(
  __dirname,
  '../..',
  process.env.DATA_FILE || './data/guilds.json',
);

let cache = null;
let writeQueue = Promise.resolve();

function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[store] ${dataFile} is unreadable, starting empty:`, err.message);
    }
    cache = {};
  }
  return cache;
}

/** Settings for a guild, merged over the defaults. Never returns null. */
function getSettings(guildId) {
  const all = load();
  return { ...DEFAULT_SETTINGS, ...(all[guildId] || {}) };
}

/** Merge a patch into a guild's settings and persist. Returns the merged settings. */
function setSettings(guildId, patch) {
  const all = load();
  const merged = { ...getSettings(guildId), ...patch };
  all[guildId] = merged;
  persist();
  return merged;
}

function bumpStat(guildId, key) {
  const current = getSettings(guildId);
  const stats = { ...current.stats, [key]: (current.stats[key] || 0) + 1 };
  return setSettings(guildId, { stats });
}

/** Serialised, atomic writes: temp file + rename, so a crash can't truncate the store. */
function persist() {
  const snapshot = JSON.stringify(cache, null, 2);
  writeQueue = writeQueue
    .then(async () => {
      await fsp.mkdir(path.dirname(dataFile), { recursive: true });
      const tmp = `${dataFile}.${process.pid}.tmp`;
      await fsp.writeFile(tmp, snapshot, 'utf8');
      await fsp.rename(tmp, dataFile);
    })
    .catch((err) => console.error('[store] failed to persist settings:', err));
  return writeQueue;
}

module.exports = { DEFAULT_SETTINGS, getSettings, setSettings, bumpStat, flush: () => writeQueue, dataFile };
