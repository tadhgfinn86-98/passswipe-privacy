import React, { forwardRef, useEffect, useMemo, useState } from 'react';
import Panel from './Panel.jsx';
import ProfitChart from './ProfitChart.jsx';
import { money, parseNum, signedMoney, today, uid } from '../lib/format.js';

function emptyBet(draft = {}) {
  return {
    id: uid(),
    date: today(),
    bookmaker: '',
    event: '',
    stake: '',
    profit: '',
    offerId: '',
    ...draft,
  };
}

/** Completed-bet ledger plus the running bankroll chart. */
const BetLog = forwardRef(function BetLog(
  { bets, offers, onChange, startingBankroll, currency, prefill, onPrefillConsumed },
  ref,
) {
  const [draft, setDraft] = useState(emptyBet);
  const [editingId, setEditingId] = useState(null);
  const [sortDir, setSortDir] = useState('desc');

  // "SEND TO BET LOG" in the calculator hands a partly filled row over.
  useEffect(() => {
    if (!prefill) return;
    setDraft(
      emptyBet({
        stake: prefill.stake ? String(Number(prefill.stake).toFixed(2)) : '',
        profit: Number(prefill.profit).toFixed(2),
        event: prefill.event || '',
      }),
    );
    setEditingId(null);
    onPrefillConsumed();
  }, [prefill, onPrefillConsumed]);

  const sorted = useMemo(() => {
    const rows = [...bets];
    rows.sort((a, b) => {
      const cmp = String(a.date).localeCompare(String(b.date));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [bets, sortDir]);

  const totalProfit = bets.reduce((sum, b) => sum + (Number(b.profit) || 0), 0);
  const totalStaked = bets.reduce((sum, b) => sum + (Number(b.stake) || 0), 0);

  function submit(event) {
    event.preventDefault();
    const profit = parseNum(draft.profit);
    const stake = parseNum(draft.stake);
    const cleaned = {
      ...draft,
      bookmaker: String(draft.bookmaker).trim() || 'UNNAMED',
      event: String(draft.event).trim(),
      date: draft.date || today(),
      stake: Number.isFinite(stake) ? stake : 0,
      profit: Number.isFinite(profit) ? profit : 0,
    };
    onChange(editingId ? bets.map((b) => (b.id === editingId ? cleaned : b)) : [...bets, cleaned]);
    setDraft(emptyBet());
    setEditingId(null);
  }

  function startEdit(bet) {
    setDraft({ ...bet, stake: String(bet.stake ?? ''), profit: String(bet.profit ?? '') });
    setEditingId(bet.id);
  }

  function remove(id) {
    onChange(bets.filter((b) => b.id !== id));
    if (editingId === id) {
      setDraft(emptyBet());
      setEditingId(null);
    }
  }

  const offerLabel = (offerId) => {
    const offer = offers.find((o) => o.id === offerId);
    return offer ? `${offer.bookmaker} — ${offer.requirement || offer.description || offer.type}` : '';
  };

  return (
    <Panel
      ref={ref}
      className="area-betlog"
      title="BANKROLL / BET LOG"
      hotkey="F3"
      flush
      tools={
        <span className="dim" style={{ fontSize: 9 }}>
          {bets.length} BETS · STAKED {money(totalStaked, currency)} · P/L{' '}
          <span className={totalProfit >= 0 ? 'green' : 'red'}>{signedMoney(totalProfit, currency)}</span>
        </span>
      }
    >
      <form
        onSubmit={submit}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && editingId) {
            e.stopPropagation();
            setDraft(emptyBet());
            setEditingId(null);
          }
        }}
        style={{ padding: 8, borderBottom: '1px solid var(--border)' }}
      >
        <div className="grid-3">
          <label className="field">
            <span className="field-label">DATE</span>
            <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
          </label>
          <label className="field">
            <span className="field-label">BOOKMAKER</span>
            <input
              type="text"
              value={draft.bookmaker}
              onChange={(e) => setDraft({ ...draft, bookmaker: e.target.value })}
              placeholder="Bet365"
            />
          </label>
          <label className="field">
            <span className="field-label">RELATED OFFER</span>
            <select value={draft.offerId} onChange={(e) => setDraft({ ...draft, offerId: e.target.value })}>
              <option value="">— none —</option>
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.bookmaker} — {offer.requirement || offer.description || offer.type}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid-3">
          <label className="field">
            <span className="field-label">EVENT</span>
            <input
              type="text"
              value={draft.event}
              onChange={(e) => setDraft({ ...draft, event: e.target.value })}
              placeholder="Arsenal v Chelsea"
            />
          </label>
          <label className="field">
            <span className="field-label">STAKE ({currency})</span>
            <input
              type="number"
              step="0.01"
              value={draft.stake}
              onChange={(e) => setDraft({ ...draft, stake: e.target.value })}
              placeholder="10.00"
            />
          </label>
          <label className="field">
            <span className="field-label">PROFIT / LOSS ({currency})</span>
            <input
              type="number"
              step="0.01"
              value={draft.profit}
              onChange={(e) => setDraft({ ...draft, profit: e.target.value })}
              placeholder="-0.75"
            />
          </label>
        </div>
        <div className="panel-tools" style={{ justifyContent: 'flex-end' }}>
          {editingId ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setDraft(emptyBet());
                setEditingId(null);
              }}
            >
              CANCEL (ESC)
            </button>
          ) : null}
          <button type="submit" className="btn primary">
            {editingId ? 'SAVE BET' : '+ LOG BET'}
          </button>
        </div>
      </form>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.9fr) minmax(230px, 0.85fr)' }}>
        <div style={{ borderRight: '1px solid var(--border)', minWidth: 0 }}>
          {bets.length === 0 ? (
            <div className="empty-state">NO BETS LOGGED YET</div>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th
                    className="sortable active"
                    onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
                    title="Sort by date"
                  >
                    DATE {sortDir === 'asc' ? '▲' : '▼'}
                  </th>
                  <th>BOOKMAKER</th>
                  <th>EVENT</th>
                  <th>OFFER</th>
                  <th className="num">STAKE</th>
                  <th className="num">P/L</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((bet) => (
                  <tr key={bet.id} className={editingId === bet.id ? 'editing' : ''}>
                    <td className="nowrap dim">{bet.date}</td>
                    <td className="amber nowrap">{bet.bookmaker}</td>
                    <td>{bet.event || <span className="dim">—</span>}</td>
                    <td className="dim truncate" title={offerLabel(bet.offerId)}>
                      {offerLabel(bet.offerId) || '—'}
                    </td>
                    <td className="num nowrap">{money(Number(bet.stake) || 0, currency)}</td>
                    <td className={`num nowrap ${(Number(bet.profit) || 0) >= 0 ? 'green' : 'red'}`}>
                      {signedMoney(Number(bet.profit) || 0, currency)}
                    </td>
                    <td className="nowrap">
                      <button className="btn tiny" type="button" onClick={() => startEdit(bet)}>
                        EDIT
                      </button>{' '}
                      <button className="btn tiny danger" type="button" onClick={() => remove(bet.id)}>
                        DEL
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            className="panel-title"
            style={{ padding: '4px 8px', borderBottom: '1px solid var(--border)', fontSize: 10 }}
          >
            RUNNING BANKROLL
          </div>
          <ProfitChart bets={bets} startingBankroll={startingBankroll} currency={currency} />
        </div>
      </div>
    </Panel>
  );
});

export default BetLog;
