"""The engines this desk knows about.

Instances are cheap and stateless — the expensive imports happen inside
adapter methods, not here — so one instance per engine for the process life
is fine and keeps `lru_cache`d tape reads warm between requests.
"""
from __future__ import annotations

from .adapters.crypto import CryptoEngine
from .adapters.desks import DesksEngine
from .adapters.equities import EquitiesEngine
from .adapters.house import HouseEngine
from .protocol import FundEngine
from .schema import Availability, EngineInfo

_ENGINES: dict[str, FundEngine] = {
    "house": HouseEngine(),
    "equities": EquitiesEngine(),
    "crypto": CryptoEngine(),
    "desks": DesksEngine(),
}

# House first: it's the one that runs with no configuration, so it should be
# what a new user sees at the top of the list rather than a wall of "missing key".
ORDER = ["house", "equities", "crypto", "desks"]


def all_engines() -> list[FundEngine]:
    return [_ENGINES[k] for k in ORDER if k in _ENGINES]


def get_engine(engine_id: str) -> FundEngine | None:
    return _ENGINES.get(engine_id)


def catalog() -> list[EngineInfo]:
    return [engine.info() for engine in all_engines()]


def availability() -> list[Availability]:
    """Preflight every engine.

    One engine's broken install must not hide the others, so a failure here
    becomes an unavailable row rather than a 500 for the whole page.
    """
    out: list[Availability] = []
    for engine in all_engines():
        engine_id = engine.info().id
        try:
            out.append(engine.preflight())
        except Exception as exc:
            out.append(
                Availability(
                    engine=engine_id,
                    ready=False,
                    installed=False,
                    detail=f"preflight failed: {type(exc).__name__}: {exc}",
                )
            )
    return out
