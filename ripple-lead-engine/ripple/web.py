"""Local web app: run the lead engine from a browser.

    python -m ripple.web

Starts a small server on localhost and opens a browser at it. The pipeline
still runs here, server-side, because that is where the API keys live and
where a browser tab could not do the work anyway: the official APIs do not
send CORS headers, and the website enricher has to read pages cross-origin.

Deliberately built on the standard library, so the browser UI adds no
dependency beyond the `requests` the pipeline already needed.

Security: binds to 127.0.0.1 only, checks the Host header, and never sends
API keys to the page - it reports only whether each one is set.
"""

from __future__ import annotations

import json
import logging
import mimetypes
import socket
import threading
import webbrowser
from collections import deque
from dataclasses import dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from .config import Config, DEFAULT_AREAS
from .models import CARRIER, CLIENT, FACILITY, Lead
from .offline import OfflineClient, demo_paths
from .outputs import csv_out
from .pipeline import compliance, run as pipeline

log = logging.getLogger(__name__)

WEBUI_DIR = Path(__file__).parent / "webui"
MAX_LOG_LINES = 500
ALLOWED_HOSTS = {"localhost", "127.0.0.1", "[::1]"}


@dataclass
class RunState:
    """Everything the browser needs to know about the current run."""

    status: str = "idle"          # idle | running | done | error | cancelled
    stage: str = ""
    stage_index: int = 0
    stage_total: int = len(pipeline.STAGES)
    message: str = ""
    logs: deque = field(default_factory=lambda: deque(maxlen=MAX_LOG_LINES))
    leads: list[Lead] = field(default_factory=list)
    output_dir: str = ""
    files: dict[str, str] = field(default_factory=dict)
    demo: bool = False
    cancel_requested: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)

    def reset(self, demo: bool) -> None:
        with self.lock:
            self.status = "running"
            self.stage = "starting"
            self.stage_index = 0
            self.message = ""
            self.logs.clear()
            self.leads = []
            self.files = {}
            self.output_dir = ""
            self.demo = demo
            self.cancel_requested = False

    def snapshot(self) -> dict:
        with self.lock:
            return {
                "status": self.status,
                "stage": self.stage,
                "stageIndex": self.stage_index,
                "stageTotal": self.stage_total,
                "message": self.message,
                "logs": list(self.logs),
                "demo": self.demo,
                "outputDir": self.output_dir,
                "files": dict(self.files),
                "counts": _counts(self.leads),
                "leads": [_lead_json(lead) for lead in self.leads],
            }


STATE = RunState()


class _StateLogHandler(logging.Handler):
    """Feeds pipeline log records to the browser."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            STATE.logs.append({
                "level": record.levelname.lower(),
                "name": record.name.replace("ripple.", ""),
                "text": record.getMessage(),
            })
        except Exception:  # noqa: BLE001 - logging must never break a run
            pass


def _counts(leads: list[Lead]) -> dict:
    clients = [lead for lead in leads if lead.category == CLIENT]
    return {
        "all": len(leads),
        "clients": len(clients),
        "carriers": len([l for l in leads if l.category in (CARRIER, FACILITY)]),
        "email_queue": len(compliance.email_safe(clients)),
        "call_queue": len(compliance.call_list(clients)),
    }


def _lead_json(lead: Lead) -> dict:
    row = lead.to_row()
    return {
        "id": lead.lead_id,
        "score": lead.score,
        "category": lead.category,
        "name": lead.name,
        "businessType": lead.business_type,
        "postcode": lead.postcode,
        "town": lead.town,
        "phone": lead.phone,
        "email": lead.email,
        "website": lead.website,
        "channel": lead.outreach_channel,
        "pecr": lead.pecr_status,
        "companyNumber": lead.company_number,
        "companyType": lead.company_type,
        "yearsTrading": lead.years_trading,
        "directors": row["directors"],
        "reviewCount": lead.review_count,
        "rating": lead.google_rating,
        "eaTier": lead.ea_tier,
        "eaRegistration": lead.ea_registration,
        "distance": lead.distance_miles,
        "breakdown": lead.score_breakdown,
        "sources": row["sources"],
        "emailSafe": lead.outreach_channel == compliance.EMAIL_OK and bool(lead.email),
        "callable": lead.outreach_channel == compliance.PHONE_POST and bool(lead.phone),
    }


def _config_from_request(payload: dict) -> tuple[Config, dict]:
    """Build a Config from the browser's form, keeping secrets server-side."""
    demo = bool(payload.get("demo"))

    overrides = {
        "areas": [a.strip().upper() for a in payload.get("areas", DEFAULT_AREAS) if a.strip()],
        "radius_miles": float(payload.get("radius", 30) or 30),
        "use_google_places": bool(payload.get("usePlaces", False)),
        "enrich_websites": bool(payload.get("useWebsites", True)),
        "use_companies_house": bool(payload.get("useCompaniesHouse", True)),
        "max_places_lookups": int(payload.get("maxPlaces", 200) or 200),
        "max_website_fetches": int(payload.get("maxWebsites", 300) or 300),
        "output_dir": Path(payload.get("outputDir") or "data/out/web"),
        "ea_carriers_csv": payload.get("eaCarriersCsv", "") or "",
        "ea_sites_csv": payload.get("eaSitesCsv", "") or "",
    }

    cfg = Config.from_env(**overrides)

    if demo:
        # Demo mode runs against the bundled sample data with stand-in keys,
        # so the whole pipeline exercises without network or spend.
        paths = demo_paths()
        cfg.ea_carriers_csv = paths["ea_carriers_csv"]
        cfg.ea_sites_csv = paths["ea_sites_csv"]
        cfg.companies_house_key = cfg.companies_house_key or "demo"
        cfg.google_places_key = cfg.google_places_key or "demo"
        cfg.use_google_places = True
        cfg.min_score_for_places = 0
        cfg.output_dir = Path("data/out/demo")

    return cfg, {
        "mode": payload.get("mode", "clients"),
        "towns": [t.strip() for t in payload.get("towns", ["Worcester"]) if t.strip()] or ["Worcester"],
        "geocode": bool(payload.get("geocode", True)),
        "minScore": int(payload.get("minScore", 0) or 0),
        "demo": demo,
    }


