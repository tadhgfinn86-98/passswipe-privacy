"""The native window.

pywebview wraps the OS's own web view — WebView2 on Windows, WKWebView on
macOS, WebKitGTK on Linux — so the app is a window rather than a browser tab,
without bundling a second copy of Chromium the way Electron would. The backend
is already running on localhost by the time this is called; this only draws the
frame around it.

If pywebview isn't installed the app falls back to the default browser rather
than failing. A window is nicer, not essential.
"""
from __future__ import annotations

import sys

WINDOW_TITLE = "Terminal Desk"
MIN_SIZE = (1100, 700)
DEFAULT_SIZE = (1500, 950)


def open_window(url: str) -> int:
    try:
        import webview  # type: ignore
    except ImportError:
        print(
            "[desk] pywebview not installed — opening in your browser instead.\n"
            "       For the native window:  pip install pywebview",
            file=sys.stderr,
        )
        import webbrowser

        webbrowser.open(url)
        _block_forever()
        return 0

    window = webview.create_window(
        WINDOW_TITLE,
        url,
        width=DEFAULT_SIZE[0],
        height=DEFAULT_SIZE[1],
        min_size=MIN_SIZE,
        background_color="#06080c",  # matches the terminal's ground, so no white flash
    )
    # Closing the window ends the process: the uvicorn thread is a daemon, so
    # there's nothing to wind down, and a lingering tray-less server would be
    # invisible and unkillable for a normal user.
    webview.start()
    return 0


def _block_forever() -> None:
    """Hold the process open when we've fallen back to a browser tab."""
    import threading

    try:
        threading.Event().wait()
    except KeyboardInterrupt:
        pass
