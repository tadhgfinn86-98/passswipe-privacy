import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import TopNav from './components/TopNav.jsx';
import IconRail, { TABS } from './components/IconRail.jsx';
import HelpOverlay from './components/HelpOverlay.jsx';
import Footer from './components/Footer.jsx';

import Dashboard from './tabs/Dashboard.jsx';
import Bets from './tabs/Bets.jsx';
import Offers from './tabs/Offers.jsx';
import Calculators from './tabs/Calculators.jsx';
import Accounts from './tabs/Accounts.jsx';
import Reports from './tabs/Reports.jsx';

import {
  appInfo,
  defaultData,
  exportCsv,
  exportData,
  importCsv,
  importData,
  isDesktop,
  loadData,
  revealDataFile,
  saveData,
} from './lib/storage.js';
import { accountsTotal, emptyProfile, realisedProfit, tiedUp } from './lib/model.js';

const SAVE_DEBOUNCE_MS = 400;

export default function App() {
  const [data, setData] = useState(() => defaultData());
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState('saved');
  const [toast, setToast] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [betPrefill, setBetPrefill] = useState(null);
  const [info, setInfo] = useState({ version: '1.0.0', dataPath: '' });

  const saveTimer = useRef(null);

  /* ------------------------------------------------------------- loading -- */

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loaded, meta] = await Promise.all([loadData(), appInfo()]);
      if (cancelled) return;
      setData(loaded);
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

  /* --------------------------------------------------------- auto-saving -- */

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

  /* -------------------------------------------------------------- profile -- */

  const profile = useMemo(
    () => data.profiles.find((p) => p.id === data.activeProfileId) || data.profiles[0],
    [data],
  );
  const currency = profile.settings.currency || '£';

  /** Every tab mutates the active profile through this one path. */
  const patchProfile = useCallback(
    (patch) =>
      setData((d) => ({
        ...d,
        profiles: d.profiles.map((p) => (p.id === d.activeProfileId ? { ...p, ...patch } : p)),
      })),
    [],
  );

  const setBets = useCallback((bets) => patchProfile({ bets }), [patchProfile]);
  const setOffers = useCallback((offers) => patchProfile({ offers }), [patchProfile]);
  const setAccounts = useCallback((accounts) => patchProfile({ accounts }), [patchProfile]);
  const setWithdrawals = useCallback((withdrawals) => patchProfile({ withdrawals }), [patchProfile]);
  const setSettings = useCallback((settings) => patchProfile({ settings }), [patchProfile]);

  const handleCommissionChange = useCallback(
    (commission, exchange) =>
      patchProfile({ settings: { ...profile.settings, commission, exchange } }),
    [patchProfile, profile.settings],
  );

  const addProfile = useCallback(() => {
    const name = window.prompt('Name for the new profile?');
    if (!name?.trim()) return;
    const next = emptyProfile(name.trim());
    setData((d) => ({ ...d, profiles: [...d.profiles, next], activeProfileId: next.id }));
    flash(`Profile "${next.name}" created`);
  }, [flash]);

  /* --------------------------------------------------------------- totals -- */

  const totals = useMemo(() => {
    const profit = realisedProfit(profile.bets);
    const accountsSum = accountsTotal(profile.accounts);
    return {
      profit,
      tied: tiedUp(profile.bets),
      bankroll: accountsSum || (Number(profile.settings.startingBankroll) || 0) + profit,
      openOffers: profile.offers.filter((o) => o.status !== 'Done').length,
    };
  }, [profile]);

  /* ------------------------------------------------------------ transfers -- */

  const handleExport = useCallback(async () => {
    const res = await exportData(data);
    if (res?.ok) flash('Backup exported');
    else if (res && !res.canceled) flash(res.error || 'Export failed', true);
  }, [data, flash]);

  const handleImport = useCallback(async () => {
    const res = await importData();
    if (!res?.ok) {
      if (res && !res.canceled) flash(res.error || 'Import failed', true);
      return;
    }
    const incoming = res.data;
    const bets = incoming.profiles.reduce((n, p) => n + p.bets.length, 0);
    const confirmed = window.confirm(
      `Import replaces everything currently in the terminal.\n\n` +
        `Incoming: ${incoming.profiles.length} profile(s), ${bets} bets.\n\nContinue?`,
    );
    if (!confirmed) return;
    setData(incoming);
    flash('Backup imported');
  }, [flash]);

  const handleExportCsv = useCallback(
    async (csv, name) => {
      const res = await exportCsv(csv, name);
      if (res?.ok) flash('CSV exported');
      else if (res && !res.canceled) flash(res.error || 'CSV export failed', true);
    },
    [flash],
  );

  /* ------------------------------------------------------------ shortcuts -- */

  useEffect(() => {
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

      const byKey = TABS.find((t) => t.hotkey === event.key);
      if (byKey) {
        event.preventDefault();
        setTab(byKey.id);
        return;
      }

      if (event.ctrlKey && !event.shiftKey && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === 'e') {
          event.preventDefault();
          handleExport();
        } else if (key === 'i') {
          event.preventDefault();
          handleImport();
        }
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleExport, handleImport, showHelp]);

  /* ---------------------------------------------------------------- view -- */

  if (!ready) {
    return (
      <div className="empty-state" style={{ paddingTop: 120 }}>
        <span className="accent">Loading terminal…</span>
      </div>
    );
  }

  return (
    <div className="app">
      <TopNav
        bankroll={totals.bankroll}
        profit={totals.profit}
        tied={totals.tied}
        openOffers={totals.openOffers}
        currency={currency}
        profiles={data.profiles}
        activeProfileId={data.activeProfileId}
        onSwitchProfile={(id) => setData((d) => ({ ...d, activeProfileId: id }))}
        onAddProfile={addProfile}
      />

      <div className="shell">
        <IconRail active={tab} onNavigate={setTab} onHelp={() => setShowHelp(true)} />

        <main className="center" key={tab}>
          {tab === 'dashboard' ? <Dashboard profile={profile} currency={currency} /> : null}

          {tab === 'bets' ? (
            <Bets
              profile={profile}
              currency={currency}
              onChange={setBets}
              prefill={betPrefill}
              onPrefillConsumed={() => setBetPrefill(null)}
            />
          ) : null}

          {tab === 'offers' ? <Offers profile={profile} currency={currency} onChange={setOffers} /> : null}

          {tab === 'calculators' ? (
            <Calculators
              profile={profile}
              currency={currency}
              availableFloat={totals.bankroll}
              onCommissionChange={handleCommissionChange}
              onSendToLog={(payload) => {
                setBetPrefill(payload);
                setTab('bets');
                flash('Sent to the bet log — finish the row and save');
              }}
            />
          ) : null}

          {tab === 'accounts' ? (
            <Accounts
              profile={profile}
              currency={currency}
              onAccountsChange={setAccounts}
              onWithdrawalsChange={setWithdrawals}
            />
          ) : null}

          {tab === 'reports' ? (
            <Reports
              profile={profile}
              currency={currency}
              settings={profile.settings}
              onSettingsChange={setSettings}
              onBetsChange={setBets}
              onExport={handleExport}
              onImport={handleImport}
              onReveal={revealDataFile}
              onExportCsv={handleExportCsv}
              onImportCsv={importCsv}
              isDesktop={isDesktop}
              dataPath={info.dataPath}
            />
          ) : null}
        </main>
      </div>

      <Footer saveState={saveState} version={info.version} onHelp={() => setShowHelp(true)} />

      {showHelp ? <HelpOverlay onClose={() => setShowHelp(false)} /> : null}
      {toast ? <div className={`toast${toast.isError ? ' error' : ''}`}>{toast.message}</div> : null}
    </div>
  );
}
