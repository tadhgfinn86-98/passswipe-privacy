#!/usr/bin/env python3
"""Start the desk with the right interpreter.

    python run.py              # browser tab
    python run.py --desktop    # native window

The desk imports OpenTerminalUI's FastAPI app, so it has to run in an
interpreter that can see the terminal's dependencies. That's the venv
scripts/setup.py builds at engines/OpenTerminalUI/.venv — not whatever python
you happen to type here.

Rather than making that your problem, this finds that interpreter and re-execs
into it, passing your arguments through. Run it with any python you like.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TERMINAL_VENV = ROOT / "engines" / "OpenTerminalUI" / ".venv"


def venv_python(venv: Path) -> Path | None:
    for candidate in (venv / "bin" / "python", venv / "Scripts" / "python.exe"):
        if candidate.exists():
            return candidate
    return None


def has_dependencies(python: Path) -> bool:
    probe = subprocess.run(
        [str(python), "-c", "import fastapi, uvicorn, pydantic"],
        capture_output=True,
    )
    return probe.returncode == 0


def main() -> int:
    args = sys.argv[1:]
    python = venv_python(TERMINAL_VENV)

    if python is None:
        print(
            "The terminal's environment isn't set up yet.\n"
            "  Run:  python scripts/setup.py --deps\n",
            file=sys.stderr,
        )
        # Still try the current interpreter — the desk serves standalone
        # without the terminal, which is better than refusing to start.
        python = Path(sys.executable)

    if not has_dependencies(python):
        print(
            f"{python} is missing fastapi/uvicorn/pydantic.\n"
            f"  Run:  {python} -m pip install -r requirements.txt\n",
            file=sys.stderr,
        )
        return 1

    env = {**os.environ, "PYTHONPATH": str(ROOT)}
    return subprocess.run(
        [str(python), "-m", "desk.serve", *args], cwd=str(ROOT), env=env
    ).returncode


if __name__ == "__main__":
    raise SystemExit(main())
