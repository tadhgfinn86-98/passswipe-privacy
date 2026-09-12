#!/usr/bin/env python3
"""Fetch and prepare the engines.

    python scripts/setup.py            # clone/update the four upstreams
    python scripts/setup.py --deps     # also install each engine's dependencies
    python scripts/setup.py --engine ai-hedge-fund --deps

Nothing here is vendored into this repository. Each upstream is cloned into
engines/ at the ref pinned in desk/config.py, keeping their licenses intact and
their histories separate — which matters most for ai-market-maker, whose AGPL
must not bleed into this tree.

Each engine gets its own virtualenv. They disagree about LangChain majors and
would fight in a shared one.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from desk import config  # noqa: E402


def run(command: list[str], cwd: Path | None = None, check: bool = True) -> int:
    printable = " ".join(command)
    location = f" (in {cwd})" if cwd else ""
    print(f"  $ {printable}{location}")
    result = subprocess.run(command, cwd=str(cwd) if cwd else None)
    if check and result.returncode != 0:
        raise SystemExit(f"failed: {printable}")
    return result.returncode


def clone_or_update(name: str, spec: dict[str, str]) -> Path:
    target = config.ENGINES_DIR / name
    if (target / ".git").exists():
        print(f"[{name}] already present — fetching")
        run(["git", "fetch", "--depth", "1", "origin", spec["ref"]], cwd=target, check=False)
        run(["git", "checkout", spec["ref"]], cwd=target, check=False)
        run(["git", "reset", "--hard", f"origin/{spec['ref']}"], cwd=target, check=False)
    else:
        print(f"[{name}] cloning {spec['url']}")
        config.ENGINES_DIR.mkdir(parents=True, exist_ok=True)
        run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                "--branch",
                spec["ref"],
                spec["url"],
                str(target),
            ]
        )
    return target


def have_uv() -> bool:
    try:
        subprocess.run(["uv", "--version"], capture_output=True, check=True)
        return True
    except (OSError, subprocess.CalledProcessError):
        return False


def make_venv(root: Path) -> Path:
    """Create the engine's venv, preferring uv — these are heavy dependency
    trees (torch, xgboost, three LangChain stacks) and pip takes minutes where
    uv takes seconds."""
    venv = root / ".venv"
    if venv.exists():
        return venv
    if have_uv():
        run(["uv", "venv", venv.name], cwd=root)
    else:
        run([sys.executable, "-m", "venv", str(venv)])
    return venv


def venv_python(venv: Path) -> Path:
    unix = venv / "bin" / "python"
    return unix if unix.exists() else venv / "Scripts" / "python.exe"


def install_requirements(root: Path, name: str) -> None:
    """Install one engine's dependencies, whatever it declares them in."""
    venv = make_venv(root)
    python = venv_python(venv)
    uv = have_uv()

    requirements = root / "backend" / "requirements.txt"
    pyproject = root / "pyproject.toml"

    if requirements.exists():
        if uv:
            run(["uv", "pip", "install", "--python", str(python), "-r", str(requirements)], check=False)
        else:
            run([str(python), "-m", "pip", "install", "-r", str(requirements)], check=False)
    elif pyproject.exists():
        if uv:
            run(["uv", "sync"], cwd=root, check=False)
        else:
            run([str(python), "-m", "pip", "install", "-e", "."], cwd=root, check=False)
    else:
        print(f"[{name}] no dependency manifest found — skipping")

    if name == "ai-market-maker":
        print(
            f"[{name}] note: needs TA-Lib, a C library pip cannot install.\n"
            "         macOS:  brew install ta-lib\n"
            "         Debian: apt-get install -y ta-lib   (or build from source)\n"
            "         conda:  conda install -y ta-lib -c conda-forge"
        )


def build_terminal_frontend(root: Path) -> None:
    """Build OpenTerminalUI's React bundle — without it the shell serves nothing."""
    frontend = root / "frontend"
    if not frontend.exists():
        return
    if (frontend / "dist" / "app.html").exists():
        print("[OpenTerminalUI] frontend already built")
        return
    print("[OpenTerminalUI] building frontend (this takes a minute)")
    run(["npm", "ci"], cwd=frontend, check=False)
    run(["npm", "run", "build"], cwd=frontend, check=False)


def prepare_terminal(root: Path) -> None:
    """Migrate and seed the terminal so the desk has a login to inherit."""
    python = venv_python(root / ".venv")
    if not python.exists():
        return
    env_file = root / ".env"
    if not env_file.exists() and (root / ".env.example").exists():
        import secrets

        text = (root / ".env.example").read_text(encoding="utf-8")
        for key, value in {
            "JWT_SECRET_KEY": secrets.token_hex(32),
            "CACHE_SIGNING_KEY": secrets.token_hex(32),
            "BOOTSTRAP_ADMIN_PASSWORD": secrets.token_hex(10),
        }.items():
            text = text.replace(f"{key}=\n", f"{key}={value}\n")
        env_file.write_text(text, encoding="utf-8")
        print("[OpenTerminalUI] wrote .env with generated secrets")

    env = {"PYTHONPATH": str(root)}
    import os

    merged = {**os.environ, **env}
    subprocess.run(
        [str(python), "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"],
        cwd=str(root),
        env=merged,
        check=False,
    )
    subprocess.run(
        [str(python), "scripts/seed_admin.py"], cwd=str(root), env=merged, check=False
    )
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith(("BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD")):
                print(f"  {line}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--engine", action="append", help="only this engine (repeatable)")
    parser.add_argument("--deps", action="store_true", help="also install dependencies")
    parser.add_argument("--skip-frontend", action="store_true", help="don't build the terminal UI")
    args = parser.parse_args()

    wanted = args.engine or list(config.PINS)
    unknown = [name for name in wanted if name not in config.PINS]
    if unknown:
        raise SystemExit(f"unknown engine(s): {', '.join(unknown)}")

    print(f"Engines directory: {config.ENGINES_DIR}\n")
    for name in wanted:
        spec = config.PINS[name]
        print(f"=== {name}  [{spec['license']}]")
        root = clone_or_update(name, spec)
        if args.deps:
            install_requirements(root, name)
            if name == "OpenTerminalUI":
                if not args.skip_frontend:
                    build_terminal_frontend(root)
                prepare_terminal(root)
        print()

    print("Done. Start the desk with:  python -m desk.serve")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
