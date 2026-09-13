import React, { useEffect, useState } from 'react';
import { money, signedMoney } from '../lib/format.js';

function NavStat({ label, value, tone = '' }) {
  return (
    <div className="navstat">
      <span className="navstat-label">{label}</span>
      <span className={`navstat-value ${tone}`}>{value}</span>
    </div>
  );
}

/** Top band: brand, live position strip, profile switcher and bankroll pill. */
export default function TopNav({
  bankroll,
  profit,
  tied,
  openOffers,
  currency,
  profiles,
  activeProfileId,
  onSwitchProfile,
  onAddProfile,
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="topnav">
      <div className="brand">
        <span className="brand-mark">MB</span>
      </div>
      <span className="brand-name">Matched Betting Terminal</span>

      <div className="navstats">
        <NavStat label="P/L" value={signedMoney(profit, currency)} tone={profit < 0 ? 'neg' : 'pos'} />
        <NavStat label="Tied up" value={money(tied, currency)} tone={tied > 0 ? 'accent' : 'muted'} />
        <NavStat label="Open offers" value={String(openOffers)} />
        <NavStat
          label={now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          value={now.toLocaleTimeString('en-GB', { hour12: false })}
          tone="muted"
        />
      </div>

      {profiles.length > 1 || onAddProfile ? (
        <select
          className="profile-select"
          value={activeProfileId}
          onChange={(e) => {
            if (e.target.value === '__new') onAddProfile();
            else onSwitchProfile(e.target.value);
          }}
          aria-label="Active profile"
          title="Switch profile"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
          <option value="__new">+ New profile…</option>
        </select>
      ) : null}

      <div className="nav-pill" title="Current bankroll">
        <span className="nav-dot" />
        <span className="muted" style={{ fontSize: 12 }}>
          Bankroll
        </span>
        <span className="nav-pill-value">{money(bankroll, currency)}</span>
      </div>
    </header>
  );
}
