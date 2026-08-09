import React, { forwardRef, useMemo, useState } from 'react';
import Panel from './Panel.jsx';
import { daysUntil, money, parseNum, uid } from '../lib/format.js';

export const STATUSES = ['To Do', 'In Progress', 'Done'];
const TYPES = ['Sign-up', 'Reload'];

const STATUS_CLASS = {
  'To Do': 'todo',
  'In Progress': 'progress',
  Done: 'done',
};

const STATUS_ORDER = { 'To Do': 0, 'In Progress': 1, Done: 2 };

function emptyOffer() {
  return {
    id: uid(),
    bookmaker: '',
    description: '',
    type: 'Sign-up',
    requirement: '',
    deadline: '',
    expectedProfit: 0,
    status: 'To Do',
    notes: '',
  };
}

/** Deadline cell: shows the date plus an overdue / due-soon marker. */
function DeadlineCell({ deadline, status }) {
  if (!deadline) return <span className="dim">—</span>;
  const days = daysUntil(deadline);
  const settled = status === 'Done';
  let tone = 'dim';
  let suffix = '';
  if (!settled && days !== null) {
    if (days < 0) {
      tone = 'red';
      suffix = ` OVERDUE`;
    } else if (days === 0) {
      tone = 'red';
      suffix = ' TODAY';
    } else if (days <= 7) {
      tone = 'amber';
      suffix = ` ${days}D`;
    }
  }
  return (
    <span className={`nowrap ${tone}`}>
      {deadline}
      {suffix ? <span style={{ fontSize: 9 }}>{suffix}</span> : null}
    </span>
  );
}

