import React, { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import { Field, StatusChip } from '../components/ui.jsx';
import { OFFER_STATUSES, OFFER_TYPES, RECURRENCE, nextDue } from '../lib/model.js';
import { daysUntil, money, parseNum, uid } from '../lib/format.js';

const STATUS_ORDER = { 'To Do': 0, 'In Progress': 1, Done: 2 };

function emptyOffer() {
  return {
    id: uid(),
    bookmaker: '',
    description: '',
    type: 'Qualifying bet',
    requirement: '',
    deadline: '',
    expectedProfit: '',
    status: 'To Do',
    recurrence: 'None',
    notes: '',
  };
}

function DueCell({ offer }) {
  const due = nextDue(offer);
  if (!due) return <span className="muted">—</span>;
  const days = daysUntil(due);
  const settled = offer.status === 'Done';
  let tone = 'muted';
  let suffix = '';
  if (!settled && days !== null) {
    if (days < 0) {
      tone = 'neg';
      suffix = `${Math.abs(days)}d late`;
    } else if (days === 0) {
      tone = 'neg';
      suffix = 'today';
    } else if (days <= 7) {
      tone = 'accent';
      suffix = `${days}d`;
    }
  }
  return (
    <div>
      <div className="date-cell">{due}</div>
      {suffix ? <div className={`sub ${tone}`}>{suffix}</div> : null}
      {offer.recurrence !== 'None' ? <div className="sub">{offer.recurrence.toLowerCase()}</div> : null}
    </div>
  );
}

export default function Offers({ profile, currency, onChange }) {
  const { offers, accounts } = profile;
  const [draft, setDraft] = useState(emptyOffer);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');
  const [hideDone, setHideDone] = useState(false);
  const [sort, setSort] = useState({ key: 'deadline', dir: 'asc' });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = offers
      .filter((o) => (hideDone ? o.status !== 'Done' : true))
      .filter((o) =>
        q === ''
          ? true
          : [o.bookmaker, o.description, o.requirement, o.type, o.notes].join(' ').toLowerCase().includes(q),
      );
    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
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
        default:
          // Offers with no deadline sort last regardless of direction.
          av = nextDue(a) || '9999-12-31';
          bv = nextDue(b) || '9999-12-31';
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [offers, query, hideDone, sort]);

  const pipeline = offers
    .filter((o) => o.status !== 'Done')
    .reduce((sum, o) => sum + (Number(o.expectedProfit) || 0), 0);

  function submit(event) {
    event.preventDefault();
    const cleaned = {
      ...draft,
      bookmaker: draft.bookmaker.trim() || 'Unnamed',
      expectedProfit: parseNum(draft.expectedProfit) || 0,
    };
    onChange(editingId ? offers.map((o) => (o.id === editingId ? cleaned : o)) : [...offers, cleaned]);
    setShowForm(false);
    setEditingId(null);
  }

  function cycleStatus(offer) {
    const next = OFFER_STATUSES[(OFFER_STATUSES.indexOf(offer.status) + 1) % OFFER_STATUSES.length];
    onChange(offers.map((o) => (o.id === offer.id ? { ...o, status: next } : o)));
  }

  const sortHeader = (key, label, cls = '') => (
    <th
      className={`sortable ${sort.key === key ? 'active' : ''} ${cls}`}
      onClick={() => setSort((p) => (p.key === key ? { key, dir: p.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))}
    >
      {label}
      {sort.key === key ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  return (
    <div className="page">
      <Card
        title="Offer tracker"
        hotkey="F3"
        bodyClassName="flush"
        tools={
          <>
            <span className="sub nowrap">
              Pipeline <span className="mono pos">{money(pipeline, currency)}</span>
            </span>
            <button
              className="btn accent sm"
              type="button"
              onClick={() => {
                setDraft(emptyOffer());
                setEditingId(null);
                setShowForm(true);
              }}
            >
              Add offer
            </button>
          </>
        }
      >
        <div className="filterbar">
          <input
            type="text"
            className="search"
            placeholder="Search offers…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search offers"
          />
          <button className="btn sm" type="button" onClick={() => setHideDone((v) => !v)} aria-pressed={hideDone}>
            {hideDone ? 'Showing outstanding' : 'Show all'}
          </button>
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
            <div className="grid-4">
              <Field label="Bookmaker">
                <input
                  autoFocus
                  type="text"
                  list="offer-bookmakers"
                  value={draft.bookmaker}
                  onChange={(e) => setDraft({ ...draft, bookmaker: e.target.value })}
                  placeholder="Sky Bet"
                />
              </Field>
              <Field label="Offer type">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                  {OFFER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {OFFER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Repeats">
                <select value={draft.recurrence} onChange={(e) => setDraft({ ...draft, recurrence: e.target.value })}>
                  {RECURRENCE.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid-4" style={{ marginTop: 8 }}>
              <Field label="Requirement">
                <input
                  type="text"
                  value={draft.requirement}
                  onChange={(e) => setDraft({ ...draft, requirement: e.target.value })}
                  placeholder="Bet £10 get £30"
                />
              </Field>
              <Field label="Deadline">
                <input type="date" value={draft.deadline} onChange={(e) => setDraft({ ...draft, deadline: e.target.value })} />
              </Field>
              <Field label={`Expected profit (${currency})`}>
                <input
                  type="number"
                  step="0.01"
                  value={draft.expectedProfit}
                  onChange={(e) => setDraft({ ...draft, expectedProfit: e.target.value })}
                />
              </Field>
              <Field label="Description">
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="New customer offer, min odds 1.5"
                />
              </Field>
            </div>
            <Field label="Notes">
              <input
                type="text"
                value={draft.notes}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                placeholder="Free bet credited within 24h"
              />
            </Field>
            <datalist id="offer-bookmakers">
              {accounts.map((a) => (
                <option key={a.id} value={a.name} />
              ))}
            </datalist>
            <div className="form-actions">
              <span />
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
                  {editingId ? 'Save changes' : 'Add offer'}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {filtered.length === 0 ? (
          <div className="empty-state">
            {offers.length === 0 ? 'No offers yet — add one to start your pipeline.' : 'No offers match that search.'}
          </div>
        ) : (
          <table className="grid fit">
            <colgroup>
              <col style={{ width: '150px' }} />
              <col />
              <col style={{ width: '150px' }} />
              <col style={{ width: '104px' }} />
              <col style={{ width: '86px' }} />
              <col style={{ width: '124px' }} />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr>
                {sortHeader('bookmaker', 'Bookmaker')}
                <th>Offer</th>
                <th>Notes</th>
                {sortHeader('deadline', 'Due')}
                {sortHeader('expectedProfit', 'Profit', 'num')}
                {sortHeader('status', 'Status')}
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((offer) => (
                <tr key={offer.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="avatar">{(offer.bookmaker || '?').slice(0, 2)}</span>
                      <span className="truncate" style={{ fontWeight: 500 }}>
                        {offer.bookmaker}
                      </span>
                    </div>
                  </td>
                  <td title={[offer.description, offer.requirement].filter(Boolean).join(' · ')}>
                    <div className="truncate">{offer.description || <span className="muted">—</span>}</div>
                    <div className="sub truncate">
                      {offer.type}
                      {offer.requirement ? ` · ${offer.requirement}` : ''}
                    </div>
                  </td>
                  <td className="muted truncate" title={offer.notes}>
                    {offer.notes || '—'}
                  </td>
                  <td>
                    <DueCell offer={offer} />
                  </td>
                  <td className="num">{money(Number(offer.expectedProfit) || 0, currency)}</td>
                  <td>
                    <StatusChip value={offer.status} onClick={() => cycleStatus(offer)} title="Click to advance status" />
                  </td>
                  <td>
                    <div className="cell-actions">
                      <button
                        className="btn ghost sm"
                        type="button"
                        onClick={() => {
                          setDraft({ ...offer, expectedProfit: String(offer.expectedProfit ?? '') });
                          setEditingId(offer.id);
                          setShowForm(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn ghost sm danger"
                        type="button"
                        onClick={() => onChange(offers.filter((o) => o.id !== offer.id))}
                        aria-label={`Delete ${offer.bookmaker} offer`}
                      >
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
