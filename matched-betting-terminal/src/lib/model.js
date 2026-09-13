/**
 * Data model, migrations and derived selectors.
 *
 * Everything is manually entered — no odds feed. If a live odds provider is
 * ever added it should populate `bet.back.odds` / `bet.lay.odds` through the
 * same shape used here, so nothing downstream has to change.
 */

import { uid } from './format.js';

export const SCHEMA_VERSION = 2;

export const OFFER_TYPES = [
  'Qualifying bet',
  'Free bet (SNR)',
  'Free bet (SR)',
  'Risk-free',
  'Reload',
  'Refund',
  'Casino / wagering',
  'Other',
];

export const BET_STATUSES = ['Pending', 'Back won', 'Lay won', 'Cashed out', 'Void'];

export const OFFER_STATUSES = ['To Do', 'In Progress', 'Done'];

export const ACCOUNT_TYPES = ['Bookmaker', 'Exchange'];

/** Gubbing / restriction states — the thing that decides where you can still bet. */
export const ACCOUNT_STATUSES = ['Active', 'Limited', 'Gubbed', 'Closed'];

export const RECURRENCE = ['None', 'Weekly', 'Fortnightly', 'Monthly'];

export function emptyProfile(name = 'Main') {
  return {
    id: uid(),
    name,
    settings: {
      startingBankroll: 50,
      currency: '£',
      exchange: 'Smarkets',
      commission: 0.02,
    },
    accounts: [],
    offers: [],
    bets: [],
    withdrawals: [],
  };
}

export function defaultData() {
  const profile = emptyProfile();
  return {
    schemaVersion: SCHEMA_VERSION,
    activeProfileId: profile.id,
    profiles: [profile],
  };
}

const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

function normaliseBet(raw) {
  const back = raw.back || {};
  const lay = raw.lay || {};
  return {
    id: raw.id || uid(),
    date: raw.date || '',
    offerId: raw.offerId || '',
    offerType: OFFER_TYPES.includes(raw.offerType) ? raw.offerType : 'Qualifying bet',
    status: BET_STATUSES.includes(raw.status) ? raw.status : 'Pending',
    event: raw.event || '',
    notes: raw.notes || '',
    minutes: num(raw.minutes, 0),
    back: {
      bookmaker: back.bookmaker || '',
      stake: num(back.stake),
      odds: num(back.odds),
    },
    lay: {
      exchange: lay.exchange || '',
      stake: num(lay.stake),
      odds: num(lay.odds),
      commission: num(lay.commission, 0.02),
      liability: num(lay.liability),
    },
    // Expected is locked at entry time; profit is what actually settled.
    expectedProfit: num(raw.expectedProfit),
    profit: num(raw.profit),
  };
}

function normaliseProfile(raw, index) {
  const base = emptyProfile(raw?.name || `Profile ${index + 1}`);
  if (!raw || typeof raw !== 'object') return base;

  const settings = { ...base.settings, ...(raw.settings || {}) };
  settings.startingBankroll = num(settings.startingBankroll, 50);
  const commission = num(settings.commission, 0.02);
  settings.commission = commission >= 0 && commission < 1 ? commission : 0.02;

  return {
    id: raw.id || base.id,
    name: raw.name || base.name,
    settings,
    accounts: (Array.isArray(raw.accounts) ? raw.accounts : []).map((a) => ({
      id: a.id || uid(),
      name: a.name || 'Unnamed',
      type: ACCOUNT_TYPES.includes(a.type) ? a.type : 'Bookmaker',
      balance: num(a.balance),
      status: ACCOUNT_STATUSES.includes(a.status) ? a.status : 'Active',
      commission: num(a.commission, 0.02),
      notes: a.notes || '',
    })),
    offers: (Array.isArray(raw.offers) ? raw.offers : []).map((o) => ({
      id: o.id || uid(),
      bookmaker: o.bookmaker || '',
      description: o.description || '',
      type: OFFER_TYPES.includes(o.type) ? o.type : legacyOfferType(o.type),
      requirement: o.requirement || '',
      deadline: o.deadline || '',
      expectedProfit: num(o.expectedProfit),
      status: OFFER_STATUSES.includes(o.status) ? o.status : 'To Do',
      recurrence: RECURRENCE.includes(o.recurrence) ? o.recurrence : 'None',
      notes: o.notes || '',
    })),
    bets: (Array.isArray(raw.bets) ? raw.bets : []).map(normaliseBet),
    withdrawals: (Array.isArray(raw.withdrawals) ? raw.withdrawals : []).map((w) => ({
      id: w.id || uid(),
      date: w.date || '',
      amount: num(w.amount),
      from: w.from || '',
      notes: w.notes || '',
    })),
  };
}

