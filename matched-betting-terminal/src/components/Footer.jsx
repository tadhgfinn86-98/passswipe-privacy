import React from 'react';

export default function Footer({ saveState, onHelp }) {
  const label =
    saveState === 'saving' ? 'SAVING…' : saveState === 'error' ? 'SAVE FAILED' : 'SAVED LOCALLY';
  const tone = saveState === 'error' ? 'red' : saveState === 'saving' ? 'amber' : 'green';

  return (
    <footer className="footer">
      <span className="disclaimer">
        For managing legitimate matched betting offers only. 18+. Gamble responsibly — BeGambleAware.org
      </span>
      <span className="panel-tools">
        <button className="btn tiny" type="button" onClick={onHelp} title="Keyboard shortcuts (?)">
          KEY MAP ?
        </button>
        <span className="rule">│</span>
        <span className={tone}>
          <span className="blink">●</span> {label}
        </span>
      </span>
    </footer>
  );
}
