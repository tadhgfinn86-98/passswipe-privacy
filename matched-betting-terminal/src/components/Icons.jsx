import React from 'react';

// 24px outlined icons, 1.5px stroke, single-colour so they inherit the rail's
// fog / paper-white / ice-signal states.
const box = { viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false };

export const DashboardIcon = () => (
  <svg {...box}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
  </svg>
);

export const BetsIcon = () => (
  <svg {...box}>
    <path d="M4 19V5" />
    <path d="M4 19h16" />
    <path d="M8 15l3.5-4 3 2.5L20 7" />
  </svg>
);

export const OffersIcon = () => (
  <svg {...box}>
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <path d="M8 9.5l1.6 1.6L13 7.8" />
    <path d="M8 15h8" />
  </svg>
);

export const CalculatorIcon = () => (
  <svg {...box}>
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M8 7h8" />
    <path d="M8 12h1M12 12h1M16 12h1M8 16h1M12 16h1M16 16h1" />
  </svg>
);

export const AccountsIcon = () => (
  <svg {...box}>
    <rect x="3" y="6" width="18" height="13" rx="2" />
    <path d="M3 10h18" />
    <path d="M16.5 14.5h1" />
  </svg>
);

export const ReportsIcon = () => (
  <svg {...box}>
    <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5" />
    <path d="M9 13h6M9 17h4" />
  </svg>
);

export const HelpIcon = () => (
  <svg {...box}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.2 2.4c-.6.2-1 .8-1 1.4v.4" />
    <path d="M12 17h.01" />
  </svg>
);
