import React from 'react';
import { money, signedMoney } from '../lib/format.js';

/** Compact KPI tile used across the dashboard and reports. */
export function Stat({ label, value, tone = '', sub, size = '' }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className={`stat-tile-value ${tone} ${size}`}>{value}</div>
      {sub ? <div className="stat-tile-sub">{sub}</div> : null}
    </div>
  );
}

export function MoneyStat({ label, amount, currency, signed = false, sub }) {
  return (
    <Stat
      label={label}
      value={signed ? signedMoney(amount, currency) : money(amount, currency)}
      tone={signed ? (amount < 0 ? 'neg' : 'pos') : ''}
      sub={sub}
    />
  );
}

/** Horizontal magnitude bars — profit split by bookmaker, offer type, etc. */
export function BarList({ rows, currency, empty = 'No data yet.' }) {
  if (rows.length === 0) return <div className="empty-state">{empty}</div>;
  const peak = Math.max(...rows.map((r) => Math.abs(r.profit)), 1);
  return (
    <div className="barlist">
      {rows.map((row) => (
        <div className="barlist-row" key={row.key}>
          <div className="barlist-head">
            <span className="truncate">{row.key}</span>
            <span className={`mono ${row.profit < 0 ? 'neg' : 'pos'}`}>
              {signedMoney(row.profit, currency)}
            </span>
          </div>
          <div className="barlist-track">
            <div
              className={`barlist-fill ${row.profit < 0 ? 'neg' : ''}`}
              style={{ width: `${(Math.abs(row.profit) / peak) * 100}%` }}
            />
          </div>
          <div className="sub">{row.count} bets</div>
        </div>
      ))}
    </div>
  );
}

export function Field({ label, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}

export function Empty({ children }) {
  return <div className="empty-state">{children}</div>;
}

const DOT_FOR = {
  Active: 'done',
  Limited: 'todo',
  Gubbed: 'late',
  Closed: 'late',
  'To Do': 'todo',
  'In Progress': 'progress',
  Done: 'done',
  Pending: 'progress',
  'Back won': 'done',
  'Lay won': 'done',
  'Cashed out': 'todo',
  Void: 'late',
};

/** Status pill with a semantic dot — the only place extra hues appear. */
export function StatusChip({ value, onClick, title }) {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag className="chip" onClick={onClick} title={title} type={onClick ? 'button' : undefined}>
      <span className={`dot ${DOT_FOR[value] || 'todo'}`} />
      {value}
    </Tag>
  );
}
