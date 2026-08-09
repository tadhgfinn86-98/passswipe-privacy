import React, { useEffect, useState } from 'react';
import { money, signedMoney } from '../lib/format.js';

function Stat({ label, value, tone = 'plain', sub }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${tone}`}>{value}</span>
      {sub ? <span className="stat-sub">{sub}</span> : null}
    </div>
  );
}

/** Top status strip: bankroll, profit, open offers, date and a live clock. */
export default function TickerBar({ bankroll, totalProfit, openOffers, dueSoon, currency, betCount }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const dateText = now
    .toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
  const timeText = now.toLocaleTimeString('en-GB', { hour12: false });

  const profitTone = totalProfit > 0 ? 'green' : totalProfit < 0 ? 'red' : 'plain';

  return (
    <div className="ticker">
      <div className="ticker-brand">
        <span className="mark">MB</span>
        <span className="name">MATCHED BETTING TERMINAL</span>
      </div>
      <div className="ticker-stats">
        <Stat
          label="BANKROLL"
          value={money(bankroll, currency)}
          tone="amber"
          sub={`${betCount} BET${betCount === 1 ? '' : 'S'} LOGGED`}
        />
        <Stat
          label="PROFIT TO DATE"
          value={signedMoney(totalProfit, currency)}
          tone={profitTone}
          sub={totalProfit >= 0 ? 'NET POSITIVE' : 'NET NEGATIVE'}
        />
        <Stat
          label="OPEN OFFERS"
          value={String(openOffers)}
          tone={openOffers > 0 ? 'amber' : 'plain'}
          sub={dueSoon > 0 ? `${dueSoon} DUE ≤7D` : 'NONE DUE SOON'}
        />
        <Stat label="DATE" value={dateText} tone="plain" sub={`${timeText} LOCAL`} />
      </div>
    </div>
  );
}
