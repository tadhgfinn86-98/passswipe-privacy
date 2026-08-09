import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import TickerBar from './components/TickerBar.jsx';
import Calculator from './components/Calculator.jsx';
import OfferTracker from './components/OfferTracker.jsx';
import BetLog from './components/BetLog.jsx';
import DataPanel from './components/DataPanel.jsx';
import HelpOverlay from './components/HelpOverlay.jsx';
import Footer from './components/Footer.jsx';

import { DEFAULT_DATA, appInfo, exportData, importData, isDesktop, loadData, revealDataFile, saveData } from './lib/storage.js';
import { daysUntil } from './lib/format.js';

const SAVE_DEBOUNCE_MS = 400;

export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [toast, setToast] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [logPrefill, setLogPrefill] = useState(null);
  const [info, setInfo] = useState({ version: '1.0.0', dataPath: '' });

  const calcRef = useRef(null);
  const offersRef = useRef(null);
  const betsRef = useRef(null);
  const dataRef = useRef(null);
  const saveTimer = useRef(null);

  /* ------------------------------------------------------------- loading -- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loaded, meta] = await Promise.all([loadData(), appInfo()]);
      if (cancelled) return;
      setData({ ...DEFAULT_DATA, ...loaded, settings: { ...DEFAULT_DATA.settings, ...loaded.settings } });
      setInfo(meta);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = useCallback((message, isError = false) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3200);
  }, []);

  /* -------------------------------------------------------- auto-saving --- */

  useEffect(() => {
    // Never write before the first load has landed, or we would overwrite the
    // saved file with defaults.
    if (!ready) return undefined;
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveData(data);
        setSaveState('saved');
      } catch (err) {
        setSaveState('error');
        flash(`Could not save: ${err.message}`, true);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(saveTimer.current);
  }, [data, ready, flash]);

  /* --------------------------------------------------------- derived data -- */

  const { settings, offers, bets } = data;
  const currency = settings.currency || '£';

  const stats = useMemo(() => {
    const totalProfit = bets.reduce((sum, b) => sum + (Number(b.profit) || 0), 0);
    const open = offers.filter((o) => o.status !== 'Done');
    return {
      totalProfit,
      bankroll: (Number(settings.startingBankroll) || 0) + totalProfit,
      openOffers: open.length,
      pipeline: open.reduce((sum, o) => sum + (Number(o.expectedProfit) || 0), 0),
      dueSoon: open.filter((o) => {
        const d = daysUntil(o.deadline);
        return d !== null && d <= 7;
      }).length,
    };
  }, [bets, offers, settings.startingBankroll]);

  /* ------------------------------------------------------------- mutators -- */

  const setOffers = useCallback((next) => setData((d) => ({ ...d, offers: next })), []);
  const setBets = useCallback((next) => setData((d) => ({ ...d, bets: next })), []);
  const setSettings = useCallback((next) => setData((d) => ({ ...d, settings: next })), []);

  const handleCommissionChange = useCallback(
    (commission, exchange) => setData((d) => ({ ...d, settings: { ...d.settings, commission, exchange } })),
    [],
  );

  const handleExport = useCallback(async () => {
    const res = await exportData(data);
    if (res?.ok) flash('BACKUP EXPORTED');
    else if (res && !res.canceled) flash(res.error || 'Export failed', true);
  }, [data, flash]);

  const handleImport = useCallback(async () => {
    const res = await importData();
    if (!res?.ok) {
      if (res && !res.canceled) flash(res.error || 'Import failed', true);
      return;
    }
    const imported = res.data;
    const confirmed = window.confirm(
      `Import will replace everything currently in the terminal.\n\n` +
        `Incoming: ${imported.offers?.length ?? 0} offers, ${imported.bets?.length ?? 0} bets.\n` +
        `Current:  ${offers.length} offers, ${bets.length} bets.\n\nContinue?`,
    );
    if (!confirmed) return;
    setData({
      ...DEFAULT_DATA,
      ...imported,
      settings: { ...DEFAULT_DATA.settings, ...(imported.settings || {}) },
    });
    flash('BACKUP IMPORTED');
  }, [bets.length, offers.length, flash]);

  /* ------------------------------------------------------------ shortcuts -- */

  useEffect(() => {
    function focusPanel(ref) {
      const panel = ref.current;
      if (!panel) return;
      panel.scrollIntoView({ block: 'nearest' });
      const firstField = panel.querySelector('input, select, textarea, button');
      (firstField || panel).focus();
    }

    function onKeyDown(event) {
      const target = event.target;
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(target?.tagName || '');

      if (event.key === 'Escape') {
        if (showHelp) setShowHelp(false);
        else if (typing) target.blur();
        return;
      }

      // "?" is only a shortcut when it is not being typed into a field.
      if (event.key === '?' && !typing) {
        event.preventDefault();
        setShowHelp((s) => !s);
        return;
      }

      switch (event.key) {
        case 'F1':
          event.preventDefault();
          focusPanel(calcRef);
          return;
        case 'F2':
          event.preventDefault();
          focusPanel(offersRef);
          return;
        case 'F3':
          event.preventDefault();
          focusPanel(betsRef);
          return;
        case 'F4':
          event.preventDefault();
          focusPanel(dataRef);
          return;
        default:
          break;
      }

      if (event.ctrlKey && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 'e') {
          event.preventDefault();
          handleExport();
        } else if (key === 'i') {
          event.preventDefault();
          handleImport();
        } else if (key === 'o') {
          event.preventDefault();
          offersRef.current?.querySelector('button.primary')?.click();
        } else if (key === 'm') {
          event.preventDefault();
          calcRef.current?.querySelector('.segmented button:not([aria-pressed="true"])')?.click();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleExport, handleImport, showHelp]);

  /* ---------------------------------------------------------------- view -- */

  if (!ready) {
    return (
      <div className="empty-state" style={{ paddingTop: 80 }}>
        <span className="amber">LOADING TERMINAL</span>
        <span className="blink amber"> ▊</span>
      </div>
    );
  }

  return (
    <div className="app">
      <TickerBar
        bankroll={stats.bankroll}
        totalProfit={stats.totalProfit}
        openOffers={stats.openOffers}
        dueSoon={stats.dueSoon}
        betCount={bets.length}
        currency={currency}
      />

      <div className="workspace">
        <Calculator
          ref={calcRef}
          settings={settings}
          currency={currency}
          availableFloat={stats.bankroll}
          onCommissionChange={handleCommissionChange}
          onSendToLog={(payload) => {
            setLogPrefill(payload);
            flash('SENT TO BET LOG — CHECK THE FORM');
          }}
        />

        <OfferTracker ref={offersRef} offers={offers} onChange={setOffers} currency={currency} />

        <DataPanel
          ref={dataRef}
          settings={settings}
          onSettingsChange={setSettings}
          onExport={handleExport}
          onImport={handleImport}
          onReveal={revealDataFile}
          stats={stats}
          dataPath={info.dataPath}
          version={info.version}
          currency={currency}
          isDesktop={isDesktop}
        />

        <BetLog
          ref={betsRef}
          bets={bets}
          offers={offers}
          onChange={setBets}
          startingBankroll={Number(settings.startingBankroll) || 0}
          currency={currency}
          prefill={logPrefill}
          onPrefillConsumed={() => setLogPrefill(null)}
        />
      </div>

      <Footer saveState={saveState} onHelp={() => setShowHelp(true)} />

      {showHelp ? <HelpOverlay onClose={() => setShowHelp(false)} /> : null}
      {toast ? <div className={`toast${toast.isError ? ' error' : ''}`}>{toast.message}</div> : null}
    </div>
  );
}
