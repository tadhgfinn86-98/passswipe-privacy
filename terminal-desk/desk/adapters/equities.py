"""virattt/ai-hedge-fund — LLM investor personas over US equities.

The upstream is unusually well-factored for this: `hedge_fund.pipeline.run_cycle`
is a pure function returning a fully-serialized CycleRecord, so this adapter is
mostly a translation layer rather than a re-implementation. Our normalized schema
was modelled on that record, which makes the mapping close to field-for-field.

Needs two keys: Financial Datasets for prices and fundamentals, and one LLM
provider for the personas. Both are checked in preflight so the UI can say
which one is missing instead of failing forty seconds into a run.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path
from typing import Any

from .. import config
from ..schema import (
    AssetClass,
    Availability,
    BacktestRequest,
    BacktestResult,
    CycleRequest,
    Direction,
    EngineInfo,
    FundCycle,
    Order,
    Requirement,
    RiskEvent,
    Signal,
    StrategySlice,
    TickerSkip,
)

ENGINE_ID = "equities"

LLM_PROVIDERS = {
    "ANTHROPIC_API_KEY": "Anthropic",
    "OPENAI_API_KEY": "OpenAI",
    "DEEPSEEK_API_KEY": "DeepSeek",
    "GOOGLE_API_KEY": "Google",
    "XAI_API_KEY": "xAI",
    "MOONSHOT_API_KEY": "Kimi",
}

DEFAULT_SPEC: dict[str, Any] = {
    "name": "terminal-desk-equities",
    "strategies": [
        {
            "name": "deep-value",
            "weight": 0.6,
            "models": [{"name": "graham", "weight": 2.0}, {"name": "buffett"}, {"name": "munger"}],
        },
        {"name": "earnings-drift", "weight": 0.4, "models": [{"name": "pead"}]},
    ],
    "risk": {"max_position_pct": 0.25, "max_gross_exposure": 1.0},
    "capital": 100_000,
    "rebalance": "weekly",
    "benchmark": "SPY",
}


def _ensure_importable() -> bool:
    """Put the upstream on sys.path without installing it into our env.

    Deliberately not `pip install -e` — the three engines have conflicting
    pins (two LangChain majors between them), and a shared site-packages is
    how one engine's upgrade silently breaks another.
    """
    root = config.EQUITIES_DIR
    if not (root / "hedge_fund").exists():
        return False
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    return True


class EquitiesEngine:
    def info(self) -> EngineInfo:
        return EngineInfo(
            id=ENGINE_ID,
            name="Equities Agents",
            asset_class=AssetClass.EQUITIES,
            summary=(
                "LLM investor personas (Graham, Buffett, Munger) plus a post-earnings "
                "drift model, netted into one book with master risk limits. Educational "
                "— upstream places no real trades."
            ),
            upstream="github.com/virattt/ai-hedge-fund",
            license="MIT",
        )

    def preflight(self) -> Availability:
        installed = _ensure_importable()
        missing: list[Requirement] = []

        data_key = config.has_key("FINANCIAL_DATASETS_API_KEY")
        if not data_key:
            missing.append(
                Requirement(
                    key="FINANCIAL_DATASETS_API_KEY",
                    purpose="prices, fundamentals and earnings",
                    satisfied=False,
                )
            )

        llm_present = [n for k, n in LLM_PROVIDERS.items() if config.has_key(k)]
        if not llm_present:
            missing.append(
                Requirement(
                    key=" or ".join(LLM_PROVIDERS),
                    purpose="the investor personas — any one provider is enough",
                    satisfied=False,
                )
            )

        if not installed:
            return Availability(
                engine=ENGINE_ID,
                ready=False,
                installed=False,
                missing=missing,
                detail="Engine not fetched. Run scripts/setup.py.",
            )

        ready = data_key and bool(llm_present)
        detail = (
            f"Ready — personas on {llm_present[0]}"
            if ready
            else "Installed, but missing credentials (see below)."
        )
        return Availability(
            engine=ENGINE_ID, ready=ready, installed=True, missing=missing, detail=detail
        )

    def _build(self, request: CycleRequest):
        """Construct the upstream's fund, broker and data client."""
        from hedge_fund.brokers.sim import SimBroker  # type: ignore
        from hedge_fund.data.cached import CachedDataClient  # type: ignore
        from hedge_fund.data.client import FDClient  # type: ignore
        from hedge_fund.fund.spec import Fund, FundSpec  # type: ignore

        spec_data = dict(DEFAULT_SPEC)
        spec_data.update(request.options.get("spec", {}))
        spec_data["capital"] = request.capital
        if request.fund:
            spec_data["name"] = request.fund

        spec = FundSpec.model_validate(spec_data)
        fund = Fund(spec)
        broker = SimBroker(cash=request.capital)
        client = CachedDataClient(FDClient(api_key=config.get_key("FINANCIAL_DATASETS_API_KEY")))
        return fund, broker, client

    def run_cycle(self, request: CycleRequest) -> FundCycle:
        as_of = request.as_of or date.today().isoformat()
        cycle = FundCycle(
            engine=ENGINE_ID,
            fund=request.fund or DEFAULT_SPEC["name"],
            as_of=as_of,
            universe=[t.upper() for t in request.universe],
            equity_before=request.capital,
            cash=request.capital,
            nav=request.capital,
        )

        ready = self.preflight()
        if not ready.ready:
            cycle.errors.append(ready.detail)
            for requirement in ready.missing:
                cycle.errors.append(f"missing {requirement.key} — {requirement.purpose}")
            return cycle
        if not cycle.universe:
            cycle.errors.append("No tickers given — this engine trades what you point it at.")
            return cycle

        try:
            from hedge_fund.pipeline.run_cycle import run_cycle as upstream_run_cycle  # type: ignore

            fund, broker, client = self._build(request)
            record = upstream_run_cycle(
                fund=fund,
                as_of=as_of,
                broker=broker,
                data_client=client,
                universe=cycle.universe,
            )
        except Exception as exc:  # upstream failure is a result, not a crash
            cycle.errors.append(f"{type(exc).__name__}: {exc}")
            return cycle

        return self._translate(record, cycle)

    def _translate(self, record: Any, cycle: FundCycle) -> FundCycle:
        """Map the upstream CycleRecord onto our schema."""
        data = record.model_dump() if hasattr(record, "model_dump") else dict(record)

        cycle.marks = {k: float(v) for k, v in (data.get("marks") or {}).items()}
        cycle.skipped = [
            TickerSkip(ticker=s.get("ticker", "?"), reason=s.get("reason", ""))
            for s in (data.get("skipped") or [])
        ]

        for strategy in data.get("strategies") or []:
            cycle.strategies.append(
                StrategySlice(
                    name=strategy.get("name", "?"),
                    slice=float(strategy.get("slice", 0.0)),
                    signals=[self._signal(s) for s in (strategy.get("signals") or [])],
                    convictions={
                        k: float(v) for k, v in (strategy.get("convictions") or {}).items()
                    },
                    weights={k: float(v) for k, v in (strategy.get("weights") or {}).items()},
                )
            )

        cycle.target_weights = {
            k: float(v) for k, v in (data.get("target_weights") or {}).items()
        }
        cycle.final_weights = {
            k: float(v) for k, v in (data.get("final_weights") or {}).items()
        }
        cycle.risk_events = [
            RiskEvent(
                kind="clamp",
                scope=str(c.get("ticker") or c.get("scope") or "book"),
                reason=str(c.get("reason", "risk limit")),
                before=c.get("before"),
                after=c.get("after"),
            )
            for c in (data.get("clamps") or [])
        ]

        for order in data.get("orders") or []:
            quantity = float(order.get("quantity") or order.get("shares") or 0)
            cycle.orders.append(
                Order(
                    ticker=order.get("ticker", "?"),
                    side="buy" if quantity > 0 else "sell",
                    quantity=abs(quantity),
                    limit_price=order.get("limit_price"),
                )
            )

        cycle.positions = {k: float(v) for k, v in (data.get("positions") or {}).items()}
        cycle.equity_before = float(data.get("equity_before", cycle.equity_before))
        cycle.cash = float(data.get("cash", cycle.cash))
        cycle.nav = float(data.get("nav", cycle.nav))
        cycle.meta = {"upstream": "virattt/ai-hedge-fund", "llm_backed": True}
        return cycle

    def _signal(self, raw: dict[str, Any]) -> Signal:
        direction = str(raw.get("signal") or raw.get("direction") or "neutral").lower()
        if direction not in {d.value for d in Direction}:
            direction = "neutral"
        confidence = float(raw.get("confidence", 0.0) or 0.0)
        if confidence > 1:  # upstream personas report 0-100
            confidence /= 100.0
        return Signal(
            author=str(raw.get("model") or raw.get("author") or "analyst"),
            ticker=str(raw.get("ticker", "?")),
            direction=Direction(direction),
            confidence=max(0.0, min(1.0, confidence)),
            rationale=str(raw.get("reasoning") or raw.get("rationale") or ""),
        )

    def backtest(self, request: BacktestRequest) -> BacktestResult:
        """Not wired yet.

        Upstream has a backtester, but it drives its own TUI and rebalance
        calendar. Rather than half-wrap it and report a curve that doesn't
        match what `aihf --backtest` would print, this says so plainly.
        """
        return BacktestResult(
            engine=ENGINE_ID,
            fund=request.fund or DEFAULT_SPEC["name"],
            start=request.start,
            end=request.end,
            errors=[
                "Backtesting for this engine is not wired into the desk yet — "
                "run `aihf <mandate> --backtest` upstream. Cycles work here."
            ],
        )
