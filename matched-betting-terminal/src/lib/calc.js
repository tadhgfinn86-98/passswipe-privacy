/**
 * Matched betting maths.
 *
 * Commission is a decimal throughout (0.02 = 2%) and is charged by the
 * exchange on net winnings when the lay bet wins.
 */

export const MODES = {
  QUALIFYING: 'QUALIFYING',
  FREEBET: 'FREEBET',
};

/**
 * Validates the calculator inputs and returns a list of human-readable
 * problems. An empty list means the numbers are safe to compute with.
 */
export function validate({ backStake, backOdds, layOdds, commission }) {
  const errors = [];
  const finite = (v) => Number.isFinite(v);

  if (!finite(backStake) || backStake <= 0) {
    errors.push('Stake must be a number greater than 0.');
  }
  if (!finite(backOdds) || backOdds <= 1) {
    errors.push('Back odds must be greater than 1.00 (decimal odds).');
  }
  if (!finite(layOdds) || layOdds <= 1) {
    errors.push('Lay odds must be greater than 1.00 (decimal odds).');
  }
  if (!finite(commission) || commission < 0 || commission >= 1) {
    errors.push('Commission must be between 0% and 99%.');
  }
  if (finite(layOdds) && finite(commission) && layOdds - commission <= 0) {
    errors.push('Lay odds minus commission must be greater than 0.');
  }
  return errors;
}

/**
 * Qualifying bet: your own money is on the back bet, so a winning back bet
 * returns the stake plus the profit.
 *
 *   layStake = (backOdds x backStake) / (layOdds - commission)
 */
export function qualifyingBet({ backStake, backOdds, layOdds, commission }) {
  const layStake = (backOdds * backStake) / (layOdds - commission);
  const liability = layStake * (layOdds - 1);

  // Back bet wins: profit on the bookmaker side, lose the exchange liability.
  const ifBackWins = backStake * (backOdds - 1) - liability;
  // Lay bet wins: lose the back stake, keep the lay stake less commission.
  const ifLayWins = layStake * (1 - commission) - backStake;

  return buildResult({ layStake, liability, ifBackWins, ifLayWins, backStake });
}

/**
 * Free bet, stake not returned (SNR): the free bet stake is not yours and is
 * not returned, so only the winnings count.
 *
 *   layStake = ((backOdds - 1) x freeBet) / (layOdds - commission)
 */
export function freeBetSnr({ backStake, backOdds, layOdds, commission }) {
  const layStake = ((backOdds - 1) * backStake) / (layOdds - commission);
  const liability = layStake * (layOdds - 1);

  // Back bet wins: keep the winnings (not the stake), lose the liability.
  const ifBackWins = backStake * (backOdds - 1) - liability;
  // Lay bet wins: the free bet cost nothing, so the lay winnings are the profit.
  const ifLayWins = layStake * (1 - commission);

  return buildResult({ layStake, liability, ifBackWins, ifLayWins, backStake });
}

function buildResult({ layStake, liability, ifBackWins, ifLayWins, backStake }) {
  const locked = Math.min(ifBackWins, ifLayWins);
  return {
    layStake,
    liability,
    ifBackWins,
    ifLayWins,
    // The guaranteed figure — the worse of the two outcomes.
    locked,
    // How much of the free bet value you convert to cash (free bet mode).
    retention: backStake > 0 ? locked / backStake : 0,
    // Both outcomes should match to the penny; a gap means rounding drift.
    spread: Math.abs(ifBackWins - ifLayWins),
  };
}

export function calculate(mode, inputs) {
  const errors = validate(inputs);
  if (errors.length > 0) return { errors, result: null };
  const result = mode === MODES.FREEBET ? freeBetSnr(inputs) : qualifyingBet(inputs);
  return { errors: [], result };
}

export const COMMISSION_PRESETS = [
  { label: 'Smarkets', value: 0.02 },
  { label: 'Betfair', value: 0.05 },
  { label: 'Betdaq', value: 0.02 },
  { label: 'Matchbook', value: 0.015 },
  { label: 'Custom', value: null },
];
