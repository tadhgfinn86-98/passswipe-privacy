import React from 'react';
import { money, monthGrid, monthLabel, shiftMonth } from '../lib/format.js';

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Month grid of net profit per day. Positive days tint emerald, negative
 * vermilion, with opacity scaled to the biggest day in view.
 */
export default function Calendar({ month, onMonthChange, byDay, currency }) {
  const cells = monthGrid(month);
  const inMonth = cells.filter(Boolean).map((c) => byDay.get(c.iso) || 0);
  const peak = Math.max(...inMonth.map(Math.abs), 1);
  const monthTotal = inMonth.reduce((a, b) => a + b, 0);
  const activeDays = inMonth.filter((v) => v !== 0).length;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <div className="cal-head">
        <div className="card-tools">
          <button className="btn sm" type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} aria-label="Previous month">
            ‹
          </button>
          <span style={{ minWidth: 132, textAlign: 'center' }}>{monthLabel(month)}</span>
          <button className="btn sm" type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} aria-label="Next month">
            ›
          </button>
        </div>
        <span className="sub">
          {activeDays} active {activeDays === 1 ? 'day' : 'days'} ·{' '}
          <span className={`mono ${monthTotal < 0 ? 'neg' : 'pos'}`}>{money(monthTotal, currency)}</span>
        </span>
      </div>

      <div className="cal-grid" role="grid" aria-label={`Profit for ${monthLabel(month)}`}>
        {DOW.map((d) => (
          <div className="cal-dow" key={d}>
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div className="cal-cell empty" key={`pad-${i}`} />;
          const value = byDay.get(cell.iso) || 0;
          const intensity = value === 0 ? 0 : 0.12 + (Math.abs(value) / peak) * 0.38;
          const bg =
            value === 0
              ? undefined
              : value > 0
                ? `rgba(53, 192, 122, ${intensity.toFixed(3)})`
                : `rgba(226, 71, 86, ${intensity.toFixed(3)})`;
          return (
            <div
              className={`cal-cell${cell.iso === today ? ' today' : ''}`}
              key={cell.iso}
              style={{ background: bg }}
              title={`${cell.iso}: ${money(value, currency)}`}
            >
              <span className="cal-day">{cell.day}</span>
              {value !== 0 ? (
                <span className={`cal-value ${value < 0 ? 'neg' : 'pos'}`}>{money(value, currency)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
