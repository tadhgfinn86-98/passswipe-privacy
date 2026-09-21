"""Food Standards Agency hygiene ratings.

Free, no key, and it lists every registered food business with name, address
and business type. For the restaurant niche this is close to a complete
census of the demand side.

API docs: https://api.ratings.food.gov.uk/help
"""

from __future__ import annotations

import logging

from ..config import Config
from ..http_client import HttpClient
from ..models import CLIENT, Lead

log = logging.getLogger(__name__)

BASE_URL = "https://api.ratings.food.gov.uk"
HEADERS = {"x-api-version": "2", "accept": "application/json"}


def fetch(client: HttpClient, cfg: Config, towns: list[str] | None = None) -> list[Lead]:
    """Pull establishments for each town and map them to Leads."""
    towns = towns or ["Worcester"]
    leads: list[Lead] = []
    for town in towns:
        establishments = _fetch_town(client, cfg, town)
        log.info("fsa: %d establishments for %s", len(establishments), town)
        leads.extend(_to_lead(e) for e in establishments)
    return [lead for lead in leads if lead.name]


def _fetch_town(client: HttpClient, cfg: Config, town: str) -> list[dict]:
    """Page through /Establishments for one town."""
    collected: list[dict] = []
    for page in range(1, cfg.max_fsa_pages + 1):
        payload = client.get_json(
            f"{BASE_URL}/Establishments",
            params={
                "address": town,
                "pageSize": cfg.fsa_page_size,
                "pageNumber": page,
            },
            headers=HEADERS,
        )
        if not payload:
            break
        batch = payload.get("establishments") or []
        collected.extend(batch)

        meta = payload.get("meta") or {}
        total = _as_int(meta.get("totalCount"))
        if len(batch) < cfg.fsa_page_size:
            break
        if total is not None and len(collected) >= total:
            break
    return collected


def _to_lead(entry: dict) -> Lead:
    """Map one FSA establishment record onto a Lead."""
    address_parts = [
        (entry.get(f"AddressLine{i}") or "").strip() for i in range(1, 5)
    ]
    address_parts = [part for part in address_parts if part]

    town, street = _split_address(address_parts)

    lat, lon = _geocode(entry.get("geocode"))

    return Lead(
        name=(entry.get("BusinessName") or "").strip(),
        category=CLIENT,
        address=street,
        town=town,
        postcode=entry.get("PostCode") or "",
        latitude=lat,
        longitude=lon,
        phone=(entry.get("PhoneNumber") or "").strip(),
        business_type=(entry.get("BusinessType") or "").strip(),
        fsa_id=str(entry.get("FHRSID") or ""),
        fsa_rating=str(entry.get("RatingValue") or ""),
        sources=["fsa"],
    )


# Counties are not towns, but the FSA often puts one in the last address line.
_COUNTY_SUFFIXES = ("shire", "county")
_COUNTIES = {"worcestershire", "herefordshire", "gloucestershire", "west midlands",
             "warwickshire", "shropshire", "staffordshire"}


def _split_address(parts: list[str]) -> tuple[str, str]:
    """Split FSA address lines into (town, street).

    The FSA puts the town in whichever line it happens to land in, and often
    follows it with a county. Walk backwards past any county to find the town.
    """
    if not parts:
        return "", ""
    if len(parts) == 1:
        return "", parts[0]

    town_index = len(parts) - 1
    while town_index > 0 and _looks_like_county(parts[town_index]):
        town_index -= 1

    town = parts[town_index]
    street = ", ".join(parts[:town_index])
    return town, street


def _looks_like_county(line: str) -> bool:
    lowered = line.strip().lower()
    return lowered in _COUNTIES or lowered.endswith(_COUNTY_SUFFIXES)


def _geocode(geocode: dict | None) -> tuple[float | None, float | None]:
    """FSA returns coordinates as strings, and sometimes as nulls."""
    if not isinstance(geocode, dict):
        return None, None
    try:
        lat = geocode.get("latitude")
        lon = geocode.get("longitude")
        if lat in (None, "") or lon in (None, ""):
            return None, None
        return float(lat), float(lon)
    except (TypeError, ValueError):
        return None, None


def _as_int(value) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None
