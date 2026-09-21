"""CSV output: the scored file you actually work from."""

from __future__ import annotations

import csv
import logging
from pathlib import Path

from ..models import CARRIER, CLIENT, CSV_COLUMNS, FACILITY, Lead
from ..pipeline import compliance, scoring

log = logging.getLogger(__name__)


def write(leads: list[Lead], path: Path) -> Path:
    """Write leads to one CSV, highest score first."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for lead in scoring.rank(leads):
            writer.writerow(lead.to_row())

    log.info("wrote %d rows to %s", len(leads), path)
    return path


def write_all(leads: list[Lead], output_dir: Path) -> dict[str, Path]:
    """Write the full set plus the queues you work from day to day.

    The queues are the point: clients.csv is research, email_queue.csv and
    call_queue.csv are today's work, already split by what PECR allows.
    """
    output_dir = Path(output_dir)
    clients = [lead for lead in leads if lead.category == CLIENT]
    carriers = [lead for lead in leads if lead.category in (CARRIER, FACILITY)]

    written = {
        "all": write(leads, output_dir / "leads.csv"),
        "clients": write(clients, output_dir / "clients.csv"),
        "carriers": write(carriers, output_dir / "carriers.csv"),
        "email_queue": write(compliance.email_safe(clients), output_dir / "email_queue.csv"),
        "call_queue": write(compliance.call_list(clients), output_dir / "call_queue.csv"),
    }
    return written
