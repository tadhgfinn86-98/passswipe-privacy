import React from 'react';

export default function Footer({ saveState, version, onHelp }) {
  const label = saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Save failed' : 'Saved locally';
  const tone = saveState === 'error' ? 'error' : saveState === 'saving' ? 'saving' : '';

  return (
    <footer className="footer">
      <div className="footer-links">
        <span className="nowrap">For managing legitimate matched betting offers only. 18+.</span>
        <span className="footer-sep" />
        <span className="nowrap">Gamble responsibly — BeGambleAware.org</span>
      </div>
      <div className="footer-right">
        <button type="button" className="link footer-btn" onClick={onHelp}>
          Shortcuts
        </button>
        <span className="footer-sep" />
        <span className="mono">v{version}</span>
        <span className="footer-sep" />
        <span className="nowrap">
          <span className={`status-dot ${tone}`} />
          {label}
        </span>
      </div>
    </footer>
  );
}
