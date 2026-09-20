"""Configuration loading.

Two sources, kept deliberately separate:

  config.yaml  - settings you tune (towns, radius, scoring weights, caps).
                 Safe to commit to git.
  .env         - secrets (API keys and tokens). NEVER committed; .gitignore
                 already excludes it.

Everything here is read once and cached. Call `reload()` to pick up edits to
config.yaml without restarting Streamlit.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

# All paths are resolved relative to THIS file's folder, so the app behaves the
# same whether you launch it from the project folder or from C:\ on Windows.
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.yaml"
ENV_PATH = BASE_DIR / ".env"

# load_dotenv reads .env into os.environ. override=False means a variable you
# already set in the Windows shell wins over the file.
load_dotenv(ENV_PATH, override=False)


class Config:
    """Thin wrapper over the parsed config.yaml.

    Use dotted paths so callers don't have to nest dictionary lookups:
        cfg.get("scoring.priority_high", 70)
    """

    def __init__(self, data: dict[str, Any]):
        self.data = data

    def get(self, path: str, default: Any = None) -> Any:
        node: Any = self.data
        for part in path.split("."):
            if not isinstance(node, dict) or part not in node:
                return default
            node = node[part]
        return node

    # --- convenience accessors used all over the app ---

    @property
    def towns(self) -> list[dict[str, Any]]:
        return self.get("towns", []) or []

    @property
    def town_names(self) -> list[str]:
        return [t["name"] for t in self.towns if t.get("name")]

    @property
    def db_path(self) -> Path:
        # A relative path in config.yaml means "next to the code", not "next to
        # wherever the terminal happens to be".
        raw = self.get("database.path", "ripple_leads.db")
        p = Path(raw)
        return p if p.is_absolute() else BASE_DIR / p


_cached: Config | None = None


def load(force: bool = False) -> Config:
    """Return the config, reading config.yaml from disk on first use."""
    global _cached
    if _cached is None or force:
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, "r", encoding="utf-8") as fh:
                data = yaml.safe_load(fh) or {}
        else:
            data = {}
        _cached = Config(data)
    return _cached


def reload() -> Config:
    """Re-read config.yaml and .env. Used by the Settings tab."""
    load_dotenv(ENV_PATH, override=True)
    return load(force=True)


# --- Secrets ---------------------------------------------------------------
# These return "" rather than None when unset, so `if not secret:` reads
# naturally everywhere and we never accidentally send the string "None".

def secret(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def anthropic_key() -> str:
    return secret("ANTHROPIC_API_KEY")


def google_places_key() -> str:
    return secret("GOOGLE_PLACES_API_KEY")


def notion_token() -> str:
    return secret("NOTION_TOKEN")


def notion_database_id() -> str:
    return secret("NOTION_DATABASE_ID")


def gmail_credentials_file() -> Path:
    raw = secret("GMAIL_CREDENTIALS_FILE") or "credentials.json"
    p = Path(raw)
    return p if p.is_absolute() else BASE_DIR / p


def gmail_token_file() -> Path:
    raw = secret("GMAIL_TOKEN_FILE") or "token.json"
    p = Path(raw)
    return p if p.is_absolute() else BASE_DIR / p


def key_status() -> dict[str, bool]:
    """Which optional integrations have credentials present.

    Used by the Settings tab to show green/grey ticks. Deliberately reports
    only presence - it never prints or logs the key itself.
    """
    return {
        "Anthropic (enrichment + drafts)": bool(anthropic_key()),
        "Google Places (extra discovery)": bool(google_places_key()),
        "Notion (CRM push)": bool(notion_token() and notion_database_id()),
        "Gmail (drafts/send)": gmail_credentials_file().exists(),
    }
