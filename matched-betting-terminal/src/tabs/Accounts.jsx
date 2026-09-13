import React, { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import { Field, MoneyStat, Stat, StatusChip } from '../components/ui.jsx';
import { ACCOUNT_STATUSES, ACCOUNT_TYPES, accountsTotal, isSettled, tiedUp, totalWithdrawn } from '../lib/model.js';
import { money, parseNum, today, uid } from '../lib/format.js';

const emptyAccount = () => ({
  id: uid(),
  name: '',
  type: 'Bookmaker',
  balance: '',
  status: 'Active',
  commission: 0.02,
  notes: '',
});

const emptyWithdrawal = () => ({ id: uid(), date: today(), amount: '', from: '', notes: '' });

export default function Accounts({ profile, currency, onAccountsChange, onWithdrawalsChange }) {
  const { accounts, withdrawals, bets } = profile;
  const [draft, setDraft] = useState(emptyAccount);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [wDraft, setWDraft] = useState(emptyWithdrawal);

  const totals = useMemo(
    () => ({
      bookmakers: accountsTotal(accounts, 'Bookmaker'),
      exchanges: accountsTotal(accounts, 'Exchange'),
      all: accountsTotal(accounts),
      tied: tiedUp(bets),
      withdrawn: totalWithdrawn(withdrawals),
      restricted: accounts.filter((a) => a.status === 'Gubbed' || a.status === 'Limited').length,
    }),
    [accounts, bets, withdrawals],
  );

  /** Open bets per account, so you can see exactly what is stuck where. */
  const stuckBy = useMemo(() => {
    const map = new Map();
    bets
      .filter((b) => !isSettled(b))
      .forEach((b) => {
        if (b.back.bookmaker) map.set(b.back.bookmaker, (map.get(b.back.bookmaker) || 0) + Number(b.back.stake || 0));
        if (b.lay.exchange) map.set(b.lay.exchange, (map.get(b.lay.exchange) || 0) + Number(b.lay.liability || 0));
      });
    return map;
  }, [bets]);

  function submit(event) {
    event.preventDefault();
    const cleaned = {
      ...draft,
      name: draft.name.trim() || 'Unnamed',
      balance: parseNum(draft.balance) || 0,
      commission: Number(draft.commission) || 0,
    };
    onAccountsChange(
      editingId ? accounts.map((a) => (a.id === editingId ? cleaned : a)) : [...accounts, cleaned],
    );
    setShowForm(false);
    setEditingId(null);
  }

  function cycleStatus(account) {
    const next = ACCOUNT_STATUSES[(ACCOUNT_STATUSES.indexOf(account.status) + 1) % ACCOUNT_STATUSES.length];
    onAccountsChange(accounts.map((a) => (a.id === account.id ? { ...a, status: next } : a)));
  }

  function addWithdrawal(event) {
    event.preventDefault();
    const amount = parseNum(wDraft.amount);
    if (!Number.isFinite(amount) || amount === 0) return;
    onWithdrawalsChange([...withdrawals, { ...wDraft, amount, date: wDraft.date || today() }]);
    setWDraft(emptyWithdrawal());
  }

  return (
    <div className="page">
      <div className="stat-row">
        <MoneyStat label="Total bankroll" amount={totals.all} currency={currency} sub="across all accounts" />
        <MoneyStat label="At bookmakers" amount={totals.bookmakers} currency={currency} />
        <MoneyStat label="At exchanges" amount={totals.exchanges} currency={currency} />
        <MoneyStat label="Tied up in open bets" amount={totals.tied} currency={currency} sub="stake + liability" />
        <MoneyStat label="Withdrawn" amount={totals.withdrawn} currency={currency} />
        <Stat
          label="Restricted accounts"
          value={String(totals.restricted)}
          tone={totals.restricted > 0 ? 'neg' : ''}
          sub="limited or gubbed"
        />
      </div>

      <Card
        title="Accounts"
        hotkey="F5"
        bodyClassName="flush"
        tools={
          <button
            className="btn accent sm"
            type="button"
            onClick={() => {
              setDraft(emptyAccount());
              setEditingId(null);
              setShowForm(true);
            }}
          >
            Add account
          </button>
        }
      >
        {showForm ? (
          <form
            className="entry-form"
            onSubmit={submit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.stopPropagation();
                setShowForm(false);
              }
            }}
          >
            <div className="grid-4">
              <Field label="Name">
                <input autoFocus type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Sky Bet" />
              </Field>
              <Field label="Type">
                <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value })}>
                  {ACCOUNT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Balance (${currency})`}>
                <input type="number" step="0.01" value={draft.balance} onChange={(e) => setDraft({ ...draft, balance: e.target.value })} />
              </Field>
              <Field label="Status">
                <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {ACCOUNT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid-2" style={{ marginTop: 8 }}>
              {draft.type === 'Exchange' ? (
                <Field label="Commission (%)">
                  <input
                    type="number"
                    step="0.1"
                    value={(Number(draft.commission) * 100).toFixed(2).replace(/\.?0+$/, '') || '0'}
                    onChange={(e) => {
                      const pct = parseNum(e.target.value);
                      if (Number.isFinite(pct) && pct >= 0 && pct < 100) setDraft({ ...draft, commission: pct / 100 });
                    }}
                  />
                </Field>
              ) : (
                <span />
              )}
              <Field label="Notes">
                <input
                  type="text"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                  placeholder="Gubbed after 3 offers — casino only"
                />
              </Field>
            </div>
            <div className="form-actions">
              <span />
              <div className="card-tools">
                <button type="button" className="btn sm" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn accent sm">
                  {editingId ? 'Save account' : 'Add account'}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {accounts.length === 0 ? (
          <div className="empty-state">No accounts yet — add your bookmakers and exchanges to track balances.</div>
        ) : (
          <table className="grid fit">
            <colgroup>
              <col style={{ width: '200px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '110px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '116px' }} />
              <col />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Account</th>
                <th>Type</th>
                <th className="num">Balance</th>
                <th className="num">Tied up</th>
                <th>Status</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const stuck = stuckBy.get(account.name) || 0;
                return (
                  <tr key={account.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="avatar">{(account.name || '?').slice(0, 2)}</span>
                        <span className="truncate" style={{ fontWeight: 500 }}>
                          {account.name}
                        </span>
                      </div>
                    </td>
                    <td className="muted">
                      {account.type}
                      {account.type === 'Exchange' ? (
                        <div className="sub">{(account.commission * 100).toFixed(1)}%</div>
                      ) : null}
                    </td>
                    <td className="num">{money(account.balance, currency)}</td>
                    <td className={`num ${stuck > 0 ? 'accent' : 'muted'}`}>
                      {stuck > 0 ? money(stuck, currency) : '—'}
                    </td>
                    <td>
                      <StatusChip value={account.status} onClick={() => cycleStatus(account)} title="Click to change status" />
                    </td>
                    <td className="muted truncate" title={account.notes}>
                      {account.notes || '—'}
                    </td>
                    <td>
                      <div className="cell-actions">
                        <button
                          className="btn ghost sm"
                          type="button"
                          onClick={() => {
                            setDraft({ ...account, balance: String(account.balance ?? '') });
                            setEditingId(account.id);
                            setShowForm(true);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn ghost sm danger"
                          type="button"
                          onClick={() => onAccountsChange(accounts.filter((a) => a.id !== account.id))}
                          aria-label={`Delete ${account.name}`}
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

      <Card title="Withdrawals" titleSize="sm" bodyClassName="flush">
        <form className="entry-form" onSubmit={addWithdrawal}>
          <div className="grid-4">
            <Field label="Date">
              <input type="date" value={wDraft.date} onChange={(e) => setWDraft({ ...wDraft, date: e.target.value })} />
            </Field>
            <Field label={`Amount (${currency})`}>
              <input type="number" step="0.01" value={wDraft.amount} onChange={(e) => setWDraft({ ...wDraft, amount: e.target.value })} placeholder="100.00" />
            </Field>
            <Field label="From">
              <input type="text" list="withdraw-accounts" value={wDraft.from} onChange={(e) => setWDraft({ ...wDraft, from: e.target.value })} placeholder="Smarkets" />
            </Field>
            <Field label="Notes">
              <input type="text" value={wDraft.notes} onChange={(e) => setWDraft({ ...wDraft, notes: e.target.value })} />
            </Field>
          </div>
          <datalist id="withdraw-accounts">
            {accounts.map((a) => (
              <option key={a.id} value={a.name} />
            ))}
          </datalist>
          <div className="form-actions">
            <span className="sub">Withdrawals are money banked for good — they leave the bankroll total.</span>
            <button type="submit" className="btn accent sm">
              Record withdrawal
            </button>
          </div>
        </form>

        {withdrawals.length === 0 ? (
          <div className="empty-state">Nothing withdrawn yet.</div>
        ) : (
          <table className="grid fit">
            <colgroup>
              <col style={{ width: '110px' }} />
              <col style={{ width: '120px' }} />
              <col style={{ width: '180px' }} />
              <col />
              <col style={{ width: '80px' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Date</th>
                <th className="num">Amount</th>
                <th>From</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {[...withdrawals]
                .sort((a, b) => String(b.date).localeCompare(String(a.date)))
                .map((w) => (
                  <tr key={w.id}>
                    <td className="date-cell muted">{w.date}</td>
                    <td className="num pos">{money(w.amount, currency)}</td>
                    <td className="truncate">{w.from || '—'}</td>
                    <td className="muted truncate">{w.notes || '—'}</td>
                    <td>
                      <div className="cell-actions">
                        <button
                          className="btn ghost sm danger"
                          type="button"
                          onClick={() => onWithdrawalsChange(withdrawals.filter((x) => x.id !== w.id))}
                          aria-label="Delete withdrawal"
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
