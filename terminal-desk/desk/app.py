"""Assemble the application.

The terminal is not forked. Its backend is a plain FastAPI app, so we import it
and mount our router onto it — its 408 routes, its auth, its React bundle all
keep working untouched, and `git pull` in engines/OpenTerminalUI stays a
no-drama operation.

If the terminal isn't installed we still serve the desk standalone rather than
refusing to start. A user who has fetched nothing should get a window that
explains what to do, not a stack trace in a console they can't see.
"""
from __future__ import annotations

import sys

from fastapi import FastAPI
from fastapi.responses import RedirectResponse

from . import config
from .routes import router, ui_router


def _terminal_app() -> FastAPI | None:
    """Import OpenTerminalUI's app, or None if it isn't fetched."""
    root = config.TERMINAL_DIR
    if not (root / "backend" / "main.py").exists():
        return None
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    try:
        from backend.main import app  # type: ignore

        return app
    except Exception as exc:  # a broken terminal shouldn't sink the desk
        print(f"[desk] could not load OpenTerminalUI: {type(exc).__name__}: {exc}")
        return None


def _standalone() -> FastAPI:
    app = FastAPI(title="Terminal Desk", version="0.1.0")

    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse("/desk")

    return app


def _include_first(app: FastAPI, *routers) -> None:
    """Register our routers *ahead* of the terminal's SPA catch-all.

    OpenTerminalUI ends its route table with `@app.get("/{full_path:path}")`,
    which serves the React shell for anything it doesn't recognize. Starlette
    matches in registration order, so a route appended after it is dead on
    arrival — /desk would quietly return the terminal's landing page instead of
    ours, with a 200 that looks like success.

    We move by object identity, not by path: current FastAPI appends a lazy
    `_IncludedRouter` wrapper per include_router call rather than flattening the
    individual routes, so those entries have no `.path` to match on. Taking
    exactly the objects each call appended works whichever representation the
    installed FastAPI uses.

    Reordering is what keeps the no-fork promise — the alternative is editing
    their main.py, which is the merge pain we're avoiding.
    """
    for router_ in routers:
        before = len(app.router.routes)
        app.include_router(router_)
        added = app.router.routes[before:]
        del app.router.routes[before:]
        app.router.routes[0:0] = added


def create_app() -> FastAPI:
    config.load_env()
    app = _terminal_app()
    standalone = app is None
    if app is None:
        app = _standalone()

    if standalone:
        app.include_router(router)
        app.include_router(ui_router)
    else:
        _include_first(app, router, ui_router)

    # Note: /api/desk/* sits behind the terminal's AuthMiddleware, which guards
    # everything under /api. That's intentional — the desk inherits the
    # terminal's login rather than inventing a second one. The /desk page itself
    # is public and picks up the SPA's token from localStorage.
    app.state.desk_standalone = standalone
    return app


app = create_app()
