# Terminal Desk

One desktop app over four open-source projects: OpenTerminalUI's trading terminal
as the shell, and three AI hedge-fund engines behind a single normalized schema.

Run a cycle on any engine and you get the same record back — analysts → convictions
→ target weights → risk → orders → NAV — so an LLM agent swarm's book can be read
next to a deterministic baseline's on the same screen.

```
  Fund Desk  (this repo)
  ├── /desk           the desk UI, mounted into the terminal
  ├── /api/desk/*     engines, cycles, backtests, history
  └── engines/        fetched, never vendored
      ├── OpenTerminalUI      MIT        the shell — 408 API routes, React SPA
      ├── ai-hedge-fund       MIT        LLM investor personas, US equities
      ├── ai-hedge-fund-crypto MIT       LangGraph DAG, crypto
      └── ai-market-maker     AGPL-3.0   agent desks + Risk Guard, offline tape
```

## Quick start

Needs Python 3.11+, Node 20+ and git. No Docker.

```bash
python scripts/setup.py --deps      # fetch the four upstreams, install their deps
python run.py --desktop             # native window
```

Setup prints your terminal login at the end. It takes a few minutes — it's
cloning four repos, building a React bundle and installing some heavy wheels.

Use `run.py` rather than calling `desk.serve` directly: the desk imports the
terminal's FastAPI app, so it has to run in the terminal's venv, and `run.py`
finds that interpreter and re-execs into it.

Without `--desktop` it serves at `http://127.0.0.1:8765` and opens a browser tab.
The desk is at `/desk`; the full terminal is at `/login` on the same port.

Log into the terminal first — the desk inherits that session rather than inventing
a second login.

## The engines

| Engine | Needs | Notes |
|---|---|---|
| **House Desk** | nothing | Runs offline, out of the box |
| **Equities Agents** | Financial Datasets + any LLM key | Real cycles; backtest not wired |
| **Crypto DAG** | any LLM key | Binance keys only for live trading |
| **Agent Desks** | OpenAI/Atlas key, TA-Lib | Backtests offline on its pinned tape |

**House Desk** is the one that always works. It runs a real trend / momentum /
mean-reversion ensemble over the sha256-manifested daily tape that ships inside
ai-market-maker (19 pairs, ~3.4 years), with no network and no LLM in the path.

It exists to be the null hypothesis. The agent engines cost money per cycle and
are the interesting claim; this is plain technical voting against the same tape.
If a swarm of LLM analysts can't beat it, that's the most useful number here.

A two-year run of it, weekly rebalance, equal-weight buy-and-hold as benchmark:

```
total return   +7.46%      benchmark  +4.45%      excess  +3.02%
CAGR           +3.67%      Sharpe       0.28      max DD  -45.02%
```

Modest, with a drawdown that should make you respect the benchmark. That's the
point of having an honest baseline.

## Two deliberate constraints

**Upstreams are fetched, not vendored.** `scripts/setup.py` clones each repo at a
pinned ref into `engines/`. Nothing upstream is copied into this tree. That keeps
`git pull` boring, and it keeps ai-market-maker's **AGPL-3.0** at arm's length —
it runs as a separate installed program over a subprocess boundary, never imported
into this process. Vendoring or importing it would pull this whole app under AGPL.
If you distribute this app, check that boundary still holds.

**OpenTerminalUI is not forked.** Its backend is a plain FastAPI app, so `desk/app.py`
imports it and registers the desk's routers onto it. Its 408 routes, auth, and React
bundle are untouched.

One wrinkle worth knowing: the terminal ends its route table with a catch-all
(`/{full_path:path}`) that serves the React shell for anything unrecognized.
Routes added after it never match, so `_include_first()` moves the desk's routers
to the front of `app.router.routes` by object identity — current FastAPI appends a
lazy `_IncludedRouter` wrapper with no `.path` to match on, so matching by path
silently does nothing and `/desk` quietly returns the terminal's landing page with
a 200. If you upgrade FastAPI and `/desk` starts showing the wrong page, look there
first.

## Adding an engine

Implement four methods in `desk/adapters/`, register in `desk/registry.py`:

```python
def info(self) -> EngineInfo          # static; must not import the upstream
def preflight(self) -> Availability   # can it run right now, and if not, what's missing
def run_cycle(self, req) -> FundCycle
def backtest(self, req) -> BacktestResult
```

Two rules that matter more than they look:

- **Import the upstream lazily, inside methods.** Three engines pulling LangChain,
  torch and a Postgres driver at startup would make the window take half a minute
  to open, and one broken install would break every engine instead of its own.
- **Don't raise for ordinary failures.** A missing key or an unreachable exchange
  is an answer, not an exception — put it in `Availability.missing` or
  `FundCycle.errors` where the UI renders it as a sentence the user can act on.

## Layout

```
desk/
  schema.py      the normalized record every engine reports into
  protocol.py    what an engine must implement
  config.py      paths, pinned refs, .env loading
  registry.py    the engine list
  routes.py      /api/desk/* and /desk
  app.py         imports the terminal, mounts the desk onto it
  store.py       SQLite run history
  serve.py       server entry point
  desktop.py     native window (pywebview)
  adapters/      one file per upstream
web/             the desk UI — no framework, no build step
scripts/setup.py fetch and prepare engines
```

## Status

Working and verified: the House engine end to end (cycles, backtests, curve,
history), the terminal mount, inherited auth, all four engines' preflight.

Written against upstream APIs but **not yet executed**: the equities, crypto and
desks adapters. They need keys and network access that weren't available where
this was built, so treat their first real run as unproven. The equities adapter
calls `hedge_fund.pipeline.run_cycle` directly; the other two shell out.

Not done: packaging into a signed installer (`.exe` / `.app`), and a backtest
path for the equities engine.
