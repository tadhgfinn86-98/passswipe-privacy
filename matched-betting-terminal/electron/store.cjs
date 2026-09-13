'use strict';

/**
 * Local JSON persistence. Everything lives in a single file inside Electron's
 * per-user data directory (on Windows: %APPDATA%\Matched Betting Terminal).
 * No network, no accounts.
 *
 * Normalisation and migration live in src/lib/model.js so the renderer and the
 * main process agree on the shape; this module keeps a mirrored copy of the
 * pieces it needs because the main process cannot import ES modules from src.
 */

const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const FILE_NAME = 'terminal-data.json';
const SCHEMA_VERSION = 2;

function dataPath() {
  return path.join(app.getPath('userData'), FILE_NAME);
}

/**
 * The main process only needs to guarantee the file is valid JSON with the
 * right top-level shape; the renderer runs the full normalisation on load.
 */
function shallowNormalise(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw.profiles)) return raw;
  // A v1 file (flat offers/bets) is passed through untouched — the renderer's
  // migration turns it into a profile.
  if (Array.isArray(raw.offers) || Array.isArray(raw.bets)) return raw;
  return null;
}

function load() {
  const file = dataPath();
  try {
    if (!fs.existsSync(file)) return null;
    return shallowNormalise(JSON.parse(fs.readFileSync(file, 'utf8')));
  } catch (err) {
    // A corrupt file must never block startup — set it aside and start clean.
    try {
      fs.renameSync(file, `${file}.corrupt-${Date.now()}`);
    } catch {
      /* nothing more we can do */
    }
    console.error('Could not read saved data, starting fresh:', err.message);
    return null;
  }
}

/** Atomic write: a crash mid-save can never leave a half-written data file. */
function save(data) {
  const file = dataPath();
  const tmp = `${file}.tmp`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return { ok: true };
}

module.exports = { load, save, shallowNormalise, dataPath, SCHEMA_VERSION };
