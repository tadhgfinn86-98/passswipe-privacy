"""The one shape every engine reports into.

Three very different fund engines hang off this app: an equities agent pipeline,
a crypto LangGraph DAG, and a multi-desk market maker. They disagree about
almost everything — assets, cadence, what a "strategy" is — but they all walk
the same road: analysts form views, views become target weights, risk trims or
vetoes them, what survives becomes orders, and the book gets marked.

That road is the schema. An adapter's whole job is to land its engine's output
here, so one screen can render all three and a backtest from one can be read
next to a cycle from another.

Modelled on virattt/ai-hedge-fund's CycleRecord, which had the shape right.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AssetClass(str, Enum):
    EQUITIES = "equities"
    CRYPTO = "crypto"
    MULTI = "multi"


class Direction(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class Signal(BaseModel):
    """One analyst's view on one name.

    `author` is whoever formed it — an LLM persona ("Ben Graham"), a technical
    node ("rsi_divergence"), or a desk ("momentum_desk"). The UI groups by it,
    so it should read as a name, not a class path.
    """

    author: str
    ticker: str
    direction: Direction
    confidence: float = Field(ge=0.0, le=1.0)
    rationale: str = ""


class StrategySlice(BaseModel):
    """One strategy's slice of the book: its analysts' views and the sleeve
    they add up to, before netting against other strategies."""

    name: str
    slice: float = Field(default=1.0, description="normalized capital share")
    signals: list[Signal] = Field(default_factory=list)
    convictions: dict[str, float] = Field(default_factory=dict)
    weights: dict[str, float] = Field(default_factory=dict)


class RiskEvent(BaseModel):
    """Risk acting on the book.

    A `clamp` trims a weight; a `veto` kills the trade outright. ai-market-maker
    leans on veto (its Risk Guard sits in front of execution), the equities
    pipeline leans on clamp. Both land here so the UI can show one risk log.
    """

    kind: Literal["clamp", "veto"]
    scope: str = Field(description="ticker, strategy, or 'book'")
    reason: str
    before: float | None = None
    after: float | None = None


class Order(BaseModel):
    ticker: str
    side: Literal["buy", "sell"]
    quantity: float
    limit_price: float | None = None
    notional: float | None = None


class Fill(BaseModel):
    ticker: str
    side: Literal["buy", "sell"]
    quantity: float
    price: float


class TickerSkip(BaseModel):
    """A name the cycle was asked to trade but couldn't, and why.

    Worth surfacing rather than swallowing: with no data key configured this is
    where every ticker ends up, and a visible list of skips explains an empty
    book far better than a silent one.
    """

    ticker: str
    reason: str


class FundCycle(BaseModel):
    """One tick of one fund — every stage's input and output, serializable.

    Nothing about a decision should live outside this record: if the UI can't
    explain a position from the cycle that produced it, the cycle is underspecified.
    """

    engine: str
    fund: str
    as_of: str
    created_at: datetime = Field(default_factory=_utcnow)

    universe: list[str] = Field(default_factory=list)
    marks: dict[str, float] = Field(default_factory=dict)
    skipped: list[TickerSkip] = Field(default_factory=list)

    strategies: list[StrategySlice] = Field(default_factory=list)
    target_weights: dict[str, float] = Field(default_factory=dict)
    risk_events: list[RiskEvent] = Field(default_factory=list)
    final_weights: dict[str, float] = Field(default_factory=dict)

    orders: list[Order] = Field(default_factory=list)
    fills: list[Fill] = Field(default_factory=list)
    positions: dict[str, float] = Field(default_factory=dict)

    equity_before: float = 0.0
    cash: float = 0.0
    nav: float = 0.0

    meta: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)


class EquityPoint(BaseModel):
    date: str
    nav: float
    benchmark: float | None = None


class BacktestMetrics(BaseModel):
    total_return: float | None = None
    cagr: float | None = None
    sharpe: float | None = None
    max_drawdown: float | None = None
    turnover: float | None = None
    benchmark_return: float | None = None


class BacktestResult(BaseModel):
    engine: str
    fund: str
    start: str
    end: str
    curve: list[EquityPoint] = Field(default_factory=list)
    metrics: BacktestMetrics = Field(default_factory=BacktestMetrics)
    cycles: list[FundCycle] = Field(default_factory=list)
    meta: dict[str, Any] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)


class Requirement(BaseModel):
    """Something an engine needs before it can do real work.

    `satisfied` is checked at runtime, not import time — the answer changes when
    the user edits .env, and a stale "unavailable" is worse than no answer.
    """

    key: str
    purpose: str
    satisfied: bool = False
    kind: Literal["api_key", "package", "data", "network"] = "api_key"


class EngineInfo(BaseModel):
    id: str
    name: str
    asset_class: AssetClass
    summary: str
    upstream: str = ""
    license: str = ""
    requirements: list[Requirement] = Field(default_factory=list)
    supports_cycle: bool = True
    supports_backtest: bool = True


class Availability(BaseModel):
    """Whether an engine can run right now, and if not, what's missing.

    The UI shows this before offering a Run button, so the failure is a sentence
    the user can act on instead of a traceback after a 40-second wait.
    """

    engine: str
    ready: bool
    installed: bool = False
    missing: list[Requirement] = Field(default_factory=list)
    detail: str = ""


class CycleRequest(BaseModel):
    engine: str
    universe: list[str] = Field(default_factory=list)
    as_of: str | None = None
    capital: float = 100_000.0
    fund: str | None = None
    options: dict[str, Any] = Field(default_factory=dict)


class BacktestRequest(BaseModel):
    engine: str
    universe: list[str] = Field(default_factory=list)
    start: str
    end: str
    capital: float = 100_000.0
    fund: str | None = None
    options: dict[str, Any] = Field(default_factory=dict)
