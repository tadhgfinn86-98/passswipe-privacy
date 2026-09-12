"""House Desk — the engine that always works.

Every other engine needs a key: an LLM provider, a data vendor, an exchange.
That makes them useless for a first run, a demo, an offline laptop, or a
regression test. This one needs nothing. It runs a real multi-strategy ensemble
over the real pinned daily tape that ships with ai-market-maker (19 crypto
pairs, ~3.4 years of daily bars, sha256-manifested), with no network and no
LLM anywhere in the path.

That makes it two useful things at once:

  * a working fund on day one, before any key is configured, and
  * the null hypothesis. The LLM engines cost money per cycle and are the
    interesting claim; this is plain momentum, mean-reversion and trend voting
    against the same tape. If an agent swarm can't beat it, that's the most
    valuable number this app can show you.

Deliberately simple and fully deterministic: same date in, same book out. No
randomness, no lookahead — every indicator reads bars strictly before `as_of`.
"""
from __future__ import annotations

import csv
import math
from bisect import bisect_right
from datetime import date, datetime, timezone
from functools import lru_cache
from pathlib import Path

from .. import config
from ..schema import (
    AssetClass,
    Availability,
    BacktestMetrics,
    BacktestRequest,
    BacktestResult,
    CycleRequest,
    Direction,
    EngineInfo,
    EquityPoint,
    FundCycle,
    Order,
    Requirement,
    RiskEvent,
    Signal,
    StrategySlice,
    TickerSkip,
)

ENGINE_ID = "house"

# Risk limits. Deliberately tight — this book is a baseline, not a bet.
MAX_WEIGHT_PER_NAME = 0.25
MAX_GROSS_EXPOSURE = 1.0
MIN_BARS_REQUIRED = 60


class Bar:
    __slots__ = ("day", "open", "high", "low", "close", "volume")

    def __init__(self, day: date, o: float, h: float, l: float, c: float, v: float):
        self.day = day
        self.open = o
        self.high = h
        self.low = l
        self.close = c
        self.volume = v


@lru_cache(maxsize=64)
def _load_series(symbol: str) -> tuple[Bar, ...]:
    """Load one symbol's daily bars from the pinned tape.

    Cached because a backtest asks for the same series once per simulated day
    and re-reading a 1,200-row CSV a thousand times is the difference between
    a snappy curve and a spinner.
    """
    path = config.OHLCV_DIR / f"{symbol}_1d.csv"
    if not path.exists():
        return ()
    bars: list[Bar] = []
    with path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            try:
                ts = int(row["timestamp_ms"]) / 1000
                bars.append(
                    Bar(
                        datetime.fromtimestamp(ts, tz=timezone.utc).date(),
                        float(row["open"]),
                        float(row["high"]),
                        float(row["low"]),
                        float(row["close"]),
                        float(row["volume"]),
                    )
                )
            except (KeyError, ValueError):
                continue  # a malformed row is not worth failing a whole cycle over
    bars.sort(key=lambda b: b.day)
    return tuple(bars)


def available_symbols() -> list[str]:
    if not config.OHLCV_DIR.exists():
        return []
    return sorted(p.name[: -len("_1d.csv")] for p in config.OHLCV_DIR.glob("*_1d.csv"))


def _bars_before(symbol: str, as_of: date) -> tuple[Bar, ...]:
    """Bars strictly before `as_of` — the lookahead guard.

    Every indicator in this module goes through here. Slicing on the caller's
    side is how backtests quietly start trading on the close they're predicting.
    """
    series = _load_series(symbol)
    if not series:
        return ()
    cut = bisect_right([b.day for b in series], as_of - _one_day())
    return series[:cut]


def _one_day():
    from datetime import timedelta

    return timedelta(days=1)


def _sma(values: list[float], window: int) -> float | None:
    if len(values) < window:
        return None
    return sum(values[-window:]) / window


def _stdev(values: list[float]) -> float | None:
    if len(values) < 2:
        return None
    mean = sum(values) / len(values)
    var = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(var)


def _rsi(closes: list[float], window: int = 14) -> float | None:
    if len(closes) <= window:
        return None
    gains, losses = [], []
    for prev, cur in zip(closes[-window - 1 : -1], closes[-window:]):
        change = cur - prev
        gains.append(max(change, 0.0))
        losses.append(max(-change, 0.0))
    avg_gain = sum(gains) / window
    avg_loss = sum(losses) / window
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def _signal(author: str, ticker: str, score: float, rationale: str) -> Signal:
    """Turn a score in [-1, 1] into a normalized signal."""
    if score > 0.1:
        direction = Direction.BULLISH
    elif score < -0.1:
        direction = Direction.BEARISH
    else:
        direction = Direction.NEUTRAL
    return Signal(
        author=author,
        ticker=ticker,
        direction=direction,
        confidence=min(abs(score), 1.0),
        rationale=rationale,
    )


