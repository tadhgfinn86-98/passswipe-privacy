"""Push leads into a Notion database.

Notion has no upsert, so we query for an existing page with the same lead_id
and update it, otherwise create one. That costs an extra request per lead,
which is fine at the volumes this pipeline produces.

The target database needs these properties:
  Name (title), lead_id (text), Score (number), Category (select),
  Business Type (text), Postcode (text), Phone (phone), Email (email),
  Website (url), Outreach Channel (select), PECR Status (select),
  Company Number (text), Sources (text)
"""

from __future__ import annotations

import logging

from ..config import Config
from ..http_client import HttpClient
from ..models import Lead

log = logging.getLogger(__name__)

API = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def push(client: HttpClient, cfg: Config, leads: list[Lead]) -> int:
    if not (cfg.notion_token and cfg.notion_database):
        log.info("notion: not configured, skipping")
        return 0

    headers = {
        "Authorization": f"Bearer {cfg.notion_token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }

    written = 0
    for lead in leads:
        page_id = _find_page(client, cfg, headers, lead)
        properties = _properties(lead)
        if page_id:
            response = client.send_json(
                "PATCH", f"{API}/pages/{page_id}",
                body={"properties": properties}, headers=headers,
            )
        else:
            response = client.send_json(
                "POST", f"{API}/pages",
                body={
                    "parent": {"database_id": cfg.notion_database},
                    "properties": properties,
                },
                headers=headers,
            )
        if response is not None:
            written += 1

    log.info("notion: wrote %d pages", written)
    return written


def _find_page(client: HttpClient, cfg: Config, headers: dict, lead: Lead) -> str | None:
    payload = client.post_json(
        f"{API}/databases/{cfg.notion_database}/query",
        body={
            "filter": {"property": "lead_id", "rich_text": {"equals": lead.lead_id}},
            "page_size": 1,
        },
        headers=headers,
        use_cache=False,
    )
    if not payload:
        return None
    results = payload.get("results") or []
    return results[0]["id"] if results else None


def _text(value: str) -> dict:
    return {"rich_text": [{"text": {"content": str(value)[:2000]}}]} if value else {"rich_text": []}


def _properties(lead: Lead) -> dict:
    row = lead.to_row()
    properties = {
        "Name": {"title": [{"text": {"content": lead.name[:2000] or "(unnamed)"}}]},
        "lead_id": _text(lead.lead_id),
        "Score": {"number": lead.score},
        "Category": {"select": {"name": lead.category}},
        "Business Type": _text(lead.business_type),
        "Postcode": _text(lead.postcode),
        "Company Number": _text(lead.company_number),
        "Sources": _text(row["sources"]),
    }
    if lead.phone:
        properties["Phone"] = {"phone_number": lead.phone}
    if lead.email:
        properties["Email"] = {"email": lead.email}
    if lead.website:
        properties["Website"] = {"url": lead.website}
    if lead.outreach_channel:
        properties["Outreach Channel"] = {"select": {"name": lead.outreach_channel}}
    if lead.pecr_status:
        properties["PECR Status"] = {"select": {"name": lead.pecr_status}}
    return properties
