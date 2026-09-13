import React, { useMemo, useState } from 'react';
import Card from '../components/Card.jsx';
import Calendar from '../components/Calendar.jsx';
import ProfitChart from '../components/ProfitChart.jsx';
import { BarList, MoneyStat, Stat } from '../components/ui.jsx';
import { daysUntil, money, monthKey, signedMoney } from '../lib/format.js';
import {
  accountsTotal,
  isSettled,
  nextDue,
  pendingExpected,
  profitBy,
  profitByDay,
  realisedProfit,
  tiedUp,
  totalWithdrawn,
} from '../lib/model.js';

export default function Dashboard({ profile, currency }) {
  const { bets, offers, accounts, withdrawals, settings } = profile;
  const [month, setMonth] = useState(() => monthKey());

  const byDay = useMemo(() => profitByDay(bets), [bets]);

  const stats = useMemo(() => {
    const realised = realisedProfit(bets);
    const thisMonth = [...byDay.entries()]
      .filter(([iso]) => iso.startsWith(month))
      .reduce((sum, [, v]) => sum + v, 0);
    const open = offers.filter((o) => o.status !== 'Done');
    return {
      realised,
      thisMonth,
      pendingBets: pendingExpected(bets),
      // Value still to be earned from offers you have not finished.
      pipeline: open.reduce((sum, o) => sum + (Number(o.expectedProfit) || 0), 0),
      tied: tiedUp(bets),
      withdrawn: totalWithdrawn(withdrawals),
      accountsTotal: accountsTotal(accounts),
      settledCount: bets.filter(isSettled).length,
      openOffers: open.length,
    };
  }, [bets, offers, accounts, withdrawals, byDay, month]);

  const byBookmaker = useMemo(() => profitBy(bets, (b) => b.back.bookmaker), [bets]);
  const byType = useMemo(() => profitBy(bets, (b) => b.offerType), [bets]);

  // Anything outstanding and inside a week, including the next recurrence.
  const dueSoon = useMemo(
    () =>
      offers
        .filter((o) => o.status !== 'Done')
        .map((o) => ({ ...o, due: nextDue(o) }))
        .filter((o) => o.due && daysUntil(o.due) !== null && daysUntil(o.due) <= 7)
        .sort((a, b) => a.due.localeCompare(b.due)),
    [offers],
  );

  return (
    <div className="page">
      <div className="stat-row">
        <MoneyStat label="Profit to date" amount={stats.realised} currency={currency} signed />
        <MoneyStat label="This month" amount={stats.thisMonth} currency={currency} signed />
        <MoneyStat
          label="Bankroll"
          amount={stats.accountsTotal || Number(settings.startingBankroll) + stats.realised}
          currency={currency}
          sub={stats.accountsTotal ? 'across accounts' : 'starting bank + profit'}
        />
        <MoneyStat label="Tied up in open bets" amount={stats.tied} currency={currency} sub={`${bets.length - stats.settledCount} pending`} />
        <MoneyStat label="Withdrawn" amount={stats.withdrawn} currency={currency} sub="banked for good" />
        <Stat
          label="Open offers"
          value={String(stats.openOffers)}
          sub={`${money(stats.pipeline, currency)} in the pipeline`}
        />
      </div>

      <div className="page-grid">
        <Card title="Profit calendar" titleSize="sm">
          <Calendar month={month} onMonthChange={setMonth} byDay={byDay} currency={currency} />
        </Card>

        <Card title="Cumulative profit" titleSize="sm">
          <ProfitChart
            bets={bets}
            startingBankroll={Number(settings.startingBankroll) || 0}
            currency={currency}
            height={220}
          />
        </Card>
      </div>

      <div className="page-grid-3">
        <Card title="Profit by bookmaker" titleSize="sm">
          <BarList rows={byBookmaker} currency={currency} empty="Settle a bet to see a breakdown." />
        </Card>

        <Card title="Profit by offer type" titleSize="sm">
          <BarList rows={byType} currency={currency} empty="Settle a bet to see a breakdown." />
        </Card>

        <Card title="Due in the next 7 days" titleSize="sm" bodyClassName="flush">
          {dueSoon.length === 0 ? (
            <div className="empty-state">Nothing due soon.</div>
          ) : (
            <div style={{ padding: '0 4px' }}>
              {dueSoon.map((offer) => {
                const days = daysUntil(offer.due);
                return (
                  <div className="listrow" key={offer.id}>
                    <span className="avatar">{(offer.bookmaker || '?').slice(0, 2)}</span>
                    <div className="listrow-main">
                      <div className="listrow-name">{offer.bookmaker}</div>
                      <div className="sub truncate">{offer.requirement || offer.type}</div>
                    </div>
                    <div className="listrow-right">
                      <div className="mono">{money(Number(offer.expectedProfit) || 0, currency)}</div>
                      <div className={`sub ${days < 0 ? 'neg' : 'accent'}`}>
                        {days < 0 ? `${Math.abs(days)}d late` : days === 0 ? 'today' : `${days}d`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
