import React, { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import { Field } from '../components/ui.jsx';
import { COMMISSION_PRESETS, LAY_MODES, MODES, calculate, dutch, eachWay, extraction } from '../lib/calc.js';
import { money, num, parseNum, percent, signedMoney } from '../lib/format.js';

const TOOLS = [
  { id: 'lay', label: 'Lay stake' },
  { id: 'dutch', label: 'Dutching' },
  { id: 'ew', label: 'Each-way' },
  { id: 'casino', label: 'Casino wagering' },
];

const trim = (v) => (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '0');

function Outcome({ rows, currency }) {
  return (
    <table className="grid" style={{ marginTop: 12 }}>
      <thead>
        <tr>
          <th>Outcome</th>
          <th className="num">Net</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td>{label}</td>
            <td className={`num ${value < 0 ? 'neg' : 'pos'}`}>{signedMoney(value, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Hero({ label, value, tone, right }) {
  return (
    <div className="hero-stat" style={{ marginTop: 12 }}>
      <div className="row-between" style={{ alignItems: 'flex-end' }}>
        <div style={{ minWidth: 0 }}>
          <div className="hero-label">{label}</div>
          <div className={`hero-value ${tone}`}>{value}</div>
        </div>
        {right}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ lay stake --- */

function LayStake({ settings, currency, onCommissionChange, onSendToLog, availableFloat }) {
  const [mode, setMode] = useState(MODES.QUALIFYING);
  const [layMode, setLayMode] = useState(LAY_MODES.NORMAL);
  const [adjust, setAdjust] = useState('10');
  const [backStake, setBackStake] = useState('10');
  const [backOdds, setBackOdds] = useState('3.0');
  const [layOdds, setLayOdds] = useState('3.2');
  const commission = settings.commission;
  const [commissionText, setCommissionText] = useState(() => trim(commission * 100));

  const inputs = useMemo(
    () => ({
      backStake: parseNum(backStake),
      backOdds: parseNum(backOdds),
      layOdds: parseNum(layOdds),
      commission,
    }),
    [backStake, backOdds, layOdds, commission],
  );

  const adjustPct = Math.min(Math.max(parseNum(adjust) || 0, 0), 90) / 100;
  const { errors, result } = useMemo(
    () => calculate(mode, inputs, layMode, adjustPct),
    [mode, inputs, layMode, adjustPct],
  );

  const presetIndex = useMemo(() => {
    const match = COMMISSION_PRESETS.findIndex((p) => p.value !== null && p.label === settings.exchange && p.value === commission);
    if (match >= 0) return match;
    const byValue = COMMISSION_PRESETS.findIndex((p) => p.value === commission);
    return byValue >= 0 ? byValue : COMMISSION_PRESETS.length - 1;
  }, [settings.exchange, commission]);
  const isCustom = COMMISSION_PRESETS[presetIndex].value === null;

  const overFloat = result && availableFloat > 0 && result.liability > availableFloat;
  const stakeLabel = mode === MODES.QUALIFYING ? 'Back stake' : 'Free bet amount';

  return (
    <>
      <div className="segmented">
        <button type="button" aria-pressed={mode === MODES.QUALIFYING} onClick={() => setMode(MODES.QUALIFYING)}>
          Qualifying
        </button>
        <button type="button" aria-pressed={mode === MODES.FREEBET} onClick={() => setMode(MODES.FREEBET)}>
          Free bet (SNR)
        </button>
        <button type="button" aria-pressed={mode === MODES.FREEBET_SR} onClick={() => setMode(MODES.FREEBET_SR)}>
          Free bet (SR)
        </button>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <Field label={`${stakeLabel} (${currency})`}>
          <input type="number" step="0.01" value={backStake} onChange={(e) => setBackStake(e.target.value)} aria-label={stakeLabel} />
        </Field>
        <Field label="Back odds">
          <input type="number" step="0.01" value={backOdds} onChange={(e) => setBackOdds(e.target.value)} aria-label="Back odds" />
        </Field>
        <Field label="Lay odds">
          <input type="number" step="0.01" value={layOdds} onChange={(e) => setLayOdds(e.target.value)} aria-label="Lay odds" />
        </Field>
        <Field label="Exchange">
          <select
            value={presetIndex}
            onChange={(e) => {
              const preset = COMMISSION_PRESETS[Number(e.target.value)];
              const next = preset.value === null ? commission : preset.value;
              setCommissionText(trim(next * 100));
              onCommissionChange(next, preset.value === null ? 'Custom' : preset.label);
            }}
            aria-label="Commission preset"
          >
            {COMMISSION_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.value === null ? 'Custom' : `${p.label} ${percent(p.value, 1)}`}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid-2" style={{ marginTop: 8 }}>
        <Field label="Commission (%)">
          <input
            type="number"
            step="0.1"
            value={isCustom ? commissionText : trim(commission * 100)}
            disabled={!isCustom}
            onChange={(e) => {
              setCommissionText(e.target.value);
              const pct = parseNum(e.target.value);
              if (Number.isFinite(pct) && pct >= 0 && pct < 100) onCommissionChange(pct / 100, 'Custom');
            }}
            aria-label="Commission rate percent"
          />
        </Field>
        <Field label="Lay adjustment (%)">
          <input
            type="number"
            step="1"
            min="0"
            max="90"
            value={adjust}
            disabled={layMode === LAY_MODES.NORMAL}
            onChange={(e) => setAdjust(e.target.value)}
            aria-label="Lay adjustment percent"
          />
        </Field>
      </div>

      <div className="segmented" style={{ marginTop: 8 }}>
        <button type="button" aria-pressed={layMode === LAY_MODES.NORMAL} onClick={() => setLayMode(LAY_MODES.NORMAL)}>
          Equal profit
        </button>
        <button type="button" aria-pressed={layMode === LAY_MODES.UNDERLAY} onClick={() => setLayMode(LAY_MODES.UNDERLAY)}>
          Underlay
        </button>
        <button type="button" aria-pressed={layMode === LAY_MODES.OVERLAY} onClick={() => setLayMode(LAY_MODES.OVERLAY)}>
          Overlay
        </button>
      </div>

      {errors.length > 0 ? (
        <div className="notice alert" style={{ marginTop: 12 }}>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <div className="stat-tile">
              <div className="stat-tile-label">Lay stake</div>
              <div className="stat-tile-value">{money(result.layStake, currency)}</div>
            </div>
            <div className={`stat-tile liability${overFloat ? ' breach' : ''}`}>
              <div className="stat-tile-label">Liability</div>
              <div className="stat-tile-value">{money(result.liability, currency)}</div>
            </div>
          </div>

          {overFloat ? (
            <div className="notice alert" style={{ marginTop: 8 }}>
              Liability {money(result.liability, currency)} exceeds your bankroll of {money(availableFloat, currency)}.
            </div>
          ) : null}

          <Outcome
            rows={[
              ['If the back bet wins', result.ifBackWins],
              ['If the lay bet wins', result.ifLayWins],
            ]}
            currency={currency}
          />

          <Hero
            label={layMode === LAY_MODES.NORMAL ? (result.locked < 0 ? 'Qualifying loss (locked)' : 'Guaranteed profit (locked)') : 'Worst case'}
            value={signedMoney(result.locked, currency)}
            tone={result.locked < 0 ? 'neg' : 'pos'}
            right={
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div className="hero-label">{mode === MODES.QUALIFYING ? 'Of stake' : 'Retention'}</div>
                <div className="mono accent" style={{ fontSize: 16, fontWeight: 500 }}>
                  {mode === MODES.QUALIFYING
                    ? percent(Math.abs(result.locked) / inputs.backStake, 1)
                    : percent(result.retention, 1)}
                </div>
              </div>
            }
          />

          <div className="row-between" style={{ marginTop: 12 }}>
            <span className="sub mono">
              Lay {num(result.layStake)} @ {num(inputs.layOdds)}
            </span>
            <button
              type="button"
              className="btn accent sm"
              onClick={() =>
                onSendToLog({
                  offerType: mode === MODES.FREEBET ? 'Free bet (SNR)' : mode === MODES.FREEBET_SR ? 'Free bet (SR)' : 'Qualifying bet',
                  backStake: inputs.backStake,
                  backOdds: inputs.backOdds,
                  layStake: result.layStake,
                  layOdds: inputs.layOdds,
                  commission,
                })
              }
            >
              Send to bet log
            </button>
          </div>

          {layMode !== LAY_MODES.NORMAL ? (
            <p className="sub" style={{ margin: '10px 0 0' }}>
              {layMode === LAY_MODES.UNDERLAY
                ? `Laying ${adjust}% less than the equal-profit stake — more profit if the back bet wins, a bigger loss if the lay wins.`
                : `Laying ${adjust}% more than the equal-profit stake — more profit if the lay wins, a bigger loss if the back bet wins.`}
            </p>
          ) : null}
        </>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------- dutching -- */

function Dutching({ currency }) {
  const [total, setTotal] = useState('100');
  const [odds, setOdds] = useState(['3.0', '4.0', '5.0']);

  const { errors, result } = useMemo(
    () => dutch(parseNum(total), odds.map(parseNum)),
    [total, odds],
  );

  const setOdd = (i, v) => setOdds((prev) => prev.map((o, idx) => (idx === i ? v : o)));

  return (
    <>
      <Field label={`Total stake (${currency})`}>
        <input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} aria-label="Total stake" />
      </Field>

      <div className="field-label" style={{ marginTop: 8 }}>
        Outcome odds
      </div>
      <div className="stack-8">
        {odds.map((o, i) => (
          <div className="row-between" key={i} style={{ gap: 8 }}>
            <input
              type="number"
              step="0.01"
              value={o}
              onChange={(e) => setOdd(i, e.target.value)}
              aria-label={`Odds for outcome ${i + 1}`}
            />
            <span className="mono sub" style={{ minWidth: 92, textAlign: 'right' }}>
              {result ? money(result.stakes[i] ?? 0, currency) : '—'}
            </span>
            <button
              className="btn ghost sm danger"
              type="button"
              disabled={odds.length <= 2}
              onClick={() => setOdds(odds.filter((_, idx) => idx !== i))}
              aria-label={`Remove outcome ${i + 1}`}
            >
              Del
            </button>
          </div>
        ))}
      </div>
      <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={() => setOdds([...odds, ''])}>
        Add outcome
      </button>

      {errors.length > 0 ? (
        <div className="notice alert" style={{ marginTop: 12 }}>
          {errors[0]}
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid-2" style={{ marginTop: 12 }}>
            <div className="stat-tile">
              <div className="stat-tile-label">Return (any winner)</div>
              <div className="stat-tile-value">{money(result.payout, currency)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Book margin</div>
              <div className={`stat-tile-value ${result.margin < 1 ? 'pos' : 'neg'}`}>{percent(result.margin, 2)}</div>
            </div>
          </div>
          <Hero
            label={result.profit >= 0 ? 'Guaranteed profit' : 'Guaranteed loss'}
            value={signedMoney(result.profit, currency)}
            tone={result.profit < 0 ? 'neg' : 'pos'}
            right={
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div className="hero-label">ROI</div>
                <div className="mono accent" style={{ fontSize: 16, fontWeight: 500 }}>
                  {percent(result.roi, 2)}
                </div>
              </div>
            }
          />
          <p className="sub" style={{ margin: '10px 0 0' }}>
            A margin under 100% means the book is beatable — every outcome returns the same.
          </p>
        </>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------- each-way -- */

function EachWay({ settings, currency }) {
  const [unitStake, setUnitStake] = useState('10');
  const [backOdds, setBackOdds] = useState('11');
  const [placeTerms, setPlaceTerms] = useState('5');
  const [layWinOdds, setLayWinOdds] = useState('12');
  const [layPlaceOdds, setLayPlaceOdds] = useState('3.5');

  const { errors, result } = useMemo(
    () =>
      eachWay({
        unitStake: parseNum(unitStake),
        backOdds: parseNum(backOdds),
        placeTerms: parseNum(placeTerms),
        layWinOdds: parseNum(layWinOdds),
        layPlaceOdds: parseNum(layPlaceOdds),
        commission: settings.commission,
      }),
    [unitStake, backOdds, placeTerms, layWinOdds, layPlaceOdds, settings.commission],
  );

  return (
    <>
      <div className="grid-2">
        <Field label={`Unit stake (${currency}) — total is 2×`}>
          <input type="number" step="0.01" value={unitStake} onChange={(e) => setUnitStake(e.target.value)} aria-label="Unit stake" />
        </Field>
        <Field label="Back odds (win)">
          <input type="number" step="0.01" value={backOdds} onChange={(e) => setBackOdds(e.target.value)} aria-label="Back odds win" />
        </Field>
        <Field label="Place terms (1/N)">
          <input type="number" step="1" value={placeTerms} onChange={(e) => setPlaceTerms(e.target.value)} aria-label="Place terms" />
        </Field>
        <Field label="Lay odds (win)">
          <input type="number" step="0.01" value={layWinOdds} onChange={(e) => setLayWinOdds(e.target.value)} aria-label="Lay win odds" />
        </Field>
        <Field label="Lay odds (place)">
          <input type="number" step="0.01" value={layPlaceOdds} onChange={(e) => setLayPlaceOdds(e.target.value)} aria-label="Lay place odds" />
        </Field>
        <Field label="Commission">
          <input type="text" value={percent(settings.commission, 2)} disabled aria-label="Commission" />
        </Field>
      </div>

      {errors.length > 0 ? (
        <div className="notice alert" style={{ marginTop: 12 }}>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid-3" style={{ marginTop: 12 }}>
            <div className="stat-tile">
              <div className="stat-tile-label">Lay win stake</div>
              <div className="stat-tile-value">{money(result.layWinStake, currency)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Lay place stake</div>
              <div className="stat-tile-value">{money(result.layPlaceStake, currency)}</div>
            </div>
            <div className="stat-tile liability">
              <div className="stat-tile-label">Total liability</div>
              <div className="stat-tile-value">{money(result.totalLiability, currency)}</div>
            </div>
          </div>

          <Outcome
            rows={[
              ['Horse wins', result.ifWins],
              ['Horse places only', result.ifPlaces],
              ['Horse unplaced', result.ifUnplaced],
            ]}
            currency={currency}
          />

          <Hero
            label="Worst case"
            value={signedMoney(result.worst, currency)}
            tone={result.worst < 0 ? 'neg' : 'pos'}
            right={
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div className="hero-label">Place odds</div>
                <div className="mono accent" style={{ fontSize: 16, fontWeight: 500 }}>
                  {num(result.placeOdds)}
                </div>
              </div>
            }
          />
        </>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------- casino wagering -- */

function CasinoWagering({ currency }) {
  const [deposit, setDeposit] = useState('50');
  const [bonus, setBonus] = useState('50');
  const [multiplier, setMultiplier] = useState('35');
  const [rtp, setRtp] = useState('96.5');
  const [wagerOn, setWagerOn] = useState('bonus');

  const { errors, result } = useMemo(
    () =>
      extraction({
        deposit: parseNum(deposit),
        bonus: parseNum(bonus),
        multiplier: parseNum(multiplier),
        rtp: (parseNum(rtp) || 0) / 100,
        wagerOn,
      }),
    [deposit, bonus, multiplier, rtp, wagerOn],
  );

  return (
    <>
      <div className="grid-2">
        <Field label={`Deposit (${currency})`}>
          <input type="number" step="0.01" value={deposit} onChange={(e) => setDeposit(e.target.value)} aria-label="Deposit" />
        </Field>
        <Field label={`Bonus (${currency})`}>
          <input type="number" step="0.01" value={bonus} onChange={(e) => setBonus(e.target.value)} aria-label="Bonus" />
        </Field>
        <Field label="Wagering multiplier (×)">
          <input type="number" step="1" value={multiplier} onChange={(e) => setMultiplier(e.target.value)} aria-label="Wagering multiplier" />
        </Field>
        <Field label="Game RTP (%)">
          <input type="number" step="0.1" value={rtp} onChange={(e) => setRtp(e.target.value)} aria-label="Game RTP" />
        </Field>
      </div>
      <div className="segmented" style={{ marginTop: 8 }}>
        <button type="button" aria-pressed={wagerOn === 'bonus'} onClick={() => setWagerOn('bonus')}>
          Wager bonus only
        </button>
        <button type="button" aria-pressed={wagerOn === 'deposit+bonus'} onClick={() => setWagerOn('deposit+bonus')}>
          Wager deposit + bonus
        </button>
      </div>

      {errors.length > 0 ? (
        <div className="notice alert" style={{ marginTop: 12 }}>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid-3" style={{ marginTop: 12 }}>
            <div className="stat-tile">
              <div className="stat-tile-label">Turnover required</div>
              <div className="stat-tile-value">{money(result.turnover, currency)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">House edge</div>
              <div className="stat-tile-value">{percent(result.houseEdge, 2)}</div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-label">Expected loss</div>
              <div className="stat-tile-value neg">{money(result.expectedLoss, currency)}</div>
            </div>
          </div>

          <Hero
            label="Expected value"
            value={signedMoney(result.expectedValue, currency)}
            tone={result.expectedValue < 0 ? 'neg' : 'pos'}
            right={
              <div style={{ textAlign: 'right', flex: 'none' }}>
                <div className="hero-label">Bonus retention</div>
                <div className="mono accent" style={{ fontSize: 16, fontWeight: 500 }}>
                  {percent(result.retention, 1)}
                </div>
              </div>
            }
          />

          <p className="sub" style={{ margin: '10px 0 0' }}>
            {result.expectedValue < 0
              ? 'Negative expected value — on average this offer loses money. Skip it.'
              : 'Positive on average, but casino offers are variance-heavy: individual results swing widely.'}
          </p>
        </>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ tab --- */

export default function Calculators({ profile, currency, onCommissionChange, onSendToLog, availableFloat }) {
  const [tool, setTool] = useState('lay');
  const active = TOOLS.find((t) => t.id === tool);

  return (
    <div className="page">
      <Card
        title={`Calculators · ${active.label}`}
        hotkey="F4"
        tools={
          <div className="segmented">
            {TOOLS.map((t) => (
              <button key={t.id} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        <div className="calc-body">
          {tool === 'lay' ? (
            <LayStake
              settings={profile.settings}
              currency={currency}
              onCommissionChange={onCommissionChange}
              onSendToLog={onSendToLog}
              availableFloat={availableFloat}
            />
          ) : null}
          {tool === 'dutch' ? <Dutching currency={currency} /> : null}
          {tool === 'ew' ? <EachWay settings={profile.settings} currency={currency} /> : null}
          {tool === 'casino' ? <CasinoWagering currency={currency} /> : null}
        </div>
      </Card>
    </div>
  );
}
