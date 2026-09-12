"""51bitquant/ai-hedge-fund-crypto — LangGraph DAG over crypto pairs.

Upstream is configured by a `config.yaml` next to its `main.py` and driven from
that module's `__main__` block, so there's no importable "run one cycle"
function to call the way the equities engine offers. This adapter therefore
writes a config and runs it as a subprocess, in its own interpreter.

That isolation is a feature, not a workaround: this engine pins a different
LangChain major than the equities engine, and importing both into one process
is how you get an import-time explosion that takes down the whole app.
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import date, timedelta
from typing import Any

from .. import config
from ..schema import (
    AssetClass,
    Availability,
    BacktestRequest,
    BacktestResult,
    CycleRequest,
    EngineInfo,
    FundCycle,
    Requirement,
)

ENGINE_ID = "crypto"

LLM_PROVIDERS = {
    "OPENAI_API_KEY": "OpenAI",
    "ANTHROPIC_API_KEY": "Anthropic",
    "GROQ_API_KEY": "Groq",
    "OPENROUTER_API_KEY": "OpenRouter",
    "GOOGLE_API_KEY": "Google",
}

DEFAULT_STRATEGIES = ["MacdStrategy", "RSIStrategy"]
RUN_TIMEOUT_SECONDS = 900


class CryptoEngine:
    def info(self) -> EngineInfo:
        return EngineInfo(
            id=ENGINE_ID,
            name="Crypto DAG",
            asset_class=AssetClass.CRYPTO,
            summary=(
                "LangGraph DAG of technical strategy nodes across multiple timeframes, "
                "ensembled by adaptive weights, with an LLM making the final position "
                "call. Pulls bars from Binance."
            ),
            upstream="github.com/51bitquant/ai-hedge-fund-crypto",
            license="MIT",
        )

    def preflight(self) -> Availability:
        root = config.CRYPTO_DIR
        installed = (root / "main.py").exists()
        missing: list[Requirement] = []

        llm_present = [n for k, n in LLM_PROVIDERS.items() if config.has_key(k)]
        if not llm_present:
            missing.append(
                Requirement(
                    key=" or ".join(LLM_PROVIDERS),
                    purpose="portfolio-management decisions — any one provider",
                    satisfied=False,
                )
            )
        # Binance keys are only needed for live trading; public market data
        # endpoints are unauthenticated, so a backtest runs without them.
        missing.append(
            Requirement(
                key="BINANCE_API_KEY",
                purpose="live trading only — backtests use public market data",
                satisfied=config.has_key("BINANCE_API_KEY"),
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

        venv = root / ".venv"
        if not venv.exists():
            return Availability(
                engine=ENGINE_ID,
                ready=False,
                installed=True,
                missing=missing,
                detail="Fetched, but dependencies aren't installed. Run scripts/setup.py --deps.",
            )

        ready = bool(llm_present)
        return Availability(
            engine=ENGINE_ID,
            ready=ready,
            installed=True,
            missing=missing,
            detail=(
                f"Ready — decisions on {llm_present[0]}"
                if ready
                else "Installed, but no LLM provider key configured."
            ),
        )

    def _python(self) -> str:
        venv_python = config.CRYPTO_DIR / ".venv" / "bin" / "python"
        if venv_python.exists():
            return str(venv_python)
        windows = config.CRYPTO_DIR / ".venv" / "Scripts" / "python.exe"
        return str(windows) if windows.exists() else sys.executable

    def _write_config(self, request: CycleRequest | BacktestRequest, mode: str) -> None:
        """Render upstream's config.yaml from our request.

        Written by hand rather than with PyYAML so this adapter stays
        dependency-free — the schema is three levels deep and fully known.
        """
        tickers = [t.upper().replace("_", "").replace("/", "") for t in request.universe] or [
            "BTCUSDT"
        ]
        strategies = request.options.get("strategies", DEFAULT_STRATEGIES)
        if isinstance(request, BacktestRequest):
            start, end = request.start, request.end
        else:
            as_of = date.fromisoformat(request.as_of or date.today().isoformat())
            start, end = (as_of - timedelta(days=180)).isoformat(), as_of.isoformat()

        lines = [
            f"mode: {mode}",
            f"start_date: {start}",
            f"end_date: {end}",
            f"initial_cash: {request.capital}",
            "margin_requirement: 0.0",
            "primary_interval: 1d",
            "show_reasoning: true",
            "show_agent_graph: false",
            "model:",
            f"  name: {request.options.get('model', 'gpt-4o-mini')}",
            f"  provider: {request.options.get('provider', 'OpenAI')}",
            "signals:",
            "  intervals:",
            "    - 1d",
            "  tickers:",
            *[f"    - {t}" for t in tickers],
            "  strategies:",
            *[f"    - {s}" for s in strategies],
        ]
        (config.CRYPTO_DIR / "config.yaml").write_text("\n".join(lines) + "\n", encoding="utf-8")

    def _invoke(self, mode: str) -> tuple[int, str, str]:
        try:
            proc = subprocess.run(
                [self._python(), "main.py"],
                cwd=str(config.CRYPTO_DIR),
                capture_output=True,
                text=True,
                timeout=RUN_TIMEOUT_SECONDS,
            )
            return proc.returncode, proc.stdout, proc.stderr
        except subprocess.TimeoutExpired:
            return 1, "", f"engine exceeded {RUN_TIMEOUT_SECONDS}s and was stopped"
        except OSError as exc:
            return 1, "", str(exc)

    def run_cycle(self, request: CycleRequest) -> FundCycle:
        cycle = FundCycle(
            engine=ENGINE_ID,
            fund=request.fund or "Crypto DAG",
            as_of=request.as_of or date.today().isoformat(),
            universe=[t.upper() for t in request.universe],
            equity_before=request.capital,
            cash=request.capital,
            nav=request.capital,
        )
        ready = self.preflight()
        if not ready.ready:
            cycle.errors.append(ready.detail)
            for requirement in ready.missing:
                if not requirement.satisfied and "live trading only" not in requirement.purpose:
                    cycle.errors.append(f"missing {requirement.key} — {requirement.purpose}")
            return cycle

        self._write_config(request, mode="live")
        code, out, err = self._invoke("live")
        if code != 0:
            cycle.errors.append(err.strip()[:2000] or "engine exited non-zero")
            return cycle

        cycle.meta = {
            "upstream": "51bitquant/ai-hedge-fund-crypto",
            "llm_backed": True,
            "stdout_tail": out.strip()[-4000:],
        }
        decisions = self._parse_decisions(out)
        if decisions:
            cycle.meta["decisions"] = decisions
            total = sum(abs(float(d.get("quantity", 0) or 0)) for d in decisions.values()) or 1
            for ticker, decision in decisions.items():
                quantity = float(decision.get("quantity", 0) or 0)
                if quantity:
                    cycle.final_weights[ticker] = round(abs(quantity) / total, 6)
        else:
            cycle.errors.append(
                "Engine ran, but the desk could not parse a decision table from its "
                "output — see stdout in the raw record."
            )
        return cycle

    def _parse_decisions(self, stdout: str) -> dict[str, Any]:
        """Pull the decision JSON out of upstream's chatty stdout.

        It prints rich tables and reasoning around the payload, so scan for the
        last balanced JSON object that looks like a decision map.
        """
        best: dict[str, Any] = {}
        for start in (i for i, ch in enumerate(stdout) if ch == "{"):
            depth = 0
            for end in range(start, len(stdout)):
                if stdout[end] == "{":
                    depth += 1
                elif stdout[end] == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            candidate = json.loads(stdout[start : end + 1])
                        except json.JSONDecodeError:
                            break
                        if isinstance(candidate, dict) and any(
                            isinstance(v, dict) and "action" in v for v in candidate.values()
                        ):
                            best = candidate
                        break
        return best

    def backtest(self, request: BacktestRequest) -> BacktestResult:
        result = BacktestResult(
            engine=ENGINE_ID,
            fund=request.fund or "Crypto DAG",
            start=request.start,
            end=request.end,
        )
        ready = self.preflight()
        if not ready.ready:
            result.errors.append(ready.detail)
            return result

        self._write_config(request, mode="backtest")
        code, out, err = self._invoke("backtest")
        if code != 0:
            result.errors.append(err.strip()[:2000] or "engine exited non-zero")
            return result
        result.meta = {
            "upstream": "51bitquant/ai-hedge-fund-crypto",
            "stdout_tail": out.strip()[-8000:],
            "note": "Upstream reports performance as tables and plots; the desk "
            "surfaces its output verbatim rather than re-deriving a curve.",
        }
        return result