def _trend_strategy(symbol: str, bars: tuple[Bar, ...]) -> tuple[Signal, float]:
    """Golden/death cross on 20 vs 50 day, scaled by separation."""
    closes = [b.close for b in bars]
    fast, slow = _sma(closes, 20), _sma(closes, 50)
    if fast is None or slow is None:
        return _signal("trend_follower", symbol, 0.0, "insufficient history"), 0.0
    spread = (fast - slow) / slow if slow else 0.0
    score = max(-1.0, min(1.0, spread * 12))
    side = "above" if spread > 0 else "below"
    return (
        _signal(
            "trend_follower",
            symbol,
            score,
            f"SMA20 {side} SMA50 by {spread * 100:.2f}% "
            f"({fast:.4f} vs {slow:.4f})",
        ),
        score,
    )


def _momentum_strategy(symbol: str, bars: tuple[Bar, ...]) -> tuple[Signal, float]:
    """60-day total return, risk-adjusted by realized vol."""
    closes = [b.close for b in bars]
    if len(closes) < MIN_BARS_REQUIRED:
        return _signal("momentum", symbol, 0.0, "insufficient history"), 0.0
    ret = (closes[-1] - closes[-60]) / closes[-60]
    daily = [
        (closes[i] - closes[i - 1]) / closes[i - 1]
        for i in range(len(closes) - 60, len(closes))
        if closes[i - 1]
    ]
    vol = (_stdev(daily) or 0.0) * math.sqrt(365)
    adjusted = ret / vol if vol > 0.05 else ret
    score = max(-1.0, min(1.0, adjusted))
    return (
        _signal(
            "momentum",
            symbol,
            score,
            f"60d return {ret * 100:+.1f}% at {vol * 100:.0f}% annualized vol",
        ),
        score,
    )


def _mean_reversion_strategy(symbol: str, bars: tuple[Bar, ...]) -> tuple[Signal, float]:
    """Fade RSI extremes — inverted, so oversold reads bullish."""
    closes = [b.close for b in bars]
    rsi = _rsi(closes)
    if rsi is None:
        return _signal("mean_reversion", symbol, 0.0, "insufficient history"), 0.0
    score = max(-1.0, min(1.0, (50 - rsi) / 25))
    state = "oversold" if rsi < 35 else "overbought" if rsi > 65 else "neutral"
    return (
        _signal("mean_reversion", symbol, score, f"RSI(14) at {rsi:.1f} — {state}"),
        score,
    )


STRATEGIES = {
    "trend": (_trend_strategy, 0.4),
    "momentum": (_momentum_strategy, 0.35),
    "mean_reversion": (_mean_reversion_strategy, 0.25),
}