/** v1 stored 'Sign-up' / 'Reload'; map those onto the richer type list. */
function legacyOfferType(type) {
  if (type === 'Reload') return 'Reload';
  if (type === 'Sign-up') return 'Qualifying bet';
  return 'Other';
}

/** v1 kept a flat {settings, offers, bets}; wrap it as a single profile. */
function migrateV1(raw) {
  const profile = normaliseProfile(
    {
      name: 'Main',
      settings: raw.settings,
      offers: raw.offers,
      bets: (Array.isArray(raw.bets) ? raw.bets : []).map((b) => ({
        id: b.id,
        date: b.date,
        offerId: b.offerId,
        event: b.event,
        status: 'Back won',
        offerType: 'Qualifying bet',
        back: { bookmaker: b.bookmaker, stake: b.stake, odds: 0 },
        lay: { exchange: '', stake: 0, odds: 0, commission: 0.02, liability: 0 },
        profit: b.profit,
        expectedProfit: b.profit,
      })),
    },
    0,
  );
  return { schemaVersion: SCHEMA_VERSION, activeProfileId: profile.id, profiles: [profile] };
}

/** Accepts any historical shape and returns a valid current dataset. */
export function normalise(raw) {
  if (!raw || typeof raw !== 'object') return defaultData();

  // v1 files have no profiles array but do have top-level offers/bets.
  if (!Array.isArray(raw.profiles)) {
    if (Array.isArray(raw.offers) || Array.isArray(raw.bets)) return migrateV1(raw);
    return defaultData();
  }

  const profiles = raw.profiles.map(normaliseProfile);
  if (profiles.length === 0) return defaultData();
  const activeProfileId = profiles.some((p) => p.id === raw.activeProfileId)
    ? raw.activeProfileId
    : profiles[0].id;
  return { schemaVersion: SCHEMA_VERSION, activeProfileId, profiles };
}

/* ------------------------------------------------------------- selectors -- */

export const isSettled = (bet) => bet.status !== 'Pending';

/** Realised profit only counts bets that have actually settled. */
export function realisedProfit(bets) {
  return bets.filter(isSettled).reduce((sum, b) => sum + num(b.profit), 0);
}

export function pendingExpected(bets) {
  return bets.filter((b) => !isSettled(b)).reduce((sum, b) => sum + num(b.expectedProfit), 0);
}

/** Money you cannot touch: back stakes plus exchange liability on open bets. */
export function tiedUp(bets) {
  return bets
    .filter((b) => !isSettled(b))
    .reduce((sum, b) => sum + num(b.back.stake) + num(b.lay.liability), 0);
}

export function totalWithdrawn(withdrawals) {
  return withdrawals.reduce((sum, w) => sum + num(w.amount), 0);
}

export function accountsTotal(accounts, type) {
  return accounts
    .filter((a) => (type ? a.type === type : true))
    .reduce((sum, a) => sum + num(a.balance), 0);
}

/** Groups settled profit by any key function, sorted biggest first. */
export function profitBy(bets, keyFn) {
  const map = new Map();
  bets.filter(isSettled).forEach((bet) => {
    const key = keyFn(bet) || '—';
    const entry = map.get(key) || { key, profit: 0, count: 0 };
    entry.profit += num(bet.profit);
    entry.count += 1;
    map.set(key, entry);
  });
  return [...map.values()].sort((a, b) => b.profit - a.profit);
}

/** Net profit per ISO date, for the calendar. */
export function profitByDay(bets) {
  const map = new Map();
  bets.filter(isSettled).forEach((bet) => {
    if (!bet.date) return;
    map.set(bet.date, (map.get(bet.date) || 0) + num(bet.profit));
  });
  return map;
}

/** Cumulative running bankroll, oldest first. */
export function runningBankroll(bets, startingBankroll) {
  const ordered = bets.filter(isSettled).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let running = startingBankroll;
  const series = [{ label: 'Start', value: running }];
  ordered.forEach((bet) => {
    running += num(bet.profit);
    series.push({ label: bet.date, value: running });
  });
  return series;
}

/** Next occurrence of a recurring offer, based on its deadline. */
export function nextDue(offer) {
  if (!offer.deadline || offer.recurrence === 'None') return offer.deadline || '';
  const step = { Weekly: 7, Fortnightly: 14, Monthly: 30 }[offer.recurrence] || 0;
  if (!step) return offer.deadline;
  const start = new Date(`${offer.deadline}T00:00:00`);
  if (Number.isNaN(start.getTime())) return offer.deadline;
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next = new Date(start);
  while (next < todayMidnight) next.setDate(next.getDate() + step);
  return next.toISOString().slice(0, 10);
}
