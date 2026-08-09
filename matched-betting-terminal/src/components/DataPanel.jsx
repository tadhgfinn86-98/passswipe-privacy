import React, { forwardRef, useEffect, useState } from 'react';
import Panel from './Panel.jsx';
import { money, parseNum, percent, signedMoney } from '../lib/format.js';

/** Settings, backup/restore and a short position summary. */
const DataPanel = forwardRef(function DataPanel(
  { settings, onSettingsChange, onExport, onImport, onReveal, stats, dataPath, version, currency, isDesktop },
  ref,
) {
  const [bankrollText, setBankrollText] = useState(() => String(settings.startingBankroll));

  // Keep the box in step when an import replaces the whole dataset.
  useEffect(() => {
    setBankrollText(String(settings.startingBankroll));
  }, [settings.startingBankroll]);

  function commitBankroll(text) {
    const value = parseNum(text);
    if (Number.isFinite(value) && value >= 0) onSettingsChange({ ...settings, startingBankroll: value });
  }

  /** Leaving the field empty settles on 0 rather than silently keeping the old value. */
  function settleBankroll(text) {
    const value = parseNum(text);
    const safe = Number.isFinite(value) && value >= 0 ? value : 0;
    setBankrollText(String(safe));
    onSettingsChange({ ...settings, startingBankroll: safe });
  }

  return (
    <Panel
      ref={ref}
      className="area-data"
      title="POSITION / SETTINGS / DATA"
      hotkey="F4"
      tools={<span className="dim" style={{ fontSize: 9 }}>v{version}</span>}
    >
      <div className="grid-2">
        <label className="field">
          <span className="field-label">STARTING BANKROLL ({currency})</span>
          <input
            type="number"
            step="0.01"
            min="0"
            value={bankrollText}
            onChange={(e) => {
              setBankrollText(e.target.value);
              commitBankroll(e.target.value);
            }}
            onBlur={(e) => settleBankroll(e.target.value)}
            aria-label="Starting bankroll"
          />
        </label>
        <label className="field">
          <span className="field-label">CURRENCY SYMBOL</span>
          <select
            value={settings.currency}
            onChange={(e) => onSettingsChange({ ...settings, currency: e.target.value })}
          >
            {['£', '€', '$'].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="readout">
        <div className="readout-row hero">
          <span className="readout-label">CURRENT BANKROLL</span>
          <span className="readout-value amber">{money(stats.bankroll, currency)}</span>
        </div>
        <div className="readout-row">
          <span className="readout-label">PROFIT TO DATE</span>
          <span className={`readout-value ${stats.totalProfit >= 0 ? 'green' : 'red'}`}>
            {signedMoney(stats.totalProfit, currency)}
          </span>
        </div>
        <div className="readout-row">
          <span className="readout-label">RETURN ON STARTING BANK</span>
          <span className="readout-value cyan">
            {settings.startingBankroll > 0 ? percent(stats.totalProfit / settings.startingBankroll, 1) : '—'}
          </span>
        </div>
        <div className="readout-row">
          <span className="readout-label">OPEN OFFERS / PIPELINE VALUE</span>
          <span className="readout-value amber">
            {stats.openOffers} / {money(stats.pipeline, currency)}
          </span>
        </div>
        <div className="readout-row">
          <span className="readout-label">EXCHANGE COMMISSION</span>
          <span className="readout-value">
            {settings.exchange.toUpperCase()} {percent(settings.commission, 2)}
          </span>
        </div>
      </div>

      <div className="row-between" style={{ marginTop: 10, flexWrap: 'wrap', gap: 6 }}>
        <span className="field-label" style={{ margin: 0 }}>
          BACKUP &amp; RESTORE
        </span>
        <div className="panel-tools">
          <button className="btn" type="button" onClick={onExport}>
            EXPORT JSON
          </button>
          <button className="btn" type="button" onClick={onImport}>
            IMPORT JSON
          </button>
          {isDesktop ? (
            <button className="btn" type="button" onClick={onReveal} title="Show the save file in Explorer">
              SHOW FILE
            </button>
          ) : null}
        </div>
      </div>

      <div className="note-box" style={{ wordBreak: 'break-all' }}>
        Everything is saved on this PC only — no cloud, no account. Data file:
        <br />
        <span className="dim">{dataPath}</span>
      </div>
    </Panel>
  );
});

export default DataPanel;
