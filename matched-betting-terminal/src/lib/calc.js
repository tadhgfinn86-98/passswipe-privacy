/**
 * Matched betting maths.
 *
 * Commission is a decimal throughout (0.02 = 2%) and is charged by the
 * exchange on net winnings when the lay bet wins.
 */

export const MODES = {
  QUALIFYING: 'QUALIFYING',
  FREEBET: 'FREEBET',
  FREEBET_SR: 'FREEBET_SR',
};

export const LAY_MODES = {
  NORMAL: 'NORMAL',
  UNDERLAY: 'UNDERLAY',
  OVERLAY: 'OVERLAY',
};

/**
 * Validates calculator inputs and returns human-readable problems.
 * An empty list means the numbers are safe to compute with.
 */
export function validate({ backStake, backOdds, layOdds, commission }) {
  const errors = [];
  const finite = (v) => Number.isFinite(v);

  if (!finite(backStake) || backStake <= 0) errors.push('Stake must be a number greater than 0.');
  if (!finite(backOdds) || backOdds <= 1) errors.push('Back odds must be greater than 1.00.');
  if (!finite(layOdds) || layOdds <= 1) errors.push('Lay odds must be greater than 1.00.');
  if (!finite(commission) || commission < 0 || commission >= 1) {
    errors.push('Commission must be between 0% and 99%.');
  }
  if (finite(layOdds) && finite(commission) && layOdds - commission <= 0) {
    errors.push('Lay odds minus commission must be greater than 0.');
  }
  return errors;
}

/** The equal-profit lay stake for each bet type. */
export function normalLayStake(mode, { backStake, backOdds, layOdds, commission }) {
  // A stake-returned free bet behaves like cash at the bookmaker.
  if (mode === MODES.FREEBET) return ((backOdds - 1) * backStake) / (layOdds - commission);
  return (backOdds * backStake) / (layOdds - commission);
}

/**
 * Underlay lays less than the equal-profit stake (shifting profit to a back
 * win); overlay lays more (shifting it to a lay win). The adjustment is an
 * explicit percentage so the trade-off is visible rather than implied.
 */
export function applyLayMode(layStake, layMode, adjustPct = 0.1) {
  if (layMode === LAY_MODES.UNDERLAY) return layStake * (1 - adjustPct);
  if (layMode === LAY_MODES.OVERLAY) return layStake * (1 + adjustPct);
  return layStake;
}

/** Outcome breakdown for a back/lay pair. */
export function settle({ mode, backStake, backOdds, layStake, layOdds, commission }) {
  const liability = layStake * (layOdds - 1);
  const stakeReturned = mode !== MODES.FREEBET; // SNR keeps winnings only

  const bookmakerIfBackWins = backStake * (backOdds - 1);
  const bookmakerIfLayWins = stakeReturned ? -backStake : 0;

  const ifBackWins = bookmakerIfBackWins - liability;
  const ifLayWins = layStake * (1 - commission) + bookmakerIfLayWins;

  const locked = Math.min(ifBackWins, ifLayWins);
  return {
    layStake,
    liability,
    bookmakerIfBackWins,
    bookmakerIfLayWins,
    exchangeIfLayWins: layStake * (1 - commission),
    ifBackWins,
    ifLayWins,
    locked,
    retention: backStake > 0 ? locked / backStake : 0,
    spread: Math.abs(ifBackWins - ifLayWins),
  };
}

export function calculate(mode, inputs, layMode = LAY_MODES.NORMAL, adjustPct = 0.1) {
  const errors = validate(inputs);
  if (errors.length > 0) return { errors, result: null };
  const layStake = applyLayMode(normalLayStake(mode, inputs), layMode, adjustPct);
  return { errors: [], result: settle({ mode, ...inputs, layStake }) };
}

/* ---------------------------------------------------------------- dutching -- */

/**
 * Splits a total stake across outcomes so every winner returns the same.
 * stake_i = total x (1/odds_i) / sum(1/odds)
 */
export function dutch(total, oddsList) {
  const odds = oddsList.filter((o) => Number.isFinite(o) && o > 1);
  if (!Number.isFinite(total) || total <= 0 || odds.length < 2) {
    return { errors: ['Enter a total stake and at least two odds above 1.00.'], result: null };
  }
  const inverseSum = odds.reduce((sum, o) => sum + 1 / o, 0);
  const stakes = odds.map((o) => (total * (1 / o)) / inverseSum);
  const payout = total / inverseSum;
  return {
    errors: [],
    result: {
      stakes,
      odds,
      payout,
      profit: payout - total,
      margin: inverseSum, // < 1 means an arbitrage
      roi: (payout - total) / total,
    },
  };
}

