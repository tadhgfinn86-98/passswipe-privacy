"""olaxbt/ai-market-maker — multi-desk agentic trading with a Risk Guard veto.

Two things make this engine different from the others here:

  * Its `--csv-only` backtest runs entirely off the sha256-manifested tape in
    its own `data/` directory. No network, no exchange, reproducible. That's
    the one upstream path that works on a locked-down machine.
  * It is AGPL-3.0, while everything else here is MIT. It is run as a separate
    installed program over a subprocess boundary and never imported into this
    process or vendored into this tree, so it stays its own work. Keep it that
    way: importing it would pull this whole app under AGPL.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import date
from typing import Any

from .. import config
from ..schema import (
    AssetClass,
    Availability,
    BacktestMetrics,
    BacktestRequest,
    BacktestResult,
    CycleRequest,
    EngineInfo,
    EquityPoint,
    FundCycle,
    Requirement,
    RiskEvent,
)

ENGINE_ID = "desks"
RUN_TIMEOUT_SECONDS = 1800


class DesksEngine:
    def info(self) -> EngineInfo:
        return EngineInfo(
            id=ENGINE_ID,
            name="Agent Desks",
            asset_class=AssetClass.MULTI,
            summary=(
                "Specialist agent desks under a hard Risk Guard that can veto any "
                "trade, benchmarked against buy-and-hold. Backtests run offline "
                "against a pinned, hash-verified tape."
            ),
            upstream="github.com/olaxbt/ai-market-maker",
            license="AGPL-3.0",
            supports_cycle=False,
        )

    def preflight(self) -> Availability:
        root = config.DESKS_DIR
        installed = (root / "src").exists()
        missing: list[Requirement] = []

        has_llm = config.has_key("OPENAI_API_KEY") or config.has_key("ATLASCLOUD_API_KEY")
        if not has_llm:
            missing.append(
                Requirement(
                    key="OPENAI_API_KEY or ATLASCLOUD_API_KEY",
                    purpose="the agent desks — required for LLM overlays",
                    satisfied=False,
                )
            )
        missing.append(
            Requirement(
                key="pinned tape",
                purpose="offline --csv-only backtests",
                kind="data",
                satisfied=config.OHLCV_DIR.exists(),
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
        if not (root / ".venv").exists():
            return Availability(
                engine=ENGINE_ID,
                ready=False,
                installed=True,
                missing=missing,
                detail=(
                    "Fetched, but dependencies aren't installed. Needs TA-Lib (a C "
                    "library) — see scripts/setup.py --deps."
                ),
            )
        return Availability(
            engine=ENGINE_ID,
            ready=has_llm,
            installed=True,
            missing=missing,
            detail=(
                "Ready" if has_llm else "Installed; LLM key needed for the agent overlays."
            ),
        )

    def _python(self) -> str:
        venv_python = config.DESKS_DIR / ".venv" / "bin" / "python"
        if venv_python.exists():
            return str(venv_python)
        windows = config.DESKS_DIR / ".venv" / "Scripts" / "python.exe"
        return str(windows) if windows.exists() else sys.executable

    def run_cycle(self, request: CycleRequest) -> FundCycle:
        """Not offered.

        Upstream's live path is a long-running worker against Postgres and an
        exchange, not a one-shot tick. Pretending otherwise would mean starting
        a stack this app doesn't manage. Its value here is the offline backtest.
        """
        return FundCycle(
            engine=ENGINE_ID,
            fund=request.fund or "Agent Desks",
            as_of=request.as_of or date.today().isoformat(),
            errors=[
                "This engine runs as a persistent worker, not a single cycle. "
                "Use its backtest here, or bring up its own Docker stack for live desks."
            ],
        )

    def backtest(self, request: BacktestRequest) -> BacktestResult:
        result = BacktestResult(
            engine=ENGINE_ID,
            fund=request.fund or "Agent Desks",
            start=request.start,
            end=request.end,
        )
        ready = self.preflight()
        if not ready.installed:
            result.errors.append(ready.detail)
            return result

        ticker = (request.universe or ["BTC/USDT"])[0]
        if "_" in ticker and "/" not in ticker:
            ticker = ticker.replace("_", "/")
        steps = int(request.options.get("steps", 180))

        command = [
            self._python(),
            "-m",
            "backtest",
            "run",
            "--csv-only",
            "--timeframe",
            "1d",
            "--ticker",
            ticker,
            "--steps",
            str(steps),
        ]
        env_overrides = {"NEXUS_DISABLE": "1"}

        try:
            proc = subprocess.run(
                command,
                cwd=str(config.DESKS_DIR),
                capture_output=True,
                text=True,
                timeout=RUN_TIMEOUT_SECONDS,
                env={**_os_environ(), **env_overrides},
            )
        except subprocess.TimeoutExpired:
            result.errors.append(f"backtest exceeded {RUN_TIMEOUT_SECONDS}s and was stopped")
            return result
        except OSError as exc:
            result.errors.append(str(exc))
            return result

        if proc.returncode != 0:
            result.errors.append((proc.stderr or proc.stdout).strip()[:2000])
            return result

        result.meta = {
            "upstream": "olaxbt/ai-market-maker",
            "license": "AGPL-3.0",
            "command": " ".join(command[1:]),
            "offline": True,
            "stdout_tail": proc.stdout.strip()[-8000:],
        }
        self._absorb_output(proc.stdout, result)
        return result

    def _absorb_output(self, stdout: str, result: BacktestResult) -> None:
        """Lift a curve, metrics and any Risk Guard vetoes out of the run.

        Upstream's reporting has changed shape across releases, so this reads
        what it can and leaves the verbatim tail in meta rather than asserting
        a format that may not hold.
        """
        for match in re.finditer(r"\{[^{}]*\"equity\"[^{}]*\}", stdout):
            try:
                point = json.loads(match.group(0))
            except json.JSONDecodeError:
                continue
            if "date" in point:
                result.curve.append(
                    EquityPoint(
                        date=str(point["date"]),
                        nav=float(point.get("equity", 0.0)),
                        benchmark=point.get("benchmark"),
                    )
                )

        metrics = {}
        for key, pattern in {
            "total_return": r"total[_ ]return[\"'\s:]+(-?[\d.]+)",
            "sharpe": r"sharpe[\"'\s:]+(-?[\d.]+)",
            "max_drawdown": r"max[_ ]drawdown[\"'\s:]+(-?[\d.]+)",
        }.items():
            found = re.search(pattern, stdout, re.IGNORECASE)
            if found:
                try:
                    metrics[key] = float(found.group(1))
                except ValueError:
                    pass
        if metrics:
            result.metrics = BacktestMetrics(**metrics)

        for veto in re.finditer(r"(?i)risk[_ ]guard[^\n]*veto[^\n]*", stdout):
            result.meta.setdefault("vetoes", []).append(veto.group(0).strip()[:300])


def _os_environ() -> dict[str, str]:
    import os

    config.load_env()
    return dict(os.environ)
