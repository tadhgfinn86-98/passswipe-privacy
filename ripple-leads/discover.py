"""DISCOVER - find food & hospitality businesses near your towns.

Default provider is OpenStreetMap via the Overpass API: free, no key, no
sign-up. OSM is crowd-sourced, so coverage is good for pubs and restaurants
and patchier for small takeaways - treat a pull as a starting list, not a
census.

A second provider (Google Places) is written but switched off in config.yaml.
It is a paid API and needs a key; OSM alone is enough to run the business.

Nothing here scrapes a website. Both providers are official APIs.
"""

from __future__ import annotations

import time
from typing import Any, Callable, Optional

import requests

import config
from models import Lead, amenity_to_type

# Overpass asks for a descriptive User-Agent so they can contact heavy users
# rather than just blocking them.
USER_AGENT = "RippleLeads/1.0 (commercial waste brokerage lead tool; contact via app owner)"

# OSM tags that can hold each piece of contact data, in priority order.
PHONE_TAGS = ["phone", "contact:phone", "contact:mobile", "mobile"]
WEBSITE_TAGS = ["website", "contact:website", "url", "contact:facebook"]
EMAIL_TAGS = ["email", "contact:email"]


def build_overpass_query(lat: float, lon: float, radius_m: int,
                         amenities: list[str], timeout_s: int) -> str:
    """Build an Overpass QL query for one town.

    `nwr` means nodes, ways and relations - a pub might be mapped as a single
    point or as a building outline, and we want both. `out center tags` gives
    us the tags plus one representative coordinate per result.
    """
    pattern = "|".join(amenities)
    return f"""
[out:json][timeout:{timeout_s}];
nwr["amenity"~"^({pattern})$"](around:{radius_m},{lat},{lon});
out center tags;
""".strip()


def _first_tag(tags: dict[str, str], keys: list[str]) -> str:
    for key in keys:
        value = (tags.get(key) or "").strip()
        if value:
            return value
    return ""


def _build_address(tags: dict[str, str]) -> tuple[str, str, str]:
    """Return (full_address, street, postcode) from OSM addr:* tags."""
    house = (tags.get("addr:housenumber") or "").strip()
    street = (tags.get("addr:street") or "").strip()
    city = (tags.get("addr:city") or tags.get("addr:town") or "").strip()
    postcode = (tags.get("addr:postcode") or "").strip()

    line = " ".join(p for p in [house, street] if p)
    full = ", ".join(p for p in [line, city, postcode] if p)
    return full, street, postcode


def _looks_like_chain(tags: dict[str, str]) -> str:
    """Cheap, deterministic chain detection from OSM tags.

    A `brand` or `brand:wikidata` tag means a mapper linked this site to a
    recognised brand - Costa, Greggs, Wetherspoon. That is strong enough to
    call it 'not independent' without asking an AI. Absence of the tag proves
    nothing, so we return "unknown" rather than "Y".
    """
    if tags.get("brand") or tags.get("brand:wikidata") or tags.get("operator:wikidata"):
        return "N"
    return "unknown"


def parse_element(element: dict[str, Any], town_name: str) -> Optional[Lead]:
    """Turn one Overpass result into a Lead, or None if it isn't usable."""
    tags = element.get("tags") or {}
    name = (tags.get("name") or "").strip()
    if not name:
        # Unnamed nodes are no use for outreach - you can't ring "a cafe".
        return None

    full_address, street, postcode = _build_address(tags)
    city = (tags.get("addr:city") or tags.get("addr:town") or "").strip()

    return Lead(
        business=name,
        type=amenity_to_type(tags.get("amenity", "")),
        # Prefer the town we searched from: OSM's addr:city is often a parish
        # rather than the town you'd actually drive to.
        area=town_name or city,
        address=full_address,
        street=street,
        postcode=postcode,
        phone=_first_tag(tags, PHONE_TAGS),
        website=_first_tag(tags, WEBSITE_TAGS),
        email=_first_tag(tags, EMAIL_TAGS),
        independent=_looks_like_chain(tags),
        source="osm",
        external_id=f"{element.get('type', 'node')}/{element.get('id', '')}",
    )


def fetch_town(town: dict[str, Any], cfg: Optional[config.Config] = None) -> list[Lead]:
    """Run one Overpass query and return parsed leads. Raises on HTTP errors."""
    cfg = cfg or config.load()
    url = cfg.get("discovery.overpass_url", "https://overpass-api.de/api/interpreter")
    timeout_s = int(cfg.get("discovery.timeout_s", 180))
    amenities = cfg.get("discovery.amenities", ["restaurant", "cafe", "pub", "fast_food", "bar"])

    query = build_overpass_query(
        lat=float(town["lat"]),
        lon=float(town["lon"]),
        radius_m=int(town.get("radius_m", 8000)),
        amenities=amenities,
        timeout_s=timeout_s,
    )

    response = requests.post(
        url,
        data={"data": query},
        headers={"User-Agent": USER_AGENT},
        # The HTTP timeout is deliberately longer than the Overpass timeout,
        # so the server gets a chance to answer before requests gives up.
        timeout=timeout_s + 30,
    )
    response.raise_for_status()
    payload = response.json()

    leads: list[Lead] = []
    for element in payload.get("elements", []):
        lead = parse_element(element, town["name"])
        if lead is not None:
            leads.append(lead)
    return leads


