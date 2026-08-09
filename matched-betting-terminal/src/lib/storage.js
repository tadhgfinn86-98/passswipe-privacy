/**
 * Thin wrapper over the Electron bridge exposed in preload.cjs.
 *
 * If the UI is ever opened in a plain browser (e.g. `vite` on its own) the
 * bridge is missing, so we fall back to localStorage. That keeps the app
 * usable for quick UI work without the desktop shell.
 */

const bridge = typeof window !== 'undefined' ? window.terminal : undefined;
const FALLBACK_KEY = 'matched-betting-terminal:data';

export const isDesktop = Boolean(bridge?.isDesktop);

export const DEFAULT_DATA = {
  schemaVersion: 1,
  settings: {
    startingBankroll: 50,
    currency: '£',
    exchange: 'Smarkets',
    commission: 0.02,
  },
  offers: [],
  bets: [],
};

export async function loadData() {
  if (bridge) return bridge.load();
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? { ...DEFAULT_DATA, ...JSON.parse(raw) } : DEFAULT_DATA;
  } catch {
    return DEFAULT_DATA;
  }
}

export async function saveData(data) {
  if (bridge) return bridge.save(data);
  localStorage.setItem(FALLBACK_KEY, JSON.stringify(data));
  return { ok: true };
}

export async function exportData(data) {
  if (bridge) return bridge.exportData(data);
  // Browser fallback: trigger a download.
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `matched-betting-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  return { ok: true };
}

export async function importData() {
  if (bridge) return bridge.importData();
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve({ ok: false, canceled: true });
      try {
        resolve({ ok: true, data: JSON.parse(await file.text()) });
      } catch (err) {
        resolve({ ok: false, error: err.message });
      }
    };
    input.click();
  });
}

export async function revealDataFile() {
  if (bridge) return bridge.revealDataFile();
  return { ok: false, error: 'Only available in the desktop app.' };
}

export async function appInfo() {
  if (bridge) return bridge.appInfo();
  return { version: 'dev', dataPath: 'browser localStorage' };
}
