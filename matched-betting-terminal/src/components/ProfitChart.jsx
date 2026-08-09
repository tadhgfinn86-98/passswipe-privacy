import React, { useMemo } from 'react';
import { money } from '../lib/format.js';

// Literal colours: CSS custom properties do not resolve inside SVG
// presentation attributes, so the theme values are repeated here.
const GREEN = '#33ff66';
const RED = '#ff4d4d';
const AMBER_FAINT = '#6b4d10';
const GRID = '#1c1f28';
const DIM = '#6f7684';

/**
 * Running bankroll over time, drawn as a plain SVG polyline so the app carries
 * no charting dependency and works fully offline.
 */
export default function ProfitChart({ bets, startingBankroll, currency }) {
  const points = useMemo(() => {
    const ordered = [...bets].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let running = startingBankroll;
    const series = [{ label: 'START', value: running }];
    ordered.forEach((bet) => {
      running += Number(bet.profit) || 0;
      series.push({ label: bet.date, value: running });
    });
    return series;
  }, [bets, startingBankroll]);

  if (points.length < 2) {
    return (
      <div className="empty-state">
        LOG A BET TO PLOT YOUR RUNNING BANKROLL
        <div style={{ marginTop: 4 }}>
          START: <span className="amber">{money(startingBankroll, currency)}</span>
        </div>
      </div>
    );
  }

  // The viewBox is kept close to the real rendered width of the chart column,
  // otherwise uniform scaling shrinks the axis labels to an unreadable size.
  const W = 340;
  const H = 200;
  const padL = 52;
  const padR = 10;
  const padT = 12;
  const padB = 14;

  const values = points.map((p) => p.value);
  let min = Math.min(...values, startingBankroll);
  let max = Math.max(...values, startingBankroll);
  if (max - min < 1) {
    // A flat series would otherwise collapse to a zero-height band.
    min -= 1;
    max += 1;
  }
  const headroom = (max - min) * 0.1;
  min -= headroom;
  max += headroom;

  const x = (i) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`)
    .join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(min).toFixed(1)} L${x(0).toFixed(
    1,
  )},${y(min).toFixed(1)} Z`;

  const last = points[points.length - 1].value;
  const up = last >= startingBankroll;
  const stroke = up ? GREEN : RED;
  const gridValues = [max, (max + min) / 2, min];

  return (
    <>
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Running bankroll from ${money(startingBankroll, currency)} to ${money(last, currency)}`}
        >
          <defs>
            <linearGradient id="bankroll-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {gridValues.map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="1" />
              <text x={padL - 6} y={y(v) + 3} fill={DIM} fontSize="10" textAnchor="end">
                {money(v, currency)}
              </text>
            </g>
          ))}

          {/* Starting bankroll baseline — above it you are in profit. */}
          <line
            x1={padL}
            x2={W - padR}
            y1={y(startingBankroll)}
            y2={y(startingBankroll)}
            stroke={AMBER_FAINT}
            strokeWidth="1"
            strokeDasharray="4 3"
          />

          <path d={area} fill="url(#bankroll-fill)" />
          <path d={line} fill="none" stroke={stroke} strokeWidth="1.8" />

          {points.map((p, i) => (
            <circle key={`${p.label}-${i}`} cx={x(i)} cy={y(p.value)} r="2.2" fill={stroke}>
              <title>{`${p.label}: ${money(p.value, currency)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="chart-legend">
        <span>
          START <span className="amber">{money(startingBankroll, currency)}</span>
        </span>
        <span>
          NOW <span className={up ? 'green' : 'red'}>{money(last, currency)}</span>
        </span>
        <span>
          PEAK <span className="dim">{money(Math.max(...values), currency)}</span>
        </span>
        <span>
          LOW <span className="dim">{money(Math.min(...values), currency)}</span>
        </span>
      </div>
    </>
  );
}
