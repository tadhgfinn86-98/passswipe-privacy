import React from 'react';

const KEYS = [
  ['F1', 'Focus the matched betting calculator'],
  ['F2', 'Focus the offer tracker'],
  ['F3', 'Focus the bankroll / bet log'],
  ['F4', 'Focus settings & data'],
  ['Ctrl + M', 'Swap between QUALIFYING and FREE BET mode'],
  ['Ctrl + O', 'Add a new offer'],
  ['Ctrl + E', 'Export a JSON backup'],
  ['Ctrl + I', 'Import a JSON backup'],
  ['Tab / Shift+Tab', 'Move between fields'],
  ['Enter', 'Submit the form you are in'],
  ['Esc', 'Cancel the form you are editing, or close this window'],
  ['?', 'Show or hide this key map'],
];

export default function HelpOverlay({ onClose }) {
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
      <div className="overlay-card" onClick={(e) => e.stopPropagation()}>
        <h2>KEY MAP</h2>
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
        <div style={{ padding: '8px 10px', textAlign: 'right' }}>
          <button className="btn primary" type="button" onClick={onClose} autoFocus>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
