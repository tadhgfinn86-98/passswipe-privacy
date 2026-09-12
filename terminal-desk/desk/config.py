"""Where things live, and what's configured.

The app owns no upstream source. Four projects are cloned into `engines/` by
scripts/setup.py at pinned commits; this module is the only place that knows
those paths, so moving the tree is a one-line change.

Everything resolves off DESK_HOME so the desktop build can relocate the whole
installation (a packaged app writes to the user's data dir, not next to the
binary) without any other module learning about it.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

_THIS = Path(__file__).resolve()
PROJECT_ROOT = _THIS.parents[1]


def _home() -> Path:
    override = os.getenv("DESK_HOME")
    return Path(override).expanduser().resolve() if override else PROJECT_ROOT


DESK_HOME = _home()
ENGINES_DIR = DESK_HOME / "engines"

TERMINAL_DIR = ENGINES_DIR / "OpenTerminalUI"
EQUITIES_DIR = ENGINES_DIR / "ai-hedge-fund"
CRYPTO_DIR = ENGINES_DIR / "ai-hedge-fund-crypto"
DESKS_DIR = ENGINES_DIR / "ai-market-maker"

# ai-market-maker ships ~31 MB of sha256-manifested historical data so its
# backtests reproduce without network. The house engine reads the same tape,
# which is what lets this app do real work with no API key at all.
PINNED_DATA_DIR = DESKS_DIR / "data"
OHLCV_DIR = PINNED_DATA_DIR / "ohlcv"

STATE_DIR = Path(os.getenv("DESK_STATE", DESK_HOME / "state")).expanduser()
CYCLES_DB = STATE_DIR / "cycles.sqlite3"

# Upstreams are pinned rather than floating: an engine adapter is written
# against a specific upstream API, and a surprise `main` can change that API
# under us. setup.py --update moves these deliberately.
PINS: dict[str, dict[str, str]] = {
    "OpenTerminalUI": {
        "url": "https://github.com/Hitheshkaranth/OpenTerminalUI.git",
        "ref": "main",
        "license": "MIT",
    },
    "ai-hedge-fund": {
        "url": "https://github.com/virattt/ai-hedge-fund.git",
        "ref": "main",
        "license": "MIT",
    },
    "ai-hedge-fund-crypto": {
        "url": "https://github.com/51bitquant/ai-hedge-fund-crypto.git",
        "ref": "main",
        "license": "MIT",
    },
    # AGPL-3.0. Installed alongside, never vendored into this source tree:
    # copying it in would pull the whole combined work under AGPL. Used as an
    # installed program at arm's length, it stays its own work.
    "ai-market-maker": {
        "url": "https://github.com/olaxbt/ai-market-maker.git",
        "ref": "main",
        "license": "AGPL-3.0",
    },
}


def ensure_state_dir() -> Path:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    return STATE_DIR


@lru_cache(maxsize=1)
def load_env() -> dict[str, str]:
    """Read .env once, without clobbering real environment variables.

    A key exported in the shell always wins over the file — same rule the
    upstream projects use, and the one people expect when debugging.
    """
    env_path = DESK_HOME / ".env"
    values: dict[str, str] = {}
    if env_path.exists():
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"').strip("'")
    for key, value in values.items():
        os.environ.setdefault(key, value)
    return values


def get_key(name: str) -> str:
    load_env()
    return (os.getenv(name) or "").strip()


def has_key(name: str) -> bool:
    return bool(get_key(name))


def engine_installed(path: Path) -> bool:
    return path.exists() and any(path.iterdir()) if path.exists() else False
