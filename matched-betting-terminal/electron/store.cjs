'use strict';

/**
 * Local JSON persistence. Everything lives in a single file inside Electron's
 * per-user data directory (on Windows: %APPDATA%\Matched Betting Terminal).
 * No network, no accounts.
 */

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const FILE_NAME = 'terminal-data.json';
const SCHEMA_VERSION = 1;

function defaultData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: {
      startingBankroll: 50,
      currency: '£',
      exchange: 'Smarkets',
      commission: 0.02,
    },
    offers: [],
    bets: [],
  };
}

function dataPath() {
  return path.join(app.getPath('userData'), FILE_NAME);
}

/** Fills in anything missing so an old or hand-edited file still loads. */
function normalise(raw) {
  const base = defaultData();
  if (!raw || typeof raw !== 'object') return base;
  const settings = { ...base.settings, ...(raw.settings || {}) };
  const startingBankroll = Number(settings.startingBankroll);
  settings.startingBankroll = Number.isFinite(startingBankroll) ? startingBankroll : 50;
  const commission = Number(settings.commission);
  settings.commission = Number.isFinite(commission) && commission >= 0 && commission < 1 ? commission : 0.02;
  return {
    schemaVersion: SCHEMA_VERSION,
    settings,
    offers: Array.isArray(raw.offers) ? raw.offers : [],
    bets: Array.isArray(raw.bets) ? raw.bets : [],
  };
}

function load() {
  const file = dataPath();
  try {
    if (!fs.existsSync(file)) return defaultData();
    return normalise(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) {
    // A corrupt file must never block startup — set it aside and start clean.
    try {
      fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
    } catch {
      /* nothing more we can do */
    }
    console.error('Could not read saved data, starting fresh:', err.message);
    return defaultData();
  }
}

/** Atomic write: a crash mid-save can never leave a half-written data file. */
function save(data) {
  const file = dataPath();
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(normalise(data), null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return { ok: true };
}

module.exports = { load, save, normalise, defaultData, dataPath, SCHEMA_VERSION };
