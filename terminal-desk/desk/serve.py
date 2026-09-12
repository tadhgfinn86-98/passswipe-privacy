"""Run the desk as a server.

    python -m desk.serve                 # http://127.0.0.1:8765
    python -m desk.serve --port 9000
    python -m desk.serve --desktop       # native window instead of a browser tab

Kept separate from app.py so importing the app (tests, a packaged build, an
external uvicorn invocation) never starts a server as a side effect.
"""
from __future__ import annotations

import argparse
import socket
import sys
import threading
import time
import urllib.request


def find_free_port(preferred: int) -> int:
    """Use the preferred port if it's free, else let the OS pick one.

    A desktop app that refuses to start because something else holds 8765 is a
    bad desktop app.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        try:
            probe.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


def wait_until_up(url: str, timeout: float = 45.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except Exception:
            time.sleep(0.35)
    return False


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Serve the Fund Desk.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--desktop", action="store_true", help="open a native window")
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args(argv)

    import uvicorn

    from .app import create_app

    port = find_free_port(args.port)
    if port != args.port:
        print(f"[desk] port {args.port} is busy — using {port}")
    url = f"http://{args.host}:{port}/desk"

    app = create_app()
    if getattr(app.state, "desk_standalone", False):
        print(
            "[desk] OpenTerminalUI is not installed — serving the desk alone.\n"
            "       Run scripts/setup.py to fetch the full terminal."
        )

    config = uvicorn.Config(app, host=args.host, port=port, log_level="info")
    server = uvicorn.Server(config)

    if args.desktop:
        thread = threading.Thread(target=server.run, daemon=True)
        thread.start()
        if not wait_until_up(url):
            print("[desk] server did not come up in time", file=sys.stderr)
            return 1
        from .desktop import open_window

        return open_window(url)

    if not args.no_browser:
        threading.Thread(
            target=lambda: wait_until_up(url) and _open_browser(url), daemon=True
        ).start()
    server.run()
    return 0


def _open_browser(url: str) -> None:
    import webbrowser

    webbrowser.open(url)


if __name__ == "__main__":
    raise SystemExit(main())