def run_discovery(town_names: Optional[list[str]] = None,
                  progress: Optional[Callable[[str], None]] = None,
                  cfg: Optional[config.Config] = None) -> dict[str, Any]:
    """Pull every configured town (or just the ones named) and save new leads.

    Returns a summary dict the dashboard renders. A failure in one town is
    recorded and the run continues with the next - one flaky Overpass mirror
    shouldn't lose you three towns' worth of leads.
    """
    import db  # imported here to keep this module importable without a database

    cfg = cfg or config.load()
    towns = cfg.towns
    if town_names:
        towns = [t for t in towns if t["name"] in town_names]

    pause = float(cfg.get("discovery.pause_between_towns_s", 3))
    summary: dict[str, Any] = {
        "per_town": [], "inserted": 0, "duplicates": 0, "found": 0, "errors": [],
    }

    for index, town in enumerate(towns):
        label = town["name"]
        if progress:
            progress(f"Querying OpenStreetMap for {label}...")
        try:
            leads = fetch_town(town, cfg)
        except Exception as exc:  # network error, Overpass overloaded, bad JSON
            summary["errors"].append(f"{label}: {exc}")
            if progress:
                progress(f"{label} failed: {exc}")
            continue

        result = db.insert_many(leads)
        summary["per_town"].append({
            "town": label,
            "found": len(leads),
            "inserted": result["inserted"],
            "duplicates": result["duplicates"],
        })
        summary["found"] += len(leads)
        summary["inserted"] += result["inserted"]
        summary["duplicates"] += result["duplicates"]

        if progress:
            progress(f"{label}: {len(leads)} found, {result['inserted']} new")

        # Be a good citizen on a free shared endpoint.
        if pause and index < len(towns) - 1:
            time.sleep(pause)

    return summary


# --- Optional paid provider -------------------------------------------------

def google_places_available(cfg: Optional[config.Config] = None) -> bool:
    cfg = cfg or config.load()
    return bool(cfg.get("discovery.use_google_places", False)) and bool(config.google_places_key())


def fetch_google_places(town: dict[str, Any], cfg: Optional[config.Config] = None) -> list[Lead]:
    """Places API (New) Nearby Search.

    OFF by default. This costs money per request and returns at most 20 places
    per call, so it is a top-up for OSM rather than a replacement. Places never
    returns an email address.
    """
    cfg = cfg or config.load()
    key = config.google_places_key()
    if not key:
        raise RuntimeError("GOOGLE_PLACES_API_KEY is not set in .env")

    # Places API (New) requires an explicit field mask - you are billed by
    # which fields you ask for, so ask for the cheapest set that works.
    field_mask = ",".join([
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.nationalPhoneNumber",
        "places.websiteUri",
        "places.primaryType",
    ])
    body = {
        "includedTypes": ["restaurant", "cafe", "bar"],
        "maxResultCount": 20,
        "locationRestriction": {
            "circle": {
                "center": {"latitude": float(town["lat"]), "longitude": float(town["lon"])},
                "radius": float(cfg.get("discovery.google_places_radius_m", 5000)),
            }
        },
    }
    response = requests.post(
        "https://places.googleapis.com/v1/places:searchNearby",
        json=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": field_mask,
        },
        timeout=30,
    )
    response.raise_for_status()

    type_map = {
        "restaurant": "Restaurant", "cafe": "Cafe", "bar": "Bar",
        "meal_takeaway": "Takeaway", "meal_delivery": "Takeaway", "pub": "Pub",
    }
    leads: list[Lead] = []
    for place in response.json().get("places", []):
        name = (place.get("displayName") or {}).get("text", "").strip()
        if not name:
            continue
        address = place.get("formattedAddress", "")
        # Places gives one formatted string; take the first comma-separated
        # chunk as the street so the dedupe key still has something to work with.
        street = address.split(",")[0].strip()
        leads.append(Lead(
            business=name,
            type=type_map.get(place.get("primaryType", ""), "Other"),
            area=town["name"],
            address=address,
            street=street,
            phone=place.get("nationalPhoneNumber", ""),
            website=place.get("websiteUri", ""),
            source="google_places",
            external_id=place.get("id", ""),
        ))
    return leads