/* --------------------------------------------------------------- each-way -- */

/**
 * Each-way qualifier: the bet is two stakes (win + place). The place part runs
 * at reduced odds — ((backOdds - 1) / placeTerms) + 1 — and is laid separately.
 */
export function eachWay({ unitStake, backOdds, placeTerms, layWinOdds, layPlaceOdds, commission }) {
  const errors = [];
  if (!Number.isFinite(unitStake) || unitStake <= 0) errors.push('Unit stake must be greater than 0.');
  if (!Number.isFinite(backOdds) || backOdds <= 1) errors.push('Back odds must be greater than 1.00.');
  if (!Number.isFinite(placeTerms) || placeTerms < 1) errors.push('Place terms must be 1 or more (e.g. 5 for 1/5).');
  if (!Number.isFinite(layWinOdds) || layWinOdds <= 1) errors.push('Lay win odds must be greater than 1.00.');
  if (!Number.isFinite(layPlaceOdds) || layPlaceOdds <= 1) errors.push('Lay place odds must be greater than 1.00.');
  if (!Number.isFinite(commission) || commission < 0 || commission >= 1) errors.push('Commission must be 0–99%.');
  if (errors.length) return { errors, result: null };

  const placeOdds = (backOdds - 1) / placeTerms + 1;
  const layWinStake = (unitStake * backOdds) / (layWinOdds - commission);
  const layPlaceStake = (unitStake * placeOdds) / (layPlaceOdds - commission);
  const winLiability = layWinStake * (layWinOdds - 1);
  const placeLiability = layPlaceStake * (layPlaceOdds - 1);
  const totalStaked = unitStake * 2;

  // Horse wins: both back parts pay, both lays lose.
  const ifWins = unitStake * (backOdds - 1) + unitStake * (placeOdds - 1) - winLiability - placeLiability;
  // Horse places only: win part loses, place part pays, win lay pays.
  const ifPlaces =
    -unitStake + unitStake * (placeOdds - 1) + layWinStake * (1 - commission) - placeLiability;
  // Horse unplaced: both back parts lose, both lays pay.
  const ifUnplaced = -totalStaked + (layWinStake + layPlaceStake) * (1 - commission);

  return {
    errors: [],
    result: {
      placeOdds,
      layWinStake,
      layPlaceStake,
      winLiability,
      placeLiability,
      totalLiability: winLiability + placeLiability,
      totalStaked,
      ifWins,
      ifPlaces,
      ifUnplaced,
      worst: Math.min(ifWins, ifPlaces, ifUnplaced),
    },
  };
}

/* ------------------------------------------------------- casino extraction -- */

/**
 * Expected value of a wagering offer. You must turn over
 * `wagerBase x multiplier`, and each turnover loses the house edge on average.
 */
export function extraction({ deposit, bonus, multiplier, rtp, wagerOn }) {
  const errors = [];
  if (!Number.isFinite(deposit) || deposit < 0) errors.push('Deposit cannot be negative.');
  if (!Number.isFinite(bonus) || bonus < 0) errors.push('Bonus cannot be negative.');
  if (!Number.isFinite(multiplier) || multiplier < 0) errors.push('Wagering multiplier cannot be negative.');
  if (!Number.isFinite(rtp) || rtp <= 0 || rtp > 1) errors.push('RTP must be between 0% and 100%.');
  if (errors.length) return { errors, result: null };

  const wagerBase = wagerOn === 'deposit+bonus' ? deposit + bonus : bonus;
  const turnover = wagerBase * multiplier;
  const houseEdge = 1 - rtp;
  const expectedLoss = turnover * houseEdge;
  const expectedValue = bonus - expectedLoss;

  return {
    errors: [],
    result: {
      turnover,
      houseEdge,
      expectedLoss,
      expectedValue,
      // Share of the bonus you expect to walk away with.
      retention: bonus > 0 ? expectedValue / bonus : 0,
      expectedReturn: deposit + expectedValue,
    },
  };
}

export const COMMISSION_PRESETS = [
  { label: 'Smarkets', value: 0.02 },
  { label: 'Betfair', value: 0.05 },
  { label: 'Betdaq', value: 0.02 },
  { label: 'Matchbook', value: 0.015 },
  { label: 'Custom', value: null },
];
