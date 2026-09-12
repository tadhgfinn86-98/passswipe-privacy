"""Run history.

Every cycle and backtest is kept so the desk can answer the question the
engines can't: how did this fund do over time, and how does one engine's book
compare to another's on the same day. Records are stored as the serialized
normalized schema — the schema is the contract, so a row stays readable even
if an adapter is rewritten.

SQLite because this is a desktop app: one file, no server, no migration story
for the user to care about.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Iterator

from . import config
from .schema import BacktestResult, FundCycle

_SCHEMA = """
CREATE TABLE IF NOT EXISTS cycles (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    engine     TEXT NOT NULL,
    fund       TEXT NOT NULL,
    as_of      TEXT NOT NULL,
    created_at TEXT NOT NULL,
    nav        REAL,
    ok         INTEGER NOT NULL DEFAULT 1,
    record     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cycles_engine ON cycles(engine, created_at DESC);

CREATE TABLE IF NOT EXISTS backtests (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    engine     TEXT NOT NULL,
    fund       TEXT NOT NULL,
    start      TEXT NOT NULL,
    end        TEXT NOT NULL,
    created_at TEXT NOT NULL,
    ok         INTEGER NOT NULL DEFAULT 1,
    record     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_backtests_engine ON backtests(engine, created_at DESC);
"""


@contextmanager
def _connect() -> Iterator[sqlite3.Connection]:
    config.ensure_state_dir()
    conn = sqlite3.connect(config.CYCLES_DB)
    conn.row_factory = sqlite3.Row
    try:
        conn.executescript(_SCHEMA)
        yield conn
        conn.commit()
    finally:
        conn.close()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def save_cycle(cycle: FundCycle) -> int:
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO cycles (engine, fund, as_of, created_at, nav, ok, record) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                cycle.engine,
                cycle.fund,
                cycle.as_of,
                _now(),
                cycle.nav,
                0 if cycle.errors else 1,
                cycle.model_dump_json(),
            ),
        )
        return int(cursor.lastrowid or 0)


def save_backtest(result: BacktestResult) -> int:
    with _connect() as conn:
        cursor = conn.execute(
            "INSERT INTO backtests (engine, fund, start, end, created_at, ok, record) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                result.engine,
                result.fund,
                result.start,
                result.end,
                _now(),
                0 if result.errors else 1,
                result.model_dump_json(),
            ),
        )
        return int(cursor.lastrowid or 0)


def recent_cycles(limit: int = 25, engine: str | None = None) -> list[dict[str, Any]]:
    query = "SELECT id, engine, fund, as_of, created_at, nav, ok FROM cycles"
    params: list[Any] = []
    if engine:
        query += " WHERE engine = ?"
        params.append(engine)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    with _connect() as conn:
        return [dict(row) for row in conn.execute(query, params)]


def get_cycle(cycle_id: int) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute("SELECT record FROM cycles WHERE id = ?", (cycle_id,)).fetchone()
    return json.loads(row["record"]) if row else None


def recent_backtests(limit: int = 25, engine: str | None = None) -> list[dict[str, Any]]:
    query = "SELECT id, engine, fund, start, end, created_at, ok FROM backtests"
    params: list[Any] = []
    if engine:
        query += " WHERE engine = ?"
        params.append(engine)
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)
    with _connect() as conn:
        return [dict(row) for row in conn.execute(query, params)]


def get_backtest(backtest_id: int) -> dict[str, Any] | None:
    with _connect() as conn:
        row = conn.execute(
            "SELECT record FROM backtests WHERE id = ?", (backtest_id,)
        ).fetchone()
    return json.loads(row["record"]) if row else None
