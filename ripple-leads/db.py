"""SQLite storage.

One file on disk (ripple_leads.db by default), no server to install or run.
If you ever want to start over, close Streamlit and delete that file.

Everything the rest of the app does to the database goes through this module,
so there is exactly one place where the SQL lives.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterable, Optional

import pandas as pd

import config
from models import Lead, now_iso

# The column order here is the single source of truth for the table layout.
# `id` and `dedupe_key` are managed by this module, not by callers.
COLUMNS = [
    "business", "type", "area", "address", "street", "postcode",
    "phone", "website", "email", "contact_name",
    "independent", "compliant_yet", "est_monthly_spend",
    "score", "priority", "suggested_lane",
    "status", "next_action", "next_action_date", "notes",
    "approved", "draft_subject", "draft_body", "opener", "last_contacted",
    "source", "external_id", "created_at", "updated_at",
]

SCHEMA = """
CREATE TABLE IF NOT EXISTS leads (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    business          TEXT NOT NULL,
    type              TEXT NOT NULL DEFAULT 'Other',
    area              TEXT DEFAULT '',
    address           TEXT DEFAULT '',
    street            TEXT DEFAULT '',
    postcode          TEXT DEFAULT '',
    phone             TEXT DEFAULT '',
    website           TEXT DEFAULT '',
    email             TEXT DEFAULT '',
    contact_name      TEXT DEFAULT '',
    independent       TEXT DEFAULT 'unknown',
    compliant_yet     TEXT DEFAULT 'unknown',
    est_monthly_spend REAL,
    score             INTEGER DEFAULT 0,
    priority          TEXT DEFAULT 'Low',
    suggested_lane    TEXT DEFAULT 'Walk-in',
    status            TEXT DEFAULT 'To research',
    next_action       TEXT DEFAULT '',
    next_action_date  TEXT DEFAULT '',
    notes             TEXT DEFAULT '',
    approved          INTEGER DEFAULT 0,
    draft_subject     TEXT DEFAULT '',
    draft_body        TEXT DEFAULT '',
    opener            TEXT DEFAULT '',
    last_contacted    TEXT DEFAULT '',
    source            TEXT DEFAULT 'osm',
    external_id       TEXT DEFAULT '',
    created_at        TEXT NOT NULL,
    updated_at        TEXT NOT NULL,
    dedupe_key        TEXT NOT NULL
);

-- This index is what actually enforces "one row per business+street".
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_dedupe ON leads(dedupe_key);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score  ON leads(score DESC);

-- Every outbound email is logged here. The daily cap counts rows in this
-- table, so the cap survives restarting the app.
CREATE TABLE IF NOT EXISTS sends (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id  INTEGER NOT NULL,
    channel  TEXT NOT NULL,
    subject  TEXT DEFAULT '',
    sent_at  TEXT NOT NULL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
);
CREATE INDEX IF NOT EXISTS idx_sends_sent_at ON sends(sent_at);
"""


def db_file() -> Path:
    return config.load().db_path


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(db_file())
    # Rows come back as dict-like objects instead of bare tuples.
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    """Create the tables if they don't exist. Safe to call on every startup."""
    with connect() as conn:
        conn.executescript(SCHEMA)


# --- writes ----------------------------------------------------------------

def insert_lead(lead: Lead) -> Optional[int]:
    """Insert one lead. Returns the new id, or None if it was a duplicate.

    Duplicates are not an error - a discovery run is expected to re-find
    businesses it found last time.
    """
    values = [_to_sql(getattr(lead, col)) for col in COLUMNS]
    placeholders = ",".join("?" for _ in COLUMNS)
    sql = f"INSERT INTO leads ({','.join(COLUMNS)}, dedupe_key) VALUES ({placeholders}, ?)"
    with connect() as conn:
        try:
            cur = conn.execute(sql, values + [lead.dedupe_key])
            return cur.lastrowid
        except sqlite3.IntegrityError:
            # Unique index on dedupe_key rejected it. That's the dedupe working.
            return None


def insert_many(leads: Iterable[Lead]) -> dict[str, int]:
    """Bulk insert. Returns {'inserted': n, 'duplicates': n}."""
    inserted = duplicates = 0
    for lead in leads:
        if insert_lead(lead) is None:
            duplicates += 1
        else:
            inserted += 1
    return {"inserted": inserted, "duplicates": duplicates}


def update_lead(lead_id: int, **fields: Any) -> None:
    """Update named columns on one lead and stamp updated_at.

    Unknown column names are ignored rather than raising, so a stray key from
    the Streamlit editor can't take the app down.
    """
    safe = {k: _to_sql(v) for k, v in fields.items() if k in COLUMNS}
    if not safe:
        return
    safe["updated_at"] = now_iso()
    assignments = ",".join(f"{k}=?" for k in safe)
    with connect() as conn:
        conn.execute(
            f"UPDATE leads SET {assignments} WHERE id=?",
            list(safe.values()) + [lead_id],
        )


def delete_lead(lead_id: int) -> None:
    with connect() as conn:
        conn.execute("DELETE FROM sends WHERE lead_id=?", (lead_id,))
        conn.execute("DELETE FROM leads WHERE id=?", (lead_id,))


# --- reads -----------------------------------------------------------------

def get_lead(lead_id: int) -> Optional[Lead]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
    return _row_to_lead(row) if row else None


def all_leads() -> list[Lead]:
    with connect() as conn:
        rows = conn.execute("SELECT * FROM leads ORDER BY score DESC, business").fetchall()
    return [_row_to_lead(r) for r in rows]


def leads_dataframe() -> pd.DataFrame:
    """Everything as a pandas DataFrame - what Streamlit's table wants."""
    with connect() as conn:
        df = pd.read_sql_query(
            "SELECT id, " + ",".join(COLUMNS) + " FROM leads ORDER BY score DESC, business",
            conn,
        )
    if not df.empty:
        df["approved"] = df["approved"].astype(bool)
    return df


def count_by_status() -> dict[str, int]:
    with connect() as conn:
        rows = conn.execute("SELECT status, COUNT(*) AS n FROM leads GROUP BY status").fetchall()
    return {r["status"]: r["n"] for r in rows}


def total_leads() -> int:
    with connect() as conn:
        return conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]


# --- send log (used by the daily cap) --------------------------------------

def log_send(lead_id: int, channel: str, subject: str = "") -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO sends (lead_id, channel, subject, sent_at) VALUES (?,?,?,?)",
            (lead_id, channel, subject, now_iso()),
        )


def sends_today() -> int:
    """How many emails have gone out today (UTC). Compared against the cap."""
    today = now_iso()[:10]
    with connect() as conn:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM sends WHERE substr(sent_at,1,10)=?", (today,)
        ).fetchone()
    return row["n"]


# --- helpers ---------------------------------------------------------------

def _to_sql(value: Any) -> Any:
    """SQLite has no boolean type, so store True/False as 1/0."""
    if isinstance(value, bool):
        return 1 if value else 0
    return value


def _row_to_lead(row: sqlite3.Row) -> Lead:
    data = {k: row[k] for k in row.keys() if k != "dedupe_key"}
    data["approved"] = bool(data.get("approved", 0))
    # SQLite happily returns NULL for TEXT columns; pydantic wants strings.
    for key, value in list(data.items()):
        if value is None and key not in ("id", "est_monthly_spend"):
            data[key] = ""
    return Lead(**data)
