"""Distance and postcode geocoding.

Geocoding uses postcodes.io, which is free and needs no key. When it is
unavailable we fall back to filtering on postcode area (WR, DY, B, ...),
which is coarse but never wrong in a way that loses a real lead.
"""

from __future__ import annotations

import logging
from math import asin, cos, radians, sin, sqrt

from .http_client import HttpClient
from .models import Lead, normalise_postcode, postcode_area

log = logging.getLogger(__name__)

POSTCODES_IO_BULK = "https://api.postcodes.io/postcodes"
EARTH_RADIUS_MILES = 3958.8
# postcodes.io accepts at most 100 postcodes per bulk request.
BULK_CHUNK = 100


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in miles."""
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return round(2 * EARTH_RADIUS_MILES * asin(sqrt(a)), 1)


def geocode_postcodes(client: HttpClient, postcodes: list[str]) -> dict[str, tuple[float, float]]:
    """Bulk-geocode UK postcodes. Unknown postcodes are simply absent."""
    wanted = sorted({normalise_postcode(p) for p in postcodes if normalise_postcode(p)})
    found: dict[str, tuple[float, float]] = {}

    for start in range(0, len(wanted), BULK_CHUNK):
        chunk = wanted[start : start + BULK_CHUNK]
        payload = _bulk_lookup(client, chunk)
        if not payload:
            continue
        for entry in payload.get("result") or []:
            result = entry.get("result")
            if not result:
                continue
            query = normalise_postcode(entry.get("query", ""))
            lat, lon = result.get("latitude"), result.get("longitude")
            if query and lat is not None and lon is not None:
                found[query] = (float(lat), float(lon))

    log.info("geocoded %d/%d postcodes", len(found), len(wanted))
    return found


def _bulk_lookup(client: HttpClient, chunk: list[str]) -> dict | None:
    """POST the bulk endpoint through the shared retry/throttle/cache logic."""
    return client.post_json(
        POSTCODES_IO_BULK,
        body={"postcodes": chunk},
        headers={"Content-Type": "application/json"},
    )


def annotate_distances(
    leads: list[Lead],
    client: HttpClient,
    hub_lat: float,
    hub_lon: float,
    geocode: bool = True,
) -> list[Lead]:
    """Fill in latitude/longitude/distance_miles where we can."""
    if geocode:
        missing = [lead.postcode for lead in leads if lead.postcode and lead.latitude is None]
        coords = geocode_postcodes(client, missing) if missing else {}
        for lead in leads:
            if lead.latitude is None and lead.postcode in coords:
                lead.latitude, lead.longitude = coords[lead.postcode]

    for lead in leads:
        if lead.latitude is not None and lead.longitude is not None:
            lead.distance_miles = haversine_miles(hub_lat, hub_lon, lead.latitude, lead.longitude)
    return leads


def within_radius(lead: Lead, radius_miles: float, allowed_areas: list[str]) -> bool:
    """True if a lead is in range.

    A known distance decides it outright. Without coordinates we fall back to
    the postcode area allowlist rather than dropping the lead, because an
    un-geocoded postcode is usually a formatting problem, not a far-away one.
    """
    if lead.distance_miles is not None:
        return lead.distance_miles <= radius_miles
    area = postcode_area(lead.postcode)
    if not area:
        return False
    return area in {a.upper() for a in allowed_areas}
