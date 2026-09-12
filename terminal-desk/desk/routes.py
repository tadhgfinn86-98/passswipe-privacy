"""The desk's HTTP surface, mounted onto OpenTerminalUI's FastAPI app.

Everything lives under /api/desk so it can't collide with the 408 routes the
terminal already serves, and the desk's own UI is served at /desk.

Runs are dispatched to a worker thread: a cycle can sit on an LLM call for a
minute, and FastAPI's sync endpoints would otherwise tie up the event loop and
freeze the rest of the terminal while an agent thinks.
"""
from __future__ import annotations

import asyncio
from datetime import date
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, JSONResponse

from . import registry, store
from .schema import BacktestRequest, BacktestResult, CycleRequest, FundCycle

router = APIRouter(prefix="/api/desk", tags=["desk"])

WEB_DIR = Path(__file__).resolve().parents[1] / "web"


@router.get("/engines")
def list_engines() -> dict:
    """The catalog plus live readiness, in one call.

    Deliberately one call and not two: the UI needs both to render a single
    row, and splitting them guarantees a flash of engines with unknown state.
    """
    info = {i.id: i.model_dump(mode="json") for i in registry.catalog()}
    for status in registry.availability():
        if status.engine in info:
            info[status.engine]["availability"] = status.model_dump(mode="json")
    return {"engines": [info[k] for k in info]}


@router.get("/universe")
def universe() -> dict:
    """Symbols available offline, for the UI's picker."""
    from .adapters.house import available_symbols

    return {"pinned_symbols": available_symbols()}


@router.post("/cycle")
async def run_cycle(request: CycleRequest) -> FundCycle:
    engine = registry.get_engine(request.engine)
    if engine is None:
        raise HTTPException(status_code=404, detail=f"unknown engine {request.engine!r}")
    if not request.as_of:
        request.as_of = date.today().isoformat()

    cycle = await asyncio.to_thread(engine.run_cycle, request)
    # Failed runs are saved too — "it errored at 14:03 with this message" is
    # exactly what you want when a key expires mid-week.
    store.save_cycle(cycle)
    return cycle


@router.post("/backtest")
async def run_backtest(request: BacktestRequest) -> BacktestResult:
    engine = registry.get_engine(request.engine)
    if engine is None:
        raise HTTPException(status_code=404, detail=f"unknown engine {request.engine!r}")

    result = await asyncio.to_thread(engine.backtest, request)
    store.save_backtest(result)
    return result


@router.get("/history/cycles")
def history_cycles(
    limit: int = Query(default=25, ge=1, le=200), engine: str | None = None
) -> dict:
    return {"cycles": store.recent_cycles(limit=limit, engine=engine)}


@router.get("/history/cycles/{cycle_id}")
def history_cycle(cycle_id: int) -> JSONResponse:
    record = store.get_cycle(cycle_id)
    if record is None:
        raise HTTPException(status_code=404, detail="no such cycle")
    return JSONResponse(record)


@router.get("/history/backtests")
def history_backtests(
    limit: int = Query(default=25, ge=1, le=200), engine: str | None = None
) -> dict:
    return {"backtests": store.recent_backtests(limit=limit, engine=engine)}


@router.get("/history/backtests/{backtest_id}")
def history_backtest(backtest_id: int) -> JSONResponse:
    record = store.get_backtest(backtest_id)
    if record is None:
        raise HTTPException(status_code=404, detail="no such backtest")
    return JSONResponse(record)


ui_router = APIRouter(tags=["desk-ui"])


@ui_router.get("/desk", include_in_schema=False)
def desk_page() -> FileResponse:
    index = WEB_DIR / "index.html"
    if not index.exists():
        raise HTTPException(status_code=404, detail="desk UI not built")
    return FileResponse(index)


@ui_router.get("/desk/{asset:path}", include_in_schema=False)
def desk_asset(asset: str) -> FileResponse:
    """Serve the desk's own static files.

    Resolved and fenced to WEB_DIR so a crafted path can't walk out of the
    directory — this app runs on someone's desktop with their files around it.
    """
    candidate = (WEB_DIR / asset).resolve()
    if not str(candidate).startswith(str(WEB_DIR.resolve())) or not candidate.is_file():
        raise HTTPException(status_code=404, detail="not found")
    return FileResponse(candidate)
