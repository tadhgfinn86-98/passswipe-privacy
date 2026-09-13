import React, { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import { BarList, Field, MoneyStat, Stat } from '../components/ui.jsx';
import { OFFER_TYPES, isSettled, profitBy, realisedProfit } from '../lib/model.js';
import { money, parseCsv, percent, signedMoney, toCsv, uid } from '../lib/format.js';

const CSV_HEADERS = [
  'date',
  'bookmaker',
  'exchange',
  'event',
  'offerType',
  'status',
  'backStake',
  'backOdds',
  'layStake',
  'layOdds',
  'commission',
  'liability',
  'expectedProfit',
  'profit',
  'minutes',
  'notes',
];

export default function Reports({
  profile,
  currency,
  settings,
  onSettingsChange,
  onBetsChange,
  onExport,
  onImport,
  onReveal,
  onExportCsv,
  onImportCsv,
  isDesktop,
  dataPath,
}) {
  const { bets } = profile;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [bookmaker, setBookmaker] = useState('All');
  const [type, setType] = useState('All');

  const bookmakers = useMemo(
    () => [...new Set(bets.map((b) => b.back.bookmaker).filter(Boolean))].sort(),
    [bets],
  );

  const filtered = useMemo(
    () =>
      bets
        .filter((b) => (from ? b.date >= from : true))
        .filter((b) => (to ? b.date <= to : true))
        .filter((b) => (bookmaker === 'All' ? true : b.back.bookmaker === bookmaker))
        .filter((b) => (type === 'All' ? true : b.offerType === type)),
    [bets, from, to, bookmaker, type],
  );

  const stats = useMemo(() => {
    const settled = filtered.filter(isSettled);
    const profit = realisedProfit(filtered);
    const minutes = filtered.reduce((s, b) => s + Number(b.minutes || 0), 0);
    const staked = filtered.reduce((s, b) => s + Number(b.back.stake || 0), 0);
    const offersWorked = new Set(filtered.map((b) => b.offerId).filter(Boolean)).size;
    return {
      profit,
      count: settled.length,
      perBet: settled.length ? profit / settled.length : 0,
      perOffer: offersWorked ? profit / offersWorked : 0,
      hours: minutes / 60,
      perHour: minutes > 0 ? profit / (minutes / 60) : 0,
      staked,
      roi: staked > 0 ? profit / staked : 0,
    };
  }, [filtered]);

  function handleExportCsv() {
    const rows = filtered.map((b) => [
      b.date,
      b.back.bookmaker,
      b.lay.exchange,
      b.event,
      b.offerType,
      b.status,
      b.back.stake,
      b.back.odds,
      b.lay.stake,
      b.lay.odds,
      b.lay.commission,
      b.lay.liability,
      b.expectedProfit,
      b.profit,
      b.minutes,
      b.notes,
    ]);
    onExportCsv(toCsv(CSV_HEADERS, rows), `matched-betting-bets-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  async function handleImportCsv() {
    const res = await onImportCsv();
    if (!res?.ok) return;
    const rows = parseCsv(res.text);
    if (rows.length < 2) return;
    const header = rows[0].map((h) => h.trim());
    const idx = (name) => header.indexOf(name);
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const imported = rows.slice(1).map((r) => ({
      id: uid(),
      date: r[idx('date')] || '',
      offerId: '',
      offerType: OFFER_TYPES.includes(r[idx('offerType')]) ? r[idx('offerType')] : 'Qualifying bet',
      status: r[idx('status')] || 'Back won',
      event: r[idx('event')] || '',
      notes: r[idx('notes')] || '',
      minutes: n(r[idx('minutes')]),
      back: { bookmaker: r[idx('bookmaker')] || '', stake: n(r[idx('backStake')]), odds: n(r[idx('backOdds')]) },
      lay: {
        exchange: r[idx('exchange')] || '',
        stake: n(r[idx('layStake')]),
        odds: n(r[idx('layOdds')]),
        commission: n(r[idx('commission')]),
        liability: n(r[idx('liability')]),
      },
      expectedProfit: n(r[idx('expectedProfit')]),
      profit: n(r[idx('profit')]),
    }));
    if (!window.confirm(`Add ${imported.length} bets from this CSV to your log?`)) return;
    onBetsChange([...bets, ...imported]);
  }

  return (
    <div className="page">
      <Card title="Filters" titleSize="sm" hotkey="F6">
        <div className="grid-4">
          <Field label="From">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
          </Field>
          <Field label="To">
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
          </Field>
          <Field label="Bookmaker">
            <select value={bookmaker} onChange={(e) => setBookmaker(e.target.value)} aria-label="Filter bookmaker">
              <option value="All">All bookmakers</option>
              {bookmakers.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Offer type">
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter offer type">
              <option value="All">All types</option>
              {OFFER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {from || to || bookmaker !== 'All' || type !== 'All' ? (
          <button
            className="btn sm"
            type="button"
            style={{ marginTop: 8 }}
            onClick={() => {
              setFrom('');
              setTo('');
              setBookmaker('All');
              setType('All');
            }}
          >
            Clear filters
          </button>
        ) : null}
      </Card>

      <div className="stat-row">
        <MoneyStat label="Profit" amount={stats.profit} currency={currency} signed sub={`${stats.count} settled bets`} />
        <MoneyStat label="Per bet" amount={stats.perBet} currency={currency} signed />
        <MoneyStat label="Per offer" amount={stats.perOffer} currency={currency} signed />
        <MoneyStat label="Per hour" amount={stats.perHour} currency={currency} signed sub={`${stats.hours.toFixed(1)}h logged`} />
        <MoneyStat label="Total staked" amount={stats.staked} currency={currency} />
        <Stat label="Return on stakes" value={percent(stats.roi, 1)} tone={stats.roi < 0 ? 'neg' : 'pos'} />
      </div>

      <div className="page-grid">
        <Card title="Profit by bookmaker" titleSize="sm">
          <BarList rows={profitBy(filtered, (b) => b.back.bookmaker)} currency={currency} />
        </Card>
        <Card title="Profit by offer type" titleSize="sm">
          <BarList rows={profitBy(filtered, (b) => b.offerType)} currency={currency} />
        </Card>
      </div>

      <Card title="Data & backup" titleSize="sm">
        <div className="grid-2">
          <Field label={`Starting bankroll (${currency})`}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={settings.startingBankroll}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 0) onSettingsChange({ ...settings, startingBankroll: v });
              }}
              aria-label="Starting bankroll"
            />
          </Field>
          <Field label="Currency">
            <select
              value={settings.currency}
              onChange={(e) => onSettingsChange({ ...settings, currency: e.target.value })}
              aria-label="Currency"
            >
              {['£', '€', '$'].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="card-tools" style={{ marginTop: 12, flexWrap: 'wrap' }}>
          <button className="btn sm" type="button" onClick={onExport}>
            Export JSON backup
          </button>
          <button className="btn sm" type="button" onClick={onImport}>
            Import JSON backup
          </button>
          <button className="btn sm" type="button" onClick={handleExportCsv}>
            Export bets CSV
          </button>
          <button className="btn sm" type="button" onClick={handleImportCsv}>
            Import bets CSV
          </button>
          {isDesktop ? (
            <button className="btn sm" type="button" onClick={onReveal}>
              Show data file
            </button>
          ) : null}
        </div>

        <div className="notice" style={{ marginTop: 12 }}>
          Everything is stored on this PC only — no cloud, no account. The JSON backup is the complete
          dataset (all profiles); the CSV covers the filtered bet rows above.
          <br />
          <span className="mono" style={{ wordBreak: 'break-all' }}>
            {dataPath}
          </span>
        </div>

        <p className="sub" style={{ margin: '10px 0 0' }}>
          Matched betting winnings are not taxable in the UK, so these figures are for your own tracking
          rather than a tax return. This is not tax advice.
        </p>
      </Card>
    </div>
  );
}
