"""What an engine is, from the app's point of view.

An adapter owns exactly one upstream project. It answers three questions:
what are you (`info`), can you run right now (`preflight`), and here is a
request — do it (`run_cycle` / `backtest`).

Adapters must not raise for the ordinary failures. A missing API key, an
unreachable exchange, an upstream that isn't installed: those are answers, not
exceptions, and they belong in `Availability.missing` or `FundCycle.errors`
where the UI can render them. Raise only for genuine bugs.

Engines are imported lazily inside adapter methods, never at module import.
Three fund engines pulling in torch, LangGraph and a Postgres driver at startup
would make the desktop app take half a minute to open a window — and would make
one broken install break every engine instead of just its own.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from .schema import (
    Availability,
    BacktestRequest,
    BacktestResult,
    CycleRequest,
    EngineInfo,
    FundCycle,
)


@runtime_checkable
class FundEngine(Protocol):
    """One upstream fund project, wrapped."""

    def info(self) -> EngineInfo:
        """Static description. Must not import the upstream package."""
        ...

    def preflight(self) -> Availability:
        """Can this engine do real work right now?

        Checks installation, keys and data on every call — cheap, and the
        answer changes when the user edits their .env.
        """
        ...

    def run_cycle(self, request: CycleRequest) -> FundCycle:
        """Run one tick and report it in the normalized schema."""
        ...

    def backtest(self, request: BacktestRequest) -> BacktestResult:
        """Run a historical simulation and report the curve."""
        ...


class EngineError(Exception):
    """A genuine bug in an adapter — not a missing key or an offline exchange."""


class NotSupported(EngineError):
    """The engine cannot do this at all (e.g. a backtest-only engine asked to tick)."""
