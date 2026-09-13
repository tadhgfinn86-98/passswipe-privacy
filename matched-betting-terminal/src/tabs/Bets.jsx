import React, { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import { Field, StatusChip } from '../components/ui.jsx';
import { MODES, settle } from '../lib/calc.js';
import { BET_STATUSES, OFFER_TYPES, isSettled } from '../lib/model.js';
import { money, parseNum, signedMoney, today, uid } from '../lib/format.js';

/** SNR is the only type where the stake is not returned. */
const modeFor = (offerType) => (offerType === 'Free bet (SNR)' ? MODES.FREEBET : MODES.QUALIFYING);

function emptyBet(defaults = {}) {
  return {
    id: uid(),
    date: today(),
    offerId: '',
    offerType: 'Qualifying bet',
    status: 'Pending',
    event: '',
    notes: '',
    minutes: '',
    back: { bookmaker: '', stake: '', odds: '' },
    lay: { exchange: defaults.exchange || '', stake: '', odds: '', commission: defaults.commission ?? 0.02 },
    profit: '',
    ...defaults.bet,
  };
}

export default function Bets({ profile, currency, onChange, prefill, onPrefillConsumed }) {
  const { bets, offers, accounts, settings } = profile;
  const [draft, setDraft] = useState(() => emptyBet({ exchange: settings.exchange, commission: settings.commission }));
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [sortDir, setSortDir] = useState('desc');

  const exchanges = accounts.filter((a) => a.type === 'Exchange');

  // The calculator hands over a partly filled bet.
  useEffect(() => {
    if (!prefill) return;
    setDraft(
      emptyBet({
        exchange: settings.exchange,
        commission: settings.commission,
        bet: {
          offerType: prefill.offerType || 'Qualifying bet',
          event: prefill.event || '',
          back: { bookmaker: '', stake: String(prefill.backStake ?? ''), odds: String(prefill.backOdds ?? '') },
          lay: {
            exchange: settings.exchange,
            stake: String(Number(prefill.layStake ?? 0).toFixed(2)),
            odds: String(prefill.layOdds ?? ''),
            commission: prefill.commission ?? settings.commission,
          },
        },
      }),
    );
    setEditingId(null);
    setShowForm(true);
    onPrefillConsumed();
  }, [prefill, onPrefillConsumed, settings.exchange, settings.commission]);

  /* Live figures for the row being entered. */
  const preview = useMemo(() => {
    const backStake = parseNum(draft.back.stake);
    const backOdds = parseNum(draft.back.odds);
    const layStake = parseNum(draft.lay.stake);
    const layOdds = parseNum(draft.lay.odds);
    const commission = Number(draft.lay.commission) || 0;
    if (![backStake, backOdds, layStake, layOdds].every(Number.isFinite)) return null;
    if (backOdds <= 1 || layOdds <= 1 || layStake < 0) return null;
    return settle({ mode: modeFor(draft.offerType), backStake, backOdds, layStake, layOdds, commission });
  }, [draft]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bets
      .filter((b) => (filterType === 'All' ? true : b.offerType === filterType))
      .filter((b) => (filterStatus === 'All' ? true : b.status === filterStatus))
      .filter((b) =>
        q === ''
          ? true
          : [b.back.bookmaker, b.lay.exchange, b.event, b.offerType, b.notes, b.date]
              .join(' ')
              .toLowerCase()
              .includes(q),
      )
      .sort((a, b) => {
        const cmp = String(a.date).localeCompare(String(b.date));
        return sortDir === 'asc' ? cmp : -cmp;
      });
  }, [bets, query, filterType, filterStatus, sortDir]);

  const shown = {
    profit: filtered.filter(isSettled).reduce((s, b) => s + Number(b.profit || 0), 0),
    staked: filtered.reduce((s, b) => s + Number(b.back.stake || 0), 0),
  };

  function startAdd() {
    setDraft(emptyBet({ exchange: settings.exchange, commission: settings.commission }));
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(bet) {
    setDraft({
      ...bet,
      minutes: String(bet.minutes || ''),
      profit: String(bet.profit ?? ''),
      back: { ...bet.back, stake: String(bet.back.stake ?? ''), odds: String(bet.back.odds ?? '') },
      lay: { ...bet.lay, stake: String(bet.lay.stake ?? ''), odds: String(bet.lay.odds ?? '') },
    });
    setEditingId(bet.id);
    setShowForm(true);
  }

  function submit(event) {
    event.preventDefault();
    const backStake = parseNum(draft.back.stake) || 0;
    const backOdds = parseNum(draft.back.odds) || 0;
    const layStake = parseNum(draft.lay.stake) || 0;
    const layOdds = parseNum(draft.lay.odds) || 0;
    const expected = preview ? preview.locked : 0;
    const typedProfit = parseNum(draft.profit);

    const cleaned = {
      id: draft.id,
      date: draft.date || today(),
      offerId: draft.offerId,
      offerType: draft.offerType,
      status: draft.status,
      event: draft.event.trim(),
      notes: draft.notes.trim(),
      minutes: parseNum(draft.minutes) || 0,
      back: { bookmaker: draft.back.bookmaker.trim() || 'Unnamed', stake: backStake, odds: backOdds },
      lay: {
        exchange: draft.lay.exchange.trim(),
        stake: layStake,
        odds: layOdds,
        commission: Number(draft.lay.commission) || 0,
        liability: preview ? preview.liability : layStake * Math.max(layOdds - 1, 0),
      },
      expectedProfit: expected,
      // A settled bet keeps whatever you typed; otherwise it falls back to the
      // locked figure so pending rows still forecast correctly.
      profit: draft.status === 'Pending' ? 0 : Number.isFinite(typedProfit) ? typedProfit : expected,
    };

    onChange(editingId ? bets.map((b) => (b.id === editingId ? cleaned : b)) : [...bets, cleaned]);
    setShowForm(false);
    setEditingId(null);
  }

  function remove(id) {
    onChange(bets.filter((b) => b.id !== id));
  }

  function cycleStatus(bet) {
    const next = BET_STATUSES[(BET_STATUSES.indexOf(bet.status) + 1) % BET_STATUSES.length];
    onChange(
      bets.map((b) =>
        b.id === bet.id
          ? { ...b, status: next, profit: next === 'Pending' ? 0 : b.profit || b.expectedProfit }
          : b,
      ),
    );
  }

  const setBack = (patch) => setDraft((d) => ({ ...d, back: { ...d.back, ...patch } }));
  const setLay = (patch) => setDraft((d) => ({ ...d, lay: { ...d.lay, ...patch } }));

  return (
    <div className="page">
      <Card
        title="Bet log"
        hotkey="F2"
        bodyClassName="flush"
        tools={
          <>
            <span className="sub nowrap">
              {filtered.length} shown · staked <span className="mono">{money(shown.staked, currency)}</span> · P/L{' '}
              <span className={`mono ${shown.profit < 0 ? 'neg' : 'pos'}`}>{signedMoney(shown.profit, currency)}</span>
            </span>
            <button className="btn accent sm" type="button" onClick={startAdd}>
              Add bet
            </button>
          </>
        }
      >
        <div className="filterbar">
          <input
            type="text"
            className="search"
            placeholder="Search bookmaker, event, notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search bets"
          />
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filter by offer type">
            <option value="All">All types</option>
            {OFFER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by status">
            <option value="All">All statuses</option>
            {BET_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {query || filterType !== 'All' || filterStatus !== 'All' ? (
            <button
              className="btn sm"
              type="button"
              onClick={() => {
                setQuery('');
                setFilterType('All');
                setFilterStatus('All');
              }}
            >
              Clear
            </button>
          ) : null}
        </div>

        {showForm ? (
          <form
            className="entry-form"
            onSubmit={submit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setShowForm(false);
                setEditingId(null);
              }
            }}
          >
            <div className="form-cols">
              <div>
                <div className="form-legend">Bet</div>
                <div className="grid-2">
                  <Field label="Date">
                    <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                  </Field>
                  <Field label="Offer type">
                    <select value={draft.offerType} onChange={(e) => setDraft({ ...draft, offerType: e.target.value })}>
                      {OFFER_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="Event">
                  <input
                    type="text"
                    value={draft.event}
                    onChange={(e) => setDraft({ ...draft, event: e.target.value })}
                    placeholder="Arsenal v Chelsea"
                  />
                </Field>
                <div className="grid-2">
                  <Field label="Linked offer">
                    <select value={draft.offerId} onChange={(e) => setDraft({ ...draft, offerId: e.target.value })}>
                      <option value="">None</option>
                      {offers.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.bookmaker} — {o.requirement || o.type}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Minutes spent">
                    <input
                      type="number"
                      min="0"
                      value={draft.minutes}
                      onChange={(e) => setDraft({ ...draft, minutes: e.target.value })}
                      placeholder="10"
                    />
                  </Field>
                </div>
              </div>

              <div>
                <div className="form-legend">Back (bookmaker)</div>
                <Field label="Bookmaker">
                  <input
                    type="text"
                    list="bookmaker-list"
                    value={draft.back.bookmaker}
                    onChange={(e) => setBack({ bookmaker: e.target.value })}
                    placeholder="Sky Bet"
                  />
                </Field>
                <div className="grid-2">
                  <Field label={`Stake (${currency})`}>
                    <input type="number" step="0.01" value={draft.back.stake} onChange={(e) => setBack({ stake: e.target.value })} />
                  </Field>
                  <Field label="Back odds">
                    <input type="number" step="0.01" value={draft.back.odds} onChange={(e) => setBack({ odds: e.target.value })} />
                  </Field>
                </div>
              </div>

              <div>
                <div className="form-legend">Lay (exchange)</div>
                <Field label="Exchange">
                  <input
                    type="text"
                    list="exchange-list"
                    value={draft.lay.exchange}
                    onChange={(e) => setLay({ exchange: e.target.value })}
                    placeholder="Smarkets"
                  />
                </Field>
                <div className="grid-2">
                  <Field label={`Lay stake (${currency})`}>
                    <input type="number" step="0.01" value={draft.lay.stake} onChange={(e) => setLay({ stake: e.target.value })} />
                  </Field>
                  <Field label="Lay odds">
                    <input type="number" step="0.01" value={draft.lay.odds} onChange={(e) => setLay({ odds: e.target.value })} />
                  </Field>
                </div>
                <div className="grid-2">
                  <Field label="Commission (%)">
                    <input
                      type="number"
                      step="0.1"
                      value={(Number(draft.lay.commission) * 100).toFixed(2).replace(/\.?0+$/, '') || '0'}
                      onChange={(e) => {
                        const pct = parseNum(e.target.value);
                        if (Number.isFinite(pct) && pct >= 0 && pct < 100) setLay({ commission: pct / 100 });
                      }}
                    />
                  </Field>
                  <Field label="Status">
                    <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                      {BET_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </div>
            </div>

            <datalist id="bookmaker-list">
              {accounts.filter((a) => a.type === 'Bookmaker').map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
            <datalist id="exchange-list">
              {exchanges.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>

            {preview ? (
              <div className="preview-row">
                <span>
                  <span className="sub">Liability</span>{' '}
                  <span className="mono accent">{money(preview.liability, currency)}</span>
                </span>
                <span>
                  <span className="sub">If back wins</span>{' '}
                  <span className={`mono ${preview.ifBackWins < 0 ? 'neg' : 'pos'}`}>
                    {signedMoney(preview.ifBackWins, currency)}
                  </span>
                </span>
                <span>
                  <span className="sub">If lay wins</span>{' '}
                  <span className={`mono ${preview.ifLayWins < 0 ? 'neg' : 'pos'}`}>
                    {signedMoney(preview.ifLayWins, currency)}
                  </span>
                </span>
                <span>
                  <span className="sub">Locked</span>{' '}
                  <span className={`mono ${preview.locked < 0 ? 'neg' : 'pos'}`}>
                    {signedMoney(preview.locked, currency)}
                  </span>
                </span>
              </div>
            ) : (
              <div className="preview-row sub">Fill in both legs to see the locked figure.</div>
            )}

            <div className="form-actions">
              {draft.status !== 'Pending' ? (
                <Field label={`Actual profit (${currency}) — blank uses the locked figure`}>
                  <input
                    type="number"
                    step="0.01"
                    value={draft.profit}
                    onChange={(e) => setDraft({ ...draft, profit: e.target.value })}
                    placeholder={preview ? preview.locked.toFixed(2) : '0.00'}
                  />
                </Field>
              ) : (
                <span />
              )}
              <div className="card-tools">
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setShowForm(false);
                    setEditingId(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn accent sm">
                  {editingId ? 'Save bet' : 'Add bet'}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {filtered.length === 0 ? (
          <div className="empty-state">
            {bets.length === 0 ? 'No bets logged yet.' : 'No bets match those filters.'}
          </div>
        ) : (
          <table className="grid fit">
            <colgroup>
              <col style={{ width: '96px' }} />
              <col style={{ width: '15%' }} />
              <col />
              <col style={{ width: '124px' }} />
              <col style={{ width: '118px' }} />
              <col style={{ width: '92px' }} />
              <col style={{ width: '108px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className="sortable active" onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
                  Date {sortDir === 'asc' ? '↑' : '↓'}
                </th>
                <th>Bookmaker</th>
                <th>Event</th>
                <th className="num">Back</th>
                <th className="num">Lay</th>
                <th className="num">Liability</th>
                <th>Status</th>
                <th className="num">P/L</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((bet) => {
                const settled = isSettled(bet);
                const value = settled ? Number(bet.profit) : Number(bet.expectedProfit);
                return (
                  <tr key={bet.id}>
                    <td className="date-cell muted">{bet.date}</td>
                    <td>
                      <div className="truncate" style={{ fontWeight: 500 }}>
                        {bet.back.bookmaker}
                      </div>
                      <div className="sub truncate">{bet.lay.exchange || '—'}</div>
                    </td>
                    <td title={bet.notes}>
                      <div className="truncate">{bet.event || <span className="muted">—</span>}</div>
                      <div className="sub truncate">{bet.offerType}</div>
                    </td>
                    <td className="num">
                      <div>{money(bet.back.stake, currency)}</div>
                      <div className="sub">@ {bet.back.odds || '—'}</div>
                    </td>
                    <td className="num">
                      <div>{money(bet.lay.stake, currency)}</div>
                      <div className="sub">@ {bet.lay.odds || '—'}</div>
                    </td>
                    <td className="num">{money(bet.lay.liability, currency)}</td>
                    <td>
                      <StatusChip value={bet.status} onClick={() => cycleStatus(bet)} title="Click to advance status" />
                    </td>
                    <td className={`num nowrap ${value < 0 ? 'neg' : 'pos'}`}>
                      {signedMoney(value, currency)}
                      {!settled ? <div className="sub">expected</div> : null}
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button className="btn ghost sm" type="button" onClick={() => startEdit(bet)}>
                          Edit
                        </button>
                        <button
                          className="btn ghost sm danger"
                          type="button"
                          onClick={() => remove(bet.id)}
                          aria-label={`Delete ${bet.back.bookmaker} bet`}
                        >
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
