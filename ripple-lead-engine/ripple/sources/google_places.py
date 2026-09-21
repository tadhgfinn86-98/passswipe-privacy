"""Google Places API (New): fills the gaps the official registers leave.

Used only for phone numbers, websites and review counts, and only for leads
that already look worth the call. Every lookup costs money, so this runs last
and under a hard cap.

We call the API rather than scraping Google Maps pages. Scraping those pages
breaks Google's terms and gets blocked, and the API returns better data.

API docs: https://developers.google.com/maps/documentation/places/web-service/search-text
"""

from __future__ import annotations

import logging

from ..config import Config
from ..http_client import HttpClient
from ..models import Lead, normalise_name

log = logging.getLogger(__name__)

SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"

# Ask only for the fields we use: the field mask drives the billing tier.
FIELD_MASK = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.rating",
    "places.userRatingCount",
    "places.businessStatus",
    "places.location",
])


def enrich(client: HttpClient, cfg: Config, leads: list[Lead]) -> list[Lead]:
    """Add phone/website/review data to the best leads that still lack it."""
    if not cfg.google_places_key:
        log.info("google_places: no API key, skipping")
        return leads

    candidates = [lead for lead in leads if _needs_lookup(lead, cfg)]
    candidates.sort(key=lambda lead: lead.score, reverse=True)
    budget = candidates[: cfg.max_places_lookups]
    log.info("google_places: %d candidates, looking up %d", len(candidates), len(budget))

    for lead in budget:
        place = _search(client, cfg, lead)
        if place:
            _apply(lead, place)
    return leads


def _needs_lookup(lead: Lead, cfg: Config) -> bool:
    """Only pay for leads that are worth calling and are missing contact data."""
    if lead.score < cfg.min_score_for_places:
        return False
    if lead.place_id:
        return False
    return not (lead.phone and lead.website)


def _search(client: HttpClient, cfg: Config, lead: Lead) -> dict | None:
    """Text-search for one lead, biased to its coordinates when we have them."""
    query = " ".join(part for part in [lead.name, lead.postcode or lead.town] if part)
    body: dict = {"textQuery": query, "maxResultCount": 3, "languageCode": "en"}

    if lead.latitude is not None and lead.longitude is not None:
        body["locationBias"] = {
            "circle": {
                "center": {"latitude": lead.latitude, "longitude": lead.longitude},
                "radius": 2000.0,
            }
        }

    payload = client.post_json(
        SEARCH_URL,
        body=body,
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": cfg.google_places_key,
            "X-Goog-FieldMask": FIELD_MASK,
        },
    )
    if not payload:
        return None

    places = payload.get("places") or []
    return _best_match(lead, places)


def _best_match(lead: Lead, places: list[dict]) -> dict | None:
    """Accept a result only if the name matches and the place is open.

    Text search is fuzzy and will happily return a different restaurant down
    the road. A wrong phone number is worse than no phone number, so we
    require the normalised names to match or one to contain the other.
    """
    target = normalise_name(lead.name)
    if not target:
        return None

    for place in places:
        if (place.get("businessStatus") or "OPERATIONAL") != "OPERATIONAL":
            continue
        candidate = normalise_name(
            (place.get("displayName") or {}).get("text") or ""
        )
        if not candidate:
            continue
        if candidate == target or candidate in target or target in candidate:
            return place
    return None


def _apply(lead: Lead, place: dict) -> None:
    """Fill gaps only: official-register data outranks Places data."""
    lead.place_id = place.get("id") or ""
    if not lead.phone:
        lead.phone = (place.get("nationalPhoneNumber") or "").strip()
    if not lead.website:
        lead.website = (place.get("websiteUri") or "").strip()

    rating = place.get("rating")
    if rating is not None:
        lead.google_rating = float(rating)
    reviews = place.get("userRatingCount")
    if reviews is not None:
        lead.review_count = int(reviews)

    location = place.get("location") or {}
    if lead.latitude is None and location.get("latitude") is not None:
        lead.latitude = float(location["latitude"])
        lead.longitude = float(location["longitude"])

    if "google_places" not in lead.sources:
        lead.sources.append("google_places")
