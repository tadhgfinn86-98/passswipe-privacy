"""CRM SYNC - optional push of a lead to a Notion database.

Off by default. With `crm.use_notion: false` in config.yaml (or no token in
.env) the app is a complete CRM on its own - this is for when you want leads
visible on your phone or shared with someone else.

The tricky part of the Notion API is that every database has its own property
names and types, and sending a property that doesn't exist - or sending text
to a number column - fails the whole request. So rather than guessing your
schema, this module reads it first and sends only the properties you actually
have, coerced to the type you declared them as.
"""

from __future__ import annotations

from typing import Any, Optional

import requests

import config
from models import Lead

API_ROOT = "https://api.notion.com/v1"
# Pinned deliberately: Notion makes breaking changes between versions, and an
# unpinned integration breaks silently months later.
NOTION_VERSION = "2022-06-28"

# What we would like to send, keyed by the property name we look for in your
# database. Anything your database doesn't have is simply skipped, so you can
# start with just a title column and add more whenever you like.
def _desired_values(lead: Lead) -> dict[str, Any]:
    return {
        "Business": lead.business,
        "Name": lead.business,          # whatever your title column is called
        "Type": lead.type,
        "Area": lead.area,
        "Address": lead.address,
        "Phone": lead.phone,
        "Email": lead.email,
        "Website": lead.website,
        "Contact": lead.contact_name,
        "Score": lead.score,
        "Priority": lead.priority,
        "Lane": lead.suggested_lane,
        "Status": lead.status,
        "Independent": lead.independent,
        "Compliant": lead.compliant_yet,
        "Monthly spend": lead.est_monthly_spend,
        "Next action": lead.next_action,
        "Notes": lead.notes,
    }


def available(cfg: Optional[config.Config] = None) -> bool:
    """True when Notion is switched on AND configured."""
    cfg = cfg or config.load()
    return bool(cfg.get("crm.use_notion", False)
                and config.notion_token()
                and config.notion_database_id())


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {config.notion_token()}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def database_schema() -> dict[str, Any]:
    """Fetch the target database's properties. Raises on HTTP errors."""
    database_id = config.notion_database_id()
    response = requests.get(f"{API_ROOT}/databases/{database_id}",
                            headers=_headers(), timeout=30)
    response.raise_for_status()
    return response.json().get("properties", {})


def _coerce(value: Any, kind: str) -> Optional[dict[str, Any]]:
    """Shape one value into whatever Notion property type the column is.

    Returns None when the value is empty or the type isn't one we handle -
    the caller then omits the property entirely, which Notion accepts.
    """
    if value is None or value == "":
        return None
    text = str(value)

    if kind == "title":
        return {"title": [{"text": {"content": text[:2000]}}]}
    if kind == "rich_text":
        return {"rich_text": [{"text": {"content": text[:2000]}}]}
    if kind == "select":
        # Notion rejects commas in select option names.
        return {"select": {"name": text.replace(",", " ")[:100]}}
    if kind == "number":
        try:
            return {"number": float(value)}
        except (TypeError, ValueError):
            return None
    if kind == "email":
        return {"email": text}
    if kind == "phone_number":
        return {"phone_number": text}
    if kind == "url":
        # Notion rejects a URL without a scheme.
        return {"url": text if text.startswith(("http://", "https://")) else f"https://{text}"}
    if kind == "checkbox":
        return {"checkbox": str(value).lower() in ("y", "yes", "true", "1")}
    return None


def build_properties(lead: Lead, schema: dict[str, Any]) -> dict[str, Any]:
    """Match our values against your database's columns."""
    desired = _desired_values(lead)
    properties: dict[str, Any] = {}
    title_filled = False

    for name, definition in schema.items():
        kind = definition.get("type", "")
        if name not in desired:
            continue
        shaped = _coerce(desired[name], kind)
        if shaped is None:
            continue
        properties[name] = shaped
        if kind == "title":
            title_filled = True

    # Every Notion page needs a title. If your title column is named something
    # we didn't guess (say "Company"), fill it with the business name anyway.
    if not title_filled:
        for name, definition in schema.items():
            if definition.get("type") == "title":
                properties[name] = _coerce(lead.business, "title")
                break

    return properties


def push_lead(lead: Lead, cfg: Optional[config.Config] = None) -> dict[str, Any]:
    """Create one page in your Notion database.

    Returns {"ok": True, "url": ...} or {"ok": False, "error": ...}.
    Never raises - a CRM hiccup must not lose you the lead, which is safely
    in SQLite either way.
    """
    cfg = cfg or config.load()

    if not cfg.get("crm.use_notion", False):
        return {"ok": False, "error": "Notion is switched off. Set crm.use_notion: true "
                                      "in config.yaml to enable it."}
    if not config.notion_token() or not config.notion_database_id():
        return {"ok": False, "error": "NOTION_TOKEN or NOTION_DATABASE_ID missing from .env."}

    try:
        schema = database_schema()
    except requests.HTTPError as exc:
        code = exc.response.status_code if exc.response is not None else "?"
        if code == 404:
            return {"ok": False, "error": "Notion couldn't find that database. Check "
                                          "NOTION_DATABASE_ID, and make sure you shared the "
                                          "database with your integration (open the database "
                                          "→ ••• → Connections → add your integration)."}
        if code == 401:
            return {"ok": False, "error": "Notion rejected the token. Check NOTION_TOKEN."}
        return {"ok": False, "error": f"Notion error {code} while reading the database."}
    except requests.RequestException as exc:
        return {"ok": False, "error": f"Could not reach Notion: {exc}"}

    payload = {
        "parent": {"database_id": config.notion_database_id()},
        "properties": build_properties(lead, schema),
    }
    try:
        response = requests.post(f"{API_ROOT}/pages", json=payload,
                                 headers=_headers(), timeout=30)
        response.raise_for_status()
    except requests.HTTPError as exc:
        detail = ""
        if exc.response is not None:
            detail = exc.response.json().get("message", "")[:200]
        return {"ok": False, "error": f"Notion rejected the page. {detail}"}
    except requests.RequestException as exc:
        return {"ok": False, "error": f"Could not reach Notion: {exc}"}

    data = response.json()
    return {"ok": True, "url": data.get("url", ""), "id": data.get("id", ""),
            "sent_properties": sorted(payload["properties"])}