class HouseEngine:
    """Deterministic multi-strategy ensemble over the pinned tape."""

    def info(self) -> EngineInfo:
        return EngineInfo(
            id=ENGINE_ID,
            name="House Desk",
            asset_class=AssetClass.CRYPTO,
            summary=(
                "Deterministic trend / momentum / mean-reversion ensemble over the "
                "pinned daily tape. No API keys, no network, no LLM — runs offline "
                "and serves as the baseline the agent engines have to beat."
            ),
            upstream="(this app) — tape from olaxbt/ai-market-maker",
            license="MIT",
        )

    def preflight(self) -> Availability:
        symbols = available_symbols()
        requirement = Requirement(
            key="pinned OHLCV tape",
            purpose="daily bars for the ensemble",
            kind="data",
            satisfied=bool(symbols),
        )
        if symbols:
            return Availability(
                engine=ENGINE_ID,
                ready=True,
                installed=True,
                detail=f"{len(symbols)} symbols on the pinned tape",
            )
        return Availability(
            engine=ENGINE_ID,
            ready=False,
            installed=False,
            missing=[requirement],
            detail=(
                "Pinned tape not found. Run scripts/setup.py to fetch engines "
                "(the tape ships inside ai-market-maker)."
            ),
        )

    def _resolve_universe(self, requested: list[str]) -> list[str]:
        symbols = available_symbols()
        if not requested:
            # A sane default book rather than all 19 — enough names to
            # diversify, few enough to read on one screen.
            preferred = ["BTC_USDT", "ETH_USDT", "SOL_USDT", "BNB_USDT", "XRP_USDT"]
            return [s for s in preferred if s in symbols] or symbols[:5]
        return [s.upper().replace("/", "_").replace("-", "_") for s in requested]

    def run_cycle(self, request: CycleRequest) -> FundCycle:
        ready = self.preflight()
        as_of_str = request.as_of or date.today().isoformat()
        cycle = FundCycle(
            engine=ENGINE_ID,
            fund=request.fund or "House Desk",
            as_of=as_of_str,
            equity_before=request.capital,
            cash=request.capital,
            nav=request.capital,
        )
        if not ready.ready:
            cycle.errors.append(ready.detail)
            return cycle

        as_of = date.fromisoformat(as_of_str)
        universe = self._resolve_universe(request.universe)
        cycle.universe = universe

        known = set(available_symbols())
        tradeable: list[str] = []
        for symbol in universe:
            if symbol not in known:
                cycle.skipped.append(
                    TickerSkip(ticker=symbol, reason="not on the pinned tape")
                )
                continue
            bars = _bars_before(symbol, as_of)
            if len(bars) < MIN_BARS_REQUIRED:
                cycle.skipped.append(
                    TickerSkip(
                        ticker=symbol,
                        reason=f"only {len(bars)} bars before {as_of_str}, "
                        f"need {MIN_BARS_REQUIRED}",
                    )
                )
                continue
            tradeable.append(symbol)
            cycle.marks[symbol] = bars[-1].close

        if not tradeable:
            cycle.errors.append(
                f"No tradeable names as of {as_of_str} — the pinned tape may not "
                "cover this date."
            )
            return cycle

        # Each strategy forms views independently, then gets a fixed slice.
        blended: dict[str, float] = {t: 0.0 for t in tradeable}
        for name, (fn, slice_weight) in STRATEGIES.items():
            signals, convictions = [], {}
            for symbol in tradeable:
                signal, score = fn(symbol, _bars_before(symbol, as_of))
                signals.append(signal)
                convictions[symbol] = score
            sleeve = self._weights_from_convictions(convictions)
            cycle.strategies.append(
                StrategySlice(
                    name=name,
                    slice=slice_weight,
                    signals=signals,
                    convictions=convictions,
                    weights=sleeve,
                )
            )
            for symbol, weight in sleeve.items():
                blended[symbol] += weight * slice_weight

        cycle.target_weights = {k: round(v, 6) for k, v in blended.items() if abs(v) > 1e-6}
        cycle.final_weights, cycle.risk_events = self._apply_risk(cycle.target_weights)

        # Turn the surviving book into orders against an all-cash start.
        cash = request.capital
        for symbol, weight in sorted(cycle.final_weights.items()):
            mark = cycle.marks.get(symbol)
            if not mark or weight <= 0:
                continue
            notional = request.capital * weight
            quantity = notional / mark
            cycle.orders.append(
                Order(
                    ticker=symbol,
                    side="buy",
                    quantity=round(quantity, 8),
                    limit_price=mark,
                    notional=round(notional, 2),
                )
            )
            cycle.positions[symbol] = round(quantity, 8)
            cash -= notional

        cycle.cash = round(cash, 2)
        cycle.nav = round(
            cash + sum(q * cycle.marks[t] for t, q in cycle.positions.items()), 2
        )
        cycle.meta = {
            "strategies": list(STRATEGIES),
            "deterministic": True,
            "llm_calls": 0,
            "network_calls": 0,
        }
        return cycle

    def _weights_from_convictions(self, convictions: dict[str, float]) -> dict[str, float]:
        """Long-only, conviction-proportional. Negative views size to zero
        rather than short — the pinned tape is spot, and a baseline that can
        short is a different (and much stronger) claim than this one makes."""
        longs = {t: s for t, s in convictions.items() if s > 0}
        total = sum(longs.values())
        if not total:
            return {}
        return {t: s / total for t, s in longs.items()}

    def _apply_risk(
        self, target: dict[str, float]
    ) -> tuple[dict[str, float], list[RiskEvent]]:
        events: list[RiskEvent] = []
        final = dict(target)

        for symbol, weight in list(final.items()):
            if weight > MAX_WEIGHT_PER_NAME:
                events.append(
                    RiskEvent(
                        kind="clamp",
                        scope=symbol,
                        reason=f"single-name cap {MAX_WEIGHT_PER_NAME:.0%}",
                        before=round(weight, 6),
                        after=MAX_WEIGHT_PER_NAME,
                    )
                )
                final[symbol] = MAX_WEIGHT_PER_NAME

        gross = sum(final.values())
        if gross > MAX_GROSS_EXPOSURE:
            scale = MAX_GROSS_EXPOSURE / gross
            events.append(
                RiskEvent(
                    kind="clamp",
                    scope="book",
                    reason=f"gross exposure cap {MAX_GROSS_EXPOSURE:.0%}",
                    before=round(gross, 6),
                    after=MAX_GROSS_EXPOSURE,
                )
            )
            final = {t: w * scale for t, w in final.items()}

        return {t: round(w, 6) for t, w in final.items()}, events

    def backtest(self, request: BacktestRequest) -> BacktestResult:
        """Walk the tape, rebalancing on a fixed cadence.

        Benchmarked against equal-weight buy-and-hold of the same universe —
        the honest comparison, since beating cash is not an achievement in a
        market that tripled.
        """
        result = BacktestResult(
            engine=ENGINE_ID,
            fund=request.fund or "House Desk",
            start=request.start,
            end=request.end,
        )
        ready = self.preflight()
        if not ready.ready:
            result.errors.append(ready.detail)
            return result

        start, end = date.fromisoformat(request.start), date.fromisoformat(request.end)
        if start >= end:
            result.errors.append("start date must be before end date")
            return result

        universe = self._resolve_universe(request.universe)
        rebalance_days = int(request.options.get("rebalance_days", 7))

        trading_days = self._trading_days(universe, start, end)
        if not trading_days:
            result.errors.append(
                f"Pinned tape has no bars between {request.start} and {request.end}."
            )
            return result

        cash = request.capital
        positions: dict[str, float] = {}
        bench_units: dict[str, float] = {}
        last_rebalance: date | None = None

        for day in trading_days:
            marks = {}
            for symbol in universe:
                bars = _bars_before(symbol, day)
                if bars:
                    marks[symbol] = bars[-1].close
            if not marks:
                continue

            if not bench_units:
                each = request.capital / len(marks)
                bench_units = {t: each / p for t, p in marks.items()}

            due = last_rebalance is None or (day - last_rebalance).days >= rebalance_days
            if due:
                nav = cash + sum(q * marks.get(t, 0.0) for t, q in positions.items())
                cycle = self.run_cycle(
                    CycleRequest(
                        engine=ENGINE_ID,
                        universe=universe,
                        as_of=day.isoformat(),
                        capital=nav,
                        fund=result.fund,
                    )
                )
                if cycle.final_weights:
                    positions = {}
                    cash = nav
                    for symbol, weight in cycle.final_weights.items():
                        price = marks.get(symbol)
                        if not price:
                            continue
                        notional = nav * weight
                        positions[symbol] = notional / price
                        cash -= notional
                    last_rebalance = day
                    result.cycles.append(cycle)

            nav = cash + sum(q * marks.get(t, 0.0) for t, q in positions.items())
            bench = sum(q * marks.get(t, 0.0) for t, q in bench_units.items())
            result.curve.append(
                EquityPoint(date=day.isoformat(), nav=round(nav, 2), benchmark=round(bench, 2))
            )

        result.metrics = self._metrics(result.curve, request.capital)
        result.meta = {
            "rebalance_days": rebalance_days,
            "universe": universe,
            "rebalances": len(result.cycles),
            "benchmark": "equal-weight buy and hold",
        }
        # Cycles are kept for the UI's drill-down but they're heavy; a long
        # backtest would otherwise ship thousands of full records to the browser.
        if len(result.cycles) > 12:
            result.cycles = result.cycles[-12:]
        return result

    def _trading_days(self, universe: list[str], start: date, end: date) -> list[date]:
        days: set[date] = set()
        for symbol in universe:
            for bar in _load_series(symbol):
                if start <= bar.day <= end:
                    days.add(bar.day)
        return sorted(days)

    def _metrics(self, curve: list[EquityPoint], capital: float) -> BacktestMetrics:
        if len(curve) < 2:
            return BacktestMetrics()
        navs = [p.nav for p in curve]
        total = (navs[-1] - capital) / capital

        span_days = (
            date.fromisoformat(curve[-1].date) - date.fromisoformat(curve[0].date)
        ).days or 1
        years = span_days / 365.25
        cagr = (navs[-1] / capital) ** (1 / years) - 1 if years > 0 and navs[-1] > 0 else None

        rets = [
            (navs[i] - navs[i - 1]) / navs[i - 1]
            for i in range(1, len(navs))
            if navs[i - 1]
        ]
        sharpe = None
        if rets:
            sd = _stdev(rets)
            if sd:
                sharpe = (sum(rets) / len(rets)) / sd * math.sqrt(365)

        peak, max_dd = navs[0], 0.0
        for nav in navs:
            peak = max(peak, nav)
            if peak:
                max_dd = min(max_dd, (nav - peak) / peak)

        bench_return = None
        if curve[0].benchmark and curve[-1].benchmark:
            bench_return = (curve[-1].benchmark - curve[0].benchmark) / curve[0].benchmark

        return BacktestMetrics(
            total_return=round(total, 6),
            cagr=round(cagr, 6) if cagr is not None else None,
            sharpe=round(sharpe, 4) if sharpe is not None else None,
            max_drawdown=round(max_dd, 6),
            benchmark_return=round(bench_return, 6) if bench_return is not None else None,
        )
