"""Push leads into an Airtable base.

Upserts on lead_id so a nightly run updates existing rows instead of piling
up duplicates. Airtable takes at most 10 records per request.
"""

from __future__ import annotations

import logging

from ..config import Config
from ..http_client import HttpClient
from ..models import Lead

log = logging.getLogger(__name__)

BATCH_SIZE = 10

# Only the fields worth having in a CRM view; the CSV keeps everything.
FIELDS = [
    "lead_id", "score", "category", "name", "business_type", "postcode", "town",
    "address", "phone", "email", "website", "outreach_channel", "pecr_status",
    "company_number", "company_type", "years_trading", "directors", "fsa_rating",
    "review_count", "ea_registration", "ea_tier", "distance_miles", "sources",
]


def push(client: HttpClient, cfg: Config, leads: list[Lead]) -> int:
    """Upsert leads. Returns how many records were sent."""
    if not (cfg.airtable_key and cfg.airtable_base):
        log.info("airtable: not configured, skipping")
        return 0

    url = f"https://api.airtable.com/v0/{cfg.airtable_base}/{cfg.airtable_table}"
    headers = {
        "Authorization": f"Bearer {cfg.airtable_key}",
        "Content-Type": "application/json",
    }

    sent = 0
    for start in range(0, len(leads), BATCH_SIZE):
        batch = leads[start : start + BATCH_SIZE]
        body = {
            "performUpsert": {"fieldsToMergeOn": ["lead_id"]},
            "records": [{"fields": _fields(lead)} for lead in batch],
            "typecast": True,
        }
        response = client.send_json("PATCH", url, body=body, headers=headers)
        if response is None:
            log.warning("airtable: batch starting at %d failed", start)
            continue
        sent += len(batch)

    log.info("airtable: upserted %d records", sent)
    return sent


def _fields(lead: Lead) -> dict:
    row = lead.to_row()
    fields = {key: row.get(key) for key in FIELDS}
    # Airtable rejects None for numeric fields; drop empties instead.
    return {k: v for k, v in fields.items() if v not in (None, "")}
