import React from 'react';
import {
  AccountsIcon,
  BetsIcon,
  CalculatorIcon,
  DashboardIcon,
  HelpIcon,
  OffersIcon,
  ReportsIcon,
} from './Icons.jsx';

export const TABS = [
  { id: 'dashboard', label: 'Dashboard', hotkey: 'F1', Icon: DashboardIcon },
  { id: 'bets', label: 'Bet log', hotkey: 'F2', Icon: BetsIcon },
  { id: 'offers', label: 'Offers', hotkey: 'F3', Icon: OffersIcon },
  { id: 'calculators', label: 'Calculators', hotkey: 'F4', Icon: CalculatorIcon },
  { id: 'accounts', label: 'Accounts', hotkey: 'F5', Icon: AccountsIcon },
  { id: 'reports', label: 'Reports', hotkey: 'F6', Icon: ReportsIcon },
];

/** Persistent tab navigation: icon-only rail down the left edge. */
export default function IconRail({ active, onNavigate, onHelp }) {
  return (
    <nav className="rail" aria-label="Sections">
      {TABS.map(({ id, label, hotkey, Icon }) => (
        <button
          key={id}
          type="button"
          className="rail-btn"
          aria-current={active === id}
          aria-label={`${label} (${hotkey})`}
          title={`${label} · ${hotkey}`}
          onClick={() => onNavigate(id)}
        >
          <Icon />
        </button>
      ))}
      <div className="rail-spacer" />
      <button type="button" className="rail-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts · ?" onClick={onHelp}>
        <HelpIcon />
      </button>
    </nav>
  );
}
