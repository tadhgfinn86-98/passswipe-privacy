export function money(value, currency = '£') {
  if (!Number.isFinite(value)) return `${currency}—`;
  const sign = value < 0 ? '-' : '';
  return `${sign}${currency}${Math.abs(value).toFixed(2)}`;
}

/** Money with an explicit + on gains, for profit/loss columns. */
export function signedMoney(value, currency = '£') {
  if (!Number.isFinite(value)) return `${currency}—`;
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${currency}${Math.abs(value).toFixed(2)}`;
}

export function percent(value, dp = 1) {
  if (!Number.isFinite(value)) return '—';
  return `${(value * 100).toFixed(dp)}%`;
}

export function num(value, dp = 2) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(dp);
}

/** Parses a user-typed field; empty or junk becomes NaN, not 0. */
export function parseNum(text) {
  if (typeof text === 'number') return text;
  if (typeof text !== 'string' || text.trim() === '') return NaN;
  return Number(text.replace(/[£$€,\s]/g, ''));
}

export function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateLong(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

/** Whole days from today to an ISO date; negative means overdue. */
export function daysUntil(iso) {
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - start) / 86400000);
}

export function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
