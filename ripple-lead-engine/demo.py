#!/usr/bin/env python3
"""Run the whole pipeline offline against fixture data.

No API keys, no network, no cost. Use it to see the shape of the output and
to check a change end to end before pointing the real thing at live sources:

    python demo.py
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ripple.config import Config
from ripple.cli import _print_top
from ripple.outputs import csv_out
from ripple.pipeline import run as pipeline
from ripple.offline import DEMO_WEBSITES, OfflineClient


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(levelname)-7s %(name)s: %(message)s",
    )

    cfg = Config(
        companies_house_key="demo-key",     # the offline client ignores these
        google_places_key="demo-key",
        ea_carriers_csv="tests/fixtures/ea_carriers.csv",
        ea_sites_csv="tests/fixtures/ea_sites.csv",
        output_dir=Path("data/demo"),
        min_score_for_places=0,
    )

    leads = pipeline.run(
        cfg,
        towns=["Worcester"],
        include_clients=True,
        include_supply=True,
        client=OfflineClient(websites=DEMO_WEBSITES),
    )

    written = csv_out.write_all(leads, cfg.output_dir)
    _print_top(leads)
    print("Files written:")
    for label, path in written.items():
        print(f"  {label:12} {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
