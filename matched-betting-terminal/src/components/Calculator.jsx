import React, { forwardRef, useMemo, useState } from 'react';
import Panel from './Panel.jsx';
import { COMMISSION_PRESETS, MODES, calculate } from '../lib/calc.js';
import { money, num, parseNum, percent, signedMoney } from '../lib/format.js';

const MODE_COPY = {
  [MODES.QUALIFYING]: {
    stakeLabel: 'BACK STAKE',
    stakeHint: 'Your own money staked at the bookmaker.',
    lockedLabel: 'QUALIFYING LOSS',
    note: 'A small loss here is normal — it is the cost of unlocking the free bet.',
  },
  [MODES.FREEBET]: {
    stakeLabel: 'FREE BET AMOUNT',
    stakeHint: 'Stake not returned (SNR) — you keep the winnings only.',
    lockedLabel: 'GUARANTEED PROFIT',
    note: 'Both outcomes are locked to the same figure, whichever way the event lands.',
  },
};

/** 2 -> "2", 1.5 -> "1.5", 2.25 -> "2.25" — no trailing zero noise. */
function trimNumber(value) {
  if (!Number.isFinite(value)) return '0';
  return String(Math.round(value * 1000) / 1000);
}

/** Live matched betting calculator: qualifying bets and SNR free bets. */
const Calculator = forwardRef(function Calculator(
  { settings, onCommissionChange, onSendToLog, availableFloat, currency },
  ref,
) {
  const [mode, setMode] = useState(MODES.QUALIFYING);
  const [backStake, setBackStake] = useState('10');
  const [backOdds, setBackOdds] = useState('3.0');
  const [layOdds, setLayOdds] = useState('3.2');

  const commission = settings.commission;

  // The custom-commission box keeps its own text so half-typed values like
  // "2." survive a render instead of snapping back to a rounded number.
  const [commissionText, setCommissionText] = useState(() => trimNumber(commission * 100));
  const copy = MODE_COPY[mode];

  const inputs = useMemo(
    () => ({
      backStake: parseNum(backStake),
      backOdds: parseNum(backOdds),
      layOdds: parseNum(layOdds),
      commission,
    }),
    [backStake, backOdds, layOdds, commission],
  );

  const { errors, result } = useMemo(() => calculate(mode, inputs), [mode, inputs]);

  const presetIndex = useMemo(() => {
    const match = COMMISSION_PRESETS.findIndex(
      (p) => p.value !== null && p.label === settings.exchange && p.value === commission,
    );
    if (match >= 0) return match;
    const byValue = COMMISSION_PRESETS.findIndex((p) => p.value === commission);
    return byValue >= 0 ? byValue : COMMISSION_PRESETS.length - 1;
  }, [settings.exchange, commission]);

  const isCustom = COMMISSION_PRESETS[presetIndex].value === null;

  function handlePreset(event) {
    const preset = COMMISSION_PRESETS[Number(event.target.value)];
    if (preset.value === null) {
      setCommissionText(trimNumber(commission * 100));
      onCommissionChange(commission, 'Custom');
    } else {
      setCommissionText(trimNumber(preset.value * 100));
      onCommissionChange(preset.value, preset.label);
    }
  }

  // Laying more than your exchange float can cover is the classic way to get
  // stuck mid-offer, so flag it loudly rather than burying it in the numbers.
  const overFloat =
    result && Number.isFinite(availableFloat) && availableFloat > 0 && result.liability > availableFloat;

  const outcomeTone = (value) => (value > 0.0049 ? 'green' : value < -0.0049 ? 'red' : 'dim');

  return (
    <Panel
      ref={ref}
      className="area-calc"
      title="MATCHED BETTING CALCULATOR"
      hotkey="F1"
      tools={
        <button
          className="btn tiny"
          type="button"
          onClick={() => setMode(mode === MODES.QUALIFYING ? MODES.FREEBET : MODES.QUALIFYING)}
          title="Toggle mode (Ctrl+M)"
        >
          SWAP MODE
        </button>
      }
    >
      <div className="segmented" role="group" aria-label="Calculator mode">
        <button
          type="button"
          aria-pressed={mode === MODES.QUALIFYING}
          onClick={() => setMode(MODES.QUALIFYING)}
        >
          QUALIFYING BET
        </button>
        <button type="button" aria-pressed={mode === MODES.FREEBET} onClick={() => setMode(MODES.FREEBET)}>
          FREE BET (SNR)
        </button>
      </div>

      <div style={{ marginTop: 8 }} className="grid-2">
        <label className="field">
          <span className="field-label">{copy.stakeLabel} ({currency})</span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={backStake}
            onChange={(e) => setBackStake(e.target.value)}
            aria-label={copy.stakeLabel}
          />
        </label>
        <label className="field">
          <span className="field-label">BACK ODDS (DECIMAL)</span>
          <input
            type="number"
            step="0.01"
            min="1"
            inputMode="decimal"
            value={backOdds}
            onChange={(e) => setBackOdds(e.target.value)}
            aria-label="Back odds"
          />
        </label>
        <label className="field">
          <span className="field-label">LAY ODDS (DECIMAL)</span>
          <input
            type="number"
            step="0.01"
            min="1"
            inputMode="decimal"
            value={layOdds}
            onChange={(e) => setLayOdds(e.target.value)}
            aria-label="Lay odds"
          />
        </label>
        <label className="field">
          <span className="field-label">EXCHANGE / COMMISSION</span>
          <select value={presetIndex} onChange={handlePreset} aria-label="Commission preset">
            {COMMISSION_PRESETS.map((preset, i) => (
              <option key={preset.label} value={i}>
                {preset.value === null ? 'CUSTOM' : `${preset.label.toUpperCase()} ${percent(preset.value, 1)}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="field">
        <span className="field-label">COMMISSION RATE (%)</span>
        <input
          type="number"
          step="0.1"
          min="0"
          max="99"
          inputMode="decimal"
          value={isCustom ? commissionText : trimNumber(commission * 100)}
          disabled={!isCustom}
          onChange={(e) => {
            setCommissionText(e.target.value);
            const pct = parseNum(e.target.value);
            if (Number.isFinite(pct) && pct >= 0 && pct < 100) onCommissionChange(pct / 100, 'Custom');
          }}
          title={isCustom ? 'Enter your exchange commission' : 'Choose CUSTOM above to edit'}
          aria-label="Commission rate percent"
        />
      </label>

      {errors.length > 0 ? (
        <div className="warn-box">
          <ul>
            {errors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="readout">
            <div className="readout-row">
              <span className="readout-label">OPTIMAL LAY STAKE</span>
              <span className="readout-value amber">{money(result.layStake, currency)}</span>
            </div>
            <div className="readout-row liability">
              <span className="readout-label">LIABILITY (EXCHANGE FUNDS NEEDED)</span>
              <span className="readout-value">{money(result.liability, currency)}</span>
            </div>
          </div>

          {/* Sits directly under the liability figure it refers to, so it can
              never scroll out of sight below the rest of the results. */}
          {overFloat ? (
            <div className="warn-box">
              LIABILITY {money(result.liability, currency)} EXCEEDS YOUR BANKROLL{' '}
              {money(availableFloat, currency)} — you do not have the funds to place this lay.
            </div>
          ) : null}

          <table className="grid" style={{ marginTop: 8 }}>
            <thead>
              <tr>
                <th>OUTCOME</th>
                <th className="num">BOOKMAKER</th>
                <th className="num">EXCHANGE</th>
                <th className="num">NET</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="nowrap">IF BACK WINS</td>
                {/* Winnings only — for a qualifier the returned stake nets off
                    against the stake you already paid. */}
                <td className="num green">
                  {signedMoney(inputs.backStake * (inputs.backOdds - 1), currency)}
                </td>
                <td className="num red">{signedMoney(-result.liability, currency)}</td>
                <td className={`num ${outcomeTone(result.ifBackWins)}`}>
                  {signedMoney(result.ifBackWins, currency)}
                </td>
              </tr>
              <tr>
                <td className="nowrap">IF LAY WINS</td>
                <td className="num red">
                  {signedMoney(mode === MODES.FREEBET ? 0 : -inputs.backStake, currency)}
                </td>
                <td className="num green">
                  {signedMoney(result.layStake * (1 - commission), currency)}
                </td>
                <td className={`num ${outcomeTone(result.ifLayWins)}`}>
                  {signedMoney(result.ifLayWins, currency)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="readout">
            <div className="readout-row hero">
              <span className="readout-label">{copy.lockedLabel} (LOCKED)</span>
              <span className={`readout-value ${outcomeTone(result.locked)}`}>
                {signedMoney(result.locked, currency)}
              </span>
            </div>
            {mode === MODES.FREEBET ? (
              <div className="readout-row">
                <span className="readout-label">FREE BET RETENTION</span>
                <span className="readout-value cyan">{percent(result.retention, 1)}</span>
              </div>
            ) : (
              <div className="readout-row">
                <span className="readout-label">LOSS AS % OF STAKE</span>
                <span className="readout-value cyan">
                  {percent(Math.abs(result.locked) / inputs.backStake, 1)}
                </span>
              </div>
            )}
          </div>

          <div className="note-box">{copy.note}</div>

          <div className="row-between" style={{ marginTop: 8 }}>
            <span className="dim" style={{ fontSize: 9 }}>
              LAY {num(result.layStake)} @ {num(inputs.layOdds)} · RISK {money(result.liability, currency)}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() =>
                onSendToLog({
                  stake: mode === MODES.FREEBET ? 0 : inputs.backStake,
                  profit: result.locked,
                  event: `${mode === MODES.FREEBET ? 'Free bet' : 'Qualifier'} @ ${num(inputs.backOdds)} / lay ${num(inputs.layOdds)}`,
                })
              }
              title="Copy this result into the bet log form"
            >
              SEND TO BET LOG →
            </button>
          </div>
        </>
      ) : null}
    </Panel>
  );
});

export default Calculator;
