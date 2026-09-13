import React from 'react';

const KEYS = [
  ['F1', 'Dashboard — calendar, charts and breakdowns'],
  ['F2', 'Bet log — every back/lay pair'],
  ['F3', 'Offers — pipeline, deadlines and reloads'],
  ['F4', 'Calculators — lay, dutching, each-way, casino'],
  ['F5', 'Accounts — balances, tied-up funds, gubbings'],
  ['F6', 'Reports — filters, rates, CSV and backup'],
  ['Ctrl + E', 'Export a JSON backup'],
  ['Ctrl + I', 'Import a JSON backup'],
  ['Tab / Shift+Tab', 'Move between fields'],
  ['Enter', 'Submit the form you are in'],
  ['Esc', 'Cancel the current form, or close this window'],
  ['?', 'Show or hide this list'],
];

export default function HelpOverlay({ onClose }) {
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <header className="card-head">
          <h2 className="card-title">Keyboard shortcuts</h2>
          <button className="btn sm" type="button" onClick={onClose} autoFocus>
            Close
          </button>
        </header>
        <table className="key-table">
          <tbody>
            {KEYS.map(([key, description]) => (
              <tr key={key}>
                <td>
                  <kbd>{key}</kbd>
                </td>
                <td>{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