def _run_pipeline(cfg: Config, options: dict) -> None:
    """Executed on a worker thread; updates STATE as it goes."""
    handler = _StateLogHandler()
    root = logging.getLogger("ripple")
    root.addHandler(handler)
    previous_level = root.level
    root.setLevel(logging.INFO)

    def on_stage(name: str, index: int, total: int) -> None:
        with STATE.lock:
            STATE.stage = name
            STATE.stage_index = index
            STATE.stage_total = total

    try:
        client = None
        if options["demo"]:
            client = OfflineClient()
        else:
            client = pipeline.build_client(cfg, should_stop=lambda: STATE.cancel_requested)

        leads = pipeline.run(
            cfg,
            towns=options["towns"],
            include_clients=options["mode"] in ("clients", "all"),
            include_supply=options["mode"] in ("carriers", "all"),
            geocode=options["geocode"],
            client=client,
            on_stage=on_stage,
        )

        if options["minScore"]:
            leads = [lead for lead in leads if lead.score >= options["minScore"]]

        files = {}
        if leads:
            written = csv_out.write_all(leads, cfg.output_dir)
            files = {label: str(path) for label, path in written.items()}

        with STATE.lock:
            STATE.leads = leads
            STATE.files = files
            STATE.output_dir = str(cfg.output_dir)
            if STATE.cancel_requested:
                STATE.status = "cancelled"
                STATE.message = f"Stopped. {len(leads)} leads kept from the work already done."
            else:
                STATE.status = "done"
                STATE.message = (
                    f"{len(leads)} leads." if leads
                    else "No leads. Check the log: a source may be unreachable or unconfigured."
                )
    except Exception as exc:  # noqa: BLE001 - surface any failure in the UI
        log.exception("run failed")
        with STATE.lock:
            STATE.status = "error"
            STATE.message = f"{type(exc).__name__}: {exc}"
    finally:
        root.removeHandler(handler)
        root.setLevel(previous_level)