const OfferTracker = forwardRef(function OfferTracker({ offers, onChange, currency }, ref) {
  const [draft, setDraft] = useState(emptyOffer);
  const [editingId, setEditingId] = useState(null);
  const [sort, setSort] = useState({ key: 'deadline', dir: 'asc' });
  const [showForm, setShowForm] = useState(false);

  const sorted = useMemo(() => {
    const rows = [...offers];
    const dir = sort.dir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let av;
      let bv;
      switch (sort.key) {
        case 'status':
          av = STATUS_ORDER[a.status] ?? 9;
          bv = STATUS_ORDER[b.status] ?? 9;
          break;
        case 'bookmaker':
          av = (a.bookmaker || '').toLowerCase();
          bv = (b.bookmaker || '').toLowerCase();
          break;
        case 'expectedProfit':
          av = Number(a.expectedProfit) || 0;
          bv = Number(b.expectedProfit) || 0;
          break;
        case 'deadline':
        default:
          // Offers with no deadline sort last regardless of direction.
          av = a.deadline || '9999-12-31';
          bv = b.deadline || '9999-12-31';
          break;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return rows;
  }, [offers, sort]);

  function toggleSort(key) {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }

  function startAdd() {
    setDraft(emptyOffer());
    setEditingId(null);
    setShowForm(true);
  }

  function startEdit(offer) {
    setDraft({ ...offer });
    setEditingId(offer.id);
    setShowForm(true);
  }

  function cancel() {
    setShowForm(false);
    setEditingId(null);
  }

  function submit(event) {
    event.preventDefault();
    const cleaned = {
      ...draft,
      bookmaker: draft.bookmaker.trim() || 'UNNAMED',
      expectedProfit: Number.isFinite(parseNum(draft.expectedProfit)) ? parseNum(draft.expectedProfit) : 0,
    };
    onChange(
      editingId
        ? offers.map((o) => (o.id === editingId ? cleaned : o))
        : [...offers, cleaned],
    );
    cancel();
  }

  function remove(id) {
    onChange(offers.filter((o) => o.id !== id));
    if (editingId === id) cancel();
  }

  function cycleStatus(offer) {
    const next = STATUSES[(STATUSES.indexOf(offer.status) + 1) % STATUSES.length];
    onChange(offers.map((o) => (o.id === offer.id ? { ...o, status: next } : o)));
  }

  const outstanding = offers
    .filter((o) => o.status !== 'Done')
    .reduce((sum, o) => sum + (Number(o.expectedProfit) || 0), 0);

  const sortHeader = (key, label, extraClass = '') => (
    <th
      className={`sortable ${sort.key === key ? 'active' : ''} ${extraClass}`}
      onClick={() => toggleSort(key)}
      title={`Sort by ${label.toLowerCase()}`}
    >
      {label}
      {sort.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <Panel
      ref={ref}
      className="area-offers"
      title="OFFER TRACKER"
      hotkey="F2"
      flush
      tools={
        <>
          <span className="dim" style={{ fontSize: 9 }}>
            PIPELINE {money(outstanding, currency)}
          </span>
          <button className="btn tiny primary" type="button" onClick={startAdd}>
            + ADD OFFER
          </button>
        </>
      }
    >
      {showForm ? (
        <form
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              cancel();
            }
          }}
          style={{ padding: 8, borderBottom: '1px solid var(--border)' }}
        >
          <div className="grid-3">
            <label className="field">
              <span className="field-label">BOOKMAKER</span>
              <input
                autoFocus
                type="text"
                value={draft.bookmaker}
                onChange={(e) => setDraft({ ...draft, bookmaker: e.target.value })}
                placeholder="Sky Bet"
              />
            </label>
            <label className="field">
              <span className="field-label">TYPE</span>
              <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">STATUS</span>
              <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid-3">
            <label className="field">
              <span className="field-label">REQUIREMENT</span>
              <input
                type="text"
                value={draft.requirement}
                onChange={(e) => setDraft({ ...draft, requirement: e.target.value })}
                placeholder="Bet £10 get £10"
              />
            </label>
            <label className="field">
              <span className="field-label">DEADLINE</span>
              <input
                type="date"
                value={draft.deadline}
                onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
              />
            </label>
            <label className="field">
              <span className="field-label">EXPECTED PROFIT ({currency})</span>
              <input
                type="number"
                step="0.01"
                value={draft.expectedProfit}
                onChange={(e) => setDraft({ ...draft, expectedProfit: e.target.value })}
              />
            </label>
          </div>
          <label className="field">
            <span className="field-label">OFFER DESCRIPTION</span>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="New customer offer — qualifying bet at min odds 1.5"
            />
          </label>
          <label className="field">
            <span className="field-label">NOTES</span>
            <input
              type="text"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Free bet credited within 24h"
            />
          </label>
          <div className="panel-tools" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={cancel}>
              CANCEL (ESC)
            </button>
            <button type="submit" className="btn primary">
              {editingId ? 'SAVE CHANGES' : 'ADD OFFER'}
            </button>
          </div>
        </form>
      ) : null}

      {offers.length === 0 ? (
        <div className="empty-state">
          NO OFFERS LOGGED — PRESS <kbd>+ ADD OFFER</kbd> TO START YOUR PIPELINE
        </div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              {sortHeader('bookmaker', 'BOOKMAKER')}
              <th>OFFER / REQUIREMENT</th>
              <th>TYPE</th>
              {sortHeader('deadline', 'DEADLINE')}
              {sortHeader('expectedProfit', 'EXP. PROFIT', 'num')}
              {sortHeader('status', 'STATUS')}
              <th>NOTES</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {sorted.map((offer) => (
              <tr key={offer.id} className={editingId === offer.id ? 'editing' : ''}>
                <td className="amber nowrap">{offer.bookmaker}</td>
                <td>
                  <div>{offer.description || <span className="dim">—</span>}</div>
                  {offer.requirement ? (
                    <div className="dim" style={{ fontSize: 9 }}>
                      {offer.requirement}
                    </div>
                  ) : null}
                </td>
                <td className="dim nowrap">{offer.type}</td>
                <td>
                  <DeadlineCell deadline={offer.deadline} status={offer.status} />
                </td>
                <td className="num">{money(Number(offer.expectedProfit) || 0, currency)}</td>
                <td>
                  <button
                    type="button"
                    className={`badge ${STATUS_CLASS[offer.status] || 'todo'}`}
                    onClick={() => cycleStatus(offer)}
                    title="Click to advance status"
                    style={{ cursor: 'pointer', font: 'inherit' }}
                  >
                    {offer.status.toUpperCase()}
                  </button>
                </td>
                <td className="dim">{offer.notes}</td>
                <td className="nowrap">
                  <button className="btn tiny" type="button" onClick={() => startEdit(offer)}>
                    EDIT
                  </button>{' '}
                  <button className="btn tiny danger" type="button" onClick={() => remove(offer.id)}>
                    DEL
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
});

export default OfferTracker;
