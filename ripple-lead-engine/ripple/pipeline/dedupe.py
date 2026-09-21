"""Merge the same business seen by several sources into one lead.

Two passes. First an exact match on normalised name + postcode, which catches
most of it. Then a fuzzy pass within each postcode, for the spelling drift
between registers - "Bella's Cafe" in the FSA against "BELLAS CAFE LIMITED"
in Companies House.

Fuzzy matching is deliberately confined to a single postcode. Two businesses
with similar names in the same postcode are nearly always the same business;
across postcodes they are nearly always not.
"""

from __future__ import annotations

import logging
from difflib import SequenceMatcher

from ..models import Lead, normalise_name

log = logging.getLogger(__name__)

# Above this name similarity, within one postcode, we treat it as the same
# business. Tuned to merge "bellas cafe" / "bellas cafe limited" but not
# "kings arms" / "kings head".
SIMILARITY_THRESHOLD = 0.87

# Later sources never overwrite earlier ones; these are the fields we fill in
# where a lead is missing them.
_FILLABLE = [
    "address", "town", "postcode", "phone", "email", "website", "business_type",
    "fsa_id", "fsa_rating", "company_number", "company_type", "company_status",
    "incorporation_date", "place_id", "ea_registration", "ea_tier",
    "ea_permit_type", "notes",
]
_LIST_FIELDS = ["sic_codes", "directors", "sources"]


def deduplicate(leads: list[Lead]) -> list[Lead]:
    """Collapse duplicate leads, keeping the richest version of each."""
    exact = _merge_exact(leads)
    fuzzy = _merge_fuzzy(exact)
    log.info("dedupe: %d raw -> %d exact -> %d after fuzzy", len(leads), len(exact), len(fuzzy))
    return fuzzy


def _merge_exact(leads: list[Lead]) -> list[Lead]:
    merged: dict[tuple[str, str], Lead] = {}
    for lead in leads:
        if not lead.name:
            continue
        key = (lead.category, lead.match_key)
        if key in merged:
            merge_into(merged[key], lead)
        else:
            merged[key] = lead
    return list(merged.values())


def _merge_fuzzy(leads: list[Lead]) -> list[Lead]:
    """Within each (category, postcode) bucket, merge near-identical names."""
    buckets: dict[tuple[str, str], list[Lead]] = {}
    no_postcode: list[Lead] = []

    for lead in leads:
        if lead.postcode:
            buckets.setdefault((lead.category, lead.postcode), []).append(lead)
        else:
            no_postcode.append(lead)

    result: list[Lead] = list(no_postcode)
    for bucket in buckets.values():
        kept: list[Lead] = []
        for lead in bucket:
            match = _find_similar(lead, kept)
            if match:
                merge_into(match, lead)
            else:
                kept.append(lead)
        result.extend(kept)
    return result


def _find_similar(lead: Lead, kept: list[Lead]) -> Lead | None:
    name = normalise_name(lead.name)
    if not name:
        return None
    for candidate in kept:
        other = normalise_name(candidate.name)
        if not other:
            continue
        # One name containing the other is a strong signal on its own
        # ("bellas cafe" inside "bellas cafe limited").
        if name in other or other in name:
            return candidate
        if SequenceMatcher(None, name, other).ratio() >= SIMILARITY_THRESHOLD:
            return candidate
    return None


def merge_into(target: Lead, other: Lead) -> Lead:
    """Fold `other` into `target`, filling gaps without overwriting."""
    for field in _FILLABLE:
        if not getattr(target, field, "") and getattr(other, field, ""):
            setattr(target, field, getattr(other, field))

    for field in _LIST_FIELDS:
        combined = list(getattr(target, field) or []) + list(getattr(other, field) or [])
        seen: list[str] = []
        for item in combined:
            if item not in seen:
                seen.append(item)
        setattr(target, field, seen)

    # Numeric fields: take whichever is present, preferring the larger signal.
    if target.latitude is None and other.latitude is not None:
        target.latitude, target.longitude = other.latitude, other.longitude
    if target.distance_miles is None:
        target.distance_miles = other.distance_miles
    if target.years_trading is None:
        target.years_trading = other.years_trading
    if other.review_count is not None:
        target.review_count = max(target.review_count or 0, other.review_count)
    if target.google_rating is None:
        target.google_rating = other.google_rating

    # Keep the earliest sighting, and the latest confirmation.
    target.first_seen = min(target.first_seen, other.first_seen)
    target.last_seen = max(target.last_seen, other.last_seen)
    return target
