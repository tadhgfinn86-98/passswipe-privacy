/**
 * Thin wrapper over the Electron bridge exposed in preload.cjs.
 *
 * If the UI is ever opened in a plain browser the bridge is missing, so we fall
 * back to localStorage. Every path returns raw data — `model.normalise` is what
 * guarantees the shape.
 */

import { normalise, defaultData } from './model.js';

const bridge = typeof window !== 'undefined' ? window.terminal : undefined;
const FALLBACK_KEY = 'matched-betting-terminal:data';

export const isDesktop = Boolean(bridge?.isDesktop);

export { defaultData };

export async function loadData() {
  if (bridge) return normalise(await bridge.load());
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return normalise(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultData();
  }
}

export async function saveData(data) {
  if (bridge) return bridge.save(data);
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
  return { ok: true };
}

export async function exportData(data) {
  if (bridge) return bridge.exportData(data);
  downloadBlob(
    JSON.stringify(data, null, 2),
    `matched-betting-backup-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json',
  );
  return { ok: true };
}

export async function importData() {
  if (bridge) {
    const res = await bridge.importData();
    return res?.ok ? { ...res, data: normalise(res.data) } : res;
  }
  return pickFile('application/json').then((text) => {
    if (text === null) return { ok: false, canceled: true };
    try {
      return { ok: true, data: normalise(JSON.parse(text)) };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

/** CSV round-trip for the bet ledger, handled entirely in the renderer. */
export async function exportCsv(csv, name) {
  if (bridge?.exportCsv) return bridge.exportCsv(csv, name);
  downloadBlob(csv, name, 'text/csv');
  return { ok: true };
}

export async function importCsv() {
  if (bridge?.importCsv) return bridge.importCsv();
  const text = await pickFile('text/csv,.csv');
  return text === null ? { ok: false, canceled: true } : { ok: true, text };
}

export async function revealDataFile() {
  if (bridge) return bridge.revealDataFile();
  return { ok: false, error: 'Only available in the desktop app.' };
}

export async function appInfo() {
  if (bridge) return bridge.appInfo();
  return { version: 'dev', dataPath: 'browser localStorage' };
}

/* ------------------------------------------------------ browser fallbacks -- */

function downloadBlob(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? await file.text() : null);
    };
    input.click();
  });
}