class Handler(BaseHTTPRequestHandler):
    server_version = "RippleLeadEngine"

    # -- helpers ---------------------------------------------------------

    def _host_ok(self) -> bool:
        host = (self.headers.get("Host") or "").split(":")[0]
        return host in ALLOWED_HOSTS

    def _send(self, code: int, body: bytes, content_type: str) -> None:
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _json(self, payload: dict, code: int = 200) -> None:
        self._send(code, json.dumps(payload).encode(), "application/json; charset=utf-8")

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            return {}

    def log_message(self, fmt, *args):  # quieter console
        log.debug("%s - %s", self.address_string(), fmt % args)

    # -- routes ----------------------------------------------------------

    def do_GET(self):  # noqa: N802
        if not self._host_ok():
            self._json({"error": "bad host"}, 403)
            return

        path = urlparse(self.path).path

        if path == "/":
            self._serve_file(WEBUI_DIR / "index.html")
        elif path.startswith("/static/"):
            name = Path(path).name
            self._serve_file(WEBUI_DIR / name)
        elif path == "/favicon.ico":
            # The page carries an inline icon; answer directly so a stray
            # request never shows up as a 404 in the console.
            self._send(204, b"", "image/svg+xml")
        elif path == "/api/state":
            self._json(STATE.snapshot())
        elif path == "/api/settings":
            self._json(_settings())
        elif path.startswith("/api/download/"):
            self._download(Path(path).name)
        else:
            self._json({"error": "not found"}, 404)

    def do_POST(self):  # noqa: N802
        if not self._host_ok():
            self._json({"error": "bad host"}, 403)
            return

        path = urlparse(self.path).path

        if path == "/api/run":
            if STATE.status == "running":
                self._json({"error": "a run is already in progress"}, 409)
                return
            payload = self._read_json()
            try:
                cfg, options = _config_from_request(payload)
            except (TypeError, ValueError) as exc:
                self._json({"error": f"bad settings: {exc}"}, 400)
                return

            STATE.reset(demo=options["demo"])
            threading.Thread(
                target=_run_pipeline, args=(cfg, options), daemon=True,
            ).start()
            self._json({"started": True})

        elif path == "/api/cancel":
            with STATE.lock:
                STATE.cancel_requested = True
            self._json({"cancelling": True})

        elif path == "/api/shutdown":
            self._json({"stopping": True})
            threading.Thread(target=self.server.shutdown, daemon=True).start()

        else:
            self._json({"error": "not found"}, 404)

    # -- static and downloads --------------------------------------------

    def _serve_file(self, path: Path) -> None:
        # Resolve and confirm the file is inside the UI directory, so a
        # crafted path can never read outside it.
        try:
            resolved = path.resolve()
            resolved.relative_to(WEBUI_DIR.resolve())
        except (ValueError, OSError):
            self._json({"error": "not found"}, 404)
            return
        if not resolved.is_file():
            self._json({"error": "not found"}, 404)
            return

        content_type = mimetypes.guess_type(resolved.name)[0] or "application/octet-stream"
        self._send(200, resolved.read_bytes(), f"{content_type}; charset=utf-8")

    def _download(self, name: str) -> None:
        """Serve one of the CSVs this run wrote, by its label."""
        with STATE.lock:
            files = dict(STATE.files)

        label = name.removesuffix(".csv")
        target = files.get(label)
        if not target:
            self._json({"error": "no such file in the current run"}, 404)
            return

        path = Path(target)
        if not path.is_file():
            self._json({"error": "file missing on disk"}, 404)
            return

        body = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{label}.csv"')
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def _settings() -> dict:
    """What the page needs to render: defaults, and which keys are present.

    Reports only whether each key is set. The keys themselves stay here.
    """
    cfg = Config.from_env()
    return {
        "defaultAreas": DEFAULT_AREAS,
        "defaultTowns": ["Worcester", "Droitwich", "Malvern"],
        "keys": {
            "companiesHouse": bool(cfg.companies_house_key),
            "googlePlaces": bool(cfg.google_places_key),
            "airtable": bool(cfg.airtable_key and cfg.airtable_base),
            "notion": bool(cfg.notion_token and cfg.notion_database),
        },
        "stages": pipeline.STAGES,
    }


def _free_port(preferred: int) -> int:
    """Use the preferred port if it is free, otherwise let the OS pick one."""
    with socket.socket() as probe:
        try:
            probe.bind(("127.0.0.1", preferred))
            return preferred
        except OSError:
            pass
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return probe.getsockname()[1]


def serve(port: int = 8765, open_browser: bool = True) -> None:
    port = _free_port(port)
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    url = f"http://127.0.0.1:{port}/"

    print(f"\n  Ripple lead engine is running at {url}")
    print("  Press Ctrl-C to stop.\n")

    if open_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopping.")
    finally:
        server.server_close()


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(
        prog="ripple.web", description="Run the lead engine from a browser."
    )
    parser.add_argument("--port", type=int, default=8765, help="port (default: 8765)")
    parser.add_argument("--no-browser", action="store_true", help="do not open a browser")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    serve(port=args.port, open_browser=not args.no_browser)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
