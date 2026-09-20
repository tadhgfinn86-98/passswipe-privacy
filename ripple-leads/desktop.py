"""Ripple Leads as a desktop app.

Double-click `Ripple Leads.bat` (Windows) or run `python desktop.py`. You get a
normal application window - no terminal to keep open, no browser tab, no
localhost address to remember.

What it actually does, because the trick is worth understanding:

  1. Finds a free port on your machine.
  2. Starts Streamlit on it, hidden, listening only on 127.0.0.1 so nothing
     outside your laptop can reach it.
  3. Waits until the server says it is ready.
  4. Opens a native window pointed at it.
  5. When you close the window, stops the server and exits - no stray
     processes left running.

If pywebview isn't installed it falls back to opening your normal browser, so
the app still works either way.
"""

from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Optional

import requests

BASE_DIR = Path(__file__).resolve().parent
APP_FILE = BASE_DIR / "app.py"

WINDOW_TITLE = "Ripple Leads"
WINDOW_WIDTH = 1400
WINDOW_HEIGHT = 900
MIN_WIDTH = 900
MIN_HEIGHT = 600

# How long to wait for Streamlit to come up before giving up. Cold starts on a
# slow laptop can take a while; 60s is generous rather than optimistic.
STARTUP_TIMEOUT_S = 60
IS_WINDOWS = os.name == "nt"


def find_free_port() -> int:
    """Ask the operating system for a port nobody is using.

    Binding to port 0 makes the OS pick one, which avoids the classic bug of
    hardcoding 8501 and failing when you already have Streamlit open.
    """
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def health_url(port: int) -> str:
    """Streamlit's own readiness endpoint. Returns 'ok' once it can serve."""
    return f"http://127.0.0.1:{port}/_stcore/health"


def app_url(port: int) -> str:
    return f"http://127.0.0.1:{port}"


def streamlit_command(port: int) -> list[str]:
    """The command line we run Streamlit with.

    `sys.executable -m streamlit` rather than a bare `streamlit`, so it uses
    the same Python environment this launcher is running in - that is what
    stops "works in the terminal, not when I double-click it".
    """
    return [
        sys.executable, "-m", "streamlit", "run", str(APP_FILE),
        "--server.port", str(port),
        # Bind to loopback only. The app is for you, not your coffee shop's wifi.
        "--server.address", "127.0.0.1",
        # headless stops Streamlit opening its own browser tab and skips the
        # first-run email prompt, which would otherwise block startup.
        "--server.headless", "true",
        "--browser.gatherUsageStats", "false",
        "--server.fileWatcherType", "none",
    ]


def start_server(port: int) -> subprocess.Popen:
    """Launch Streamlit in the background."""
    kwargs: dict = {
        "cwd": str(BASE_DIR),
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
    }
    if IS_WINDOWS:
        # A new process group lets us kill Streamlit and anything it spawned.
        # CREATE_NO_WINDOW stops a console flashing up on screen.
        kwargs["creationflags"] = (subprocess.CREATE_NEW_PROCESS_GROUP
                                   | subprocess.CREATE_NO_WINDOW)
    else:
        # The POSIX equivalent: its own session, so we can signal the group.
        kwargs["start_new_session"] = True

    return subprocess.Popen(streamlit_command(port), **kwargs)


def wait_until_ready(port: int, process: Optional[subprocess.Popen] = None,
                     timeout_s: int = STARTUP_TIMEOUT_S) -> bool:
    """Poll until the server answers, or we run out of patience.

    Also watches the process itself: if Streamlit cannot run at all - the
    package is missing, the environment is wrong - there is no point waiting
    the full minute for a server that is never coming.

    Note that an error *inside* app.py does not land here. Streamlit starts
    fine and renders the traceback in the window, which is more useful than
    anything this launcher could print.
    """
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        if process is not None and process.poll() is not None:
            return False
        try:
            if requests.get(health_url(port), timeout=2).ok:
                return True
        except requests.RequestException:
            pass
        time.sleep(0.3)
    return False


def stop_server(process: Optional[subprocess.Popen]) -> None:
    """Shut Streamlit down, including anything it started.

    Terminating just the parent can leave orphans holding the port, which is
    why this signals the whole group and then escalates if it has to.
    """
    if process is None or process.poll() is not None:
        return

    try:
        if IS_WINDOWS:
            # /T takes the whole tree, /F does not ask nicely.
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(process.pid)],
                           capture_output=True, check=False)
        else:
            import signal

            os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except Exception:
        process.terminate()

    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


def main() -> int:
    if not APP_FILE.exists():
        print(f"Cannot find {APP_FILE}. Run this from the ripple-leads folder.")
        return 1

    port = find_free_port()
    print(f"Starting Ripple Leads on port {port}...")
    process = start_server(port)

    if not wait_until_ready(port, process):
        stop_server(process)
        print(
            "Ripple Leads failed to start.\n\n"
            "The usual causes:\n"
            "  - The environment isn't active. Run: conda activate ripple\n"
            "  - Dependencies are missing. Run: pip install -r requirements.txt\n\n"
            "To see the actual error, run this instead - it prints everything:\n"
            "  streamlit run app.py"
        )
        return 1

    try:
        import webview
    except ImportError:
        # No pywebview - still perfectly usable, just in a browser tab.
        import webbrowser

        print("pywebview isn't installed, so opening in your browser instead.")
        print("For a proper app window: pip install pywebview")
        print(f"\nRipple Leads is running at {app_url(port)}")
        print("Close this window or press Ctrl+C to quit.")
        webbrowser.open(app_url(port))
        try:
            process.wait()
        except KeyboardInterrupt:
            pass
        finally:
            stop_server(process)
        return 0

    try:
        webview.create_window(
            WINDOW_TITLE,
            app_url(port),
            width=WINDOW_WIDTH,
            height=WINDOW_HEIGHT,
            min_size=(MIN_WIDTH, MIN_HEIGHT),
        )
        webview.start()
    finally:
        # Runs whether the window was closed normally or something went wrong,
        # so the server never outlives the window.
        stop_server(process)

    return 0


if __name__ == "__main__":
    sys.exit(main())
