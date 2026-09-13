import React, { useMemo } from 'react';
import { money } from '../lib/format.js';

// Literal colours: CSS custom properties do not resolve inside SVG
// presentation attributes, so the theme values are repeated here.
const ICE = '#83c3ff';
const VERMILION = '#e24756';
const GRID = 'rgba(255,255,255,0.06)';
const IRON = '#34353c';
const FOG = '#acadae';

/**
 * Running bankroll over time as a plain SVG polyline — no charting dependency,
 * works fully offline.
 */
export default function ProfitChart({ bets, startingBankroll, currency, height = 150 }) {
  const points = useMemo(() => {
    const ordered = [...bets].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let running = startingBankroll;
    const series = [{ label: 'Start', value: running }];
    ordered.forEach((bet) => {
      running += Number(bet.profit) || 0;
      series.push({ label: bet.date, value: running });
    });
    return series;
  }, [bets, startingBankroll]);

  if (points.length < 2) {
    return (
      <div className="empty-state" style={{ padding: '24px 8px' }}>
        Log a bet to plot your bankroll.
        <div style={{ marginTop: 6 }}>
          Start <span className="mono pos">{money(startingBankroll, currency)}</span>
        </div>
      </div>
    );
  }

  const W = 480;
  const H = height;
  const padL = 46;
  const padR = 6;
  const padT = 10;
  const padB = 12;

  const values = points.map((p) => p.value);
  let min = Math.min(...values, startingBankroll);
  let max = Math.max(...values, startingBankroll);
  if (max - min < 1) {
    // A flat series would otherwise collapse to a zero-height band.
    min -= 1;
    max += 1;
  }
  const headroom = (max - min) * 0.12;
  min -= headroom;
  max += headroom;

  const x = (i) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(min).toFixed(1)} L${x(0).toFixed(1)},${y(min).toFixed(1)} Z`;

  const last = points[points.length - 1].value;
  const up = last >= startingBankroll;
  const stroke = up ? ICE : VERMILION;

  return (
    <>
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          role="img"
          aria-label={`Bankroll from ${money(startingBankroll, currency)} to ${money(last, currency)}`}
        >
          <defs>
            <linearGradient id="bankroll-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.20" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>

          {[max, (max + min) / 2, min].map((v) => (
            <g key={v}>
              <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="1" />
              <text x={padL - 6} y={y(v) + 3} fill={FOG} fontSize="9" textAnchor="end">
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
            stroke={IRON}
            strokeWidth="1"
            strokeDasharray="3 3"
          />

          <path d={area} fill="url(#bankroll-fill)" />
          <path d={line} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />

          {points.map((p, i) => (
            <circle key={`${p.label}-${i}`} cx={x(i)} cy={y(p.value)} r="1.8" fill={stroke}>
              <title>{`${p.label}: ${money(p.value, currency)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="chart-legend">
        <span>
          Start <span className="mono">{money(startingBankroll, currency)}</span>
        </span>
        <span>
          Peak <span className="mono">{money(Math.max(...values), currency)}</span>
        </span>
        <span>
          Low <span className="mono">{money(Math.min(...values), currency)}</span>
        </span>
      </div>
    </>
  );
}
