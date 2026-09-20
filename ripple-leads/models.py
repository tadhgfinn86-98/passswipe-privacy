"""The data model.

One table, one Python class. Pydantic validates the fields so a bad value
(a status typo, a negative spend) fails loudly here rather than silently
rotting in the database.

The allowed values for the dropdown-style fields live in this file as plain
lists, because both the database layer and the Streamlit UI need them.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

# --- Controlled vocabularies ----------------------------------------------

BUSINESS_TYPES = ["Restaurant", "Cafe", "Pub", "Takeaway", "Bar", "Other"]

STATUSES = [
    "To research",
    "To contact",
    "Contacted",
    "In conversation",
    "Quote sent",
    "Won",
    "Lost",
    "Not now",
]

# Statuses that mean the lead is still live. Used for the funnel and for
# filtering the call list.
OPEN_STATUSES = ["To research", "To contact", "Contacted", "In conversation", "Quote sent"]

TRISTATE = ["Y", "N", "unknown"]

PRIORITIES = ["High", "Medium", "Low"]

LANES = ["Email", "Call", "Walk-in"]

BusinessType = Literal["Restaurant", "Cafe", "Pub", "Takeaway", "Bar", "Other"]
Status = Literal[
    "To research", "To contact", "Contacted", "In conversation",
    "Quote sent", "Won", "Lost", "Not now",
]
TriState = Literal["Y", "N", "unknown"]


def now_iso() -> str:
    """UTC timestamp as a sortable string. SQLite has no date type, so we
    store ISO-8601 text and sort lexically - which works because ISO-8601 is
    designed to sort that way."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalise(value: Optional[str]) -> str:
    """Lowercase, strip punctuation and collapse spaces.

    Used to build the dedupe key so "The Olive Branch" and "the olive branch."
    are recognised as the same business.
    """
    if not value:
        return ""
    cleaned = re.sub(r"[^a-z0-9]+", " ", value.lower())
    return " ".join(cleaned.split())


class Lead(BaseModel):
    """A single prospect."""

    id: Optional[int] = None

    # --- identity ---
    business: str
    type: BusinessType = "Other"
    area: str = ""              # which of your towns it sits in
    address: str = ""           # full single-line address
    street: str = ""            # street only - half of the dedupe key
    postcode: str = ""

    # --- contact ---
    phone: str = ""
    website: str = ""
    email: str = ""
    contact_name: str = ""

    # --- qualification ---
    independent: TriState = "unknown"
    compliant_yet: TriState = "unknown"
    est_monthly_spend: Optional[float] = None

    # --- derived by score.py, never typed in by hand ---
    score: int = 0
    priority: str = "Low"
    suggested_lane: str = "Walk-in"

    # --- pipeline ---
    status: Status = "To research"
    next_action: str = ""
    next_action_date: str = ""   # YYYY-MM-DD, blank when none set
    notes: str = ""

    # --- outreach state ---
    approved: bool = False       # nothing is ever sent without this
    draft_subject: str = ""
    draft_body: str = ""
    opener: str = ""             # one-line personalisation from enrichment
    last_contacted: str = ""

    # --- provenance ---
    source: str = "osm"
    external_id: str = ""        # e.g. the OSM node id, to avoid re-importing
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)

    @field_validator("est_monthly_spend")
    @classmethod
    def _spend_not_negative(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("est_monthly_spend cannot be negative")
        return v

    @field_validator("business")
    @classmethod
    def _business_not_blank(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("business name is required")
        return v

    @property
    def dedupe_key(self) -> str:
        """Business + street, normalised.

        Where OSM gives no street we fall back to the postcode, then the area,
        so two different 'Costa' entries in different towns stay separate
        instead of collapsing into one row.
        """
        tail = normalise_street(self.street) or normalise(self.postcode) or normalise(self.area)
        return f"{normalise(self.business)}|{tail}"


# Royal Mail style abbreviations, expanded so "High St" and "High Street"
# produce the same dedupe key instead of two rows for one business.
_STREET_ABBREV = {
    "st": "street", "str": "street", "rd": "road", "ave": "avenue",
    "av": "avenue", "ln": "lane", "dr": "drive", "cl": "close",
    "sq": "square", "pl": "place", "ct": "court", "cres": "crescent",
    "gdns": "gardens", "gdn": "garden", "pk": "park", "ter": "terrace",
    "hl": "hill", "bldgs": "buildings", "bldg": "building", "pde": "parade",
    "gr": "grove", "wlk": "walk", "yd": "yard", "mt": "mount",
}


def normalise_street(value: Optional[str]) -> str:
    """Normalise a street name, expanding common abbreviations.

    "High St." and "High Street" both become "high street". Note this runs
    only on the street portion - expanding "St" inside a business name would
    turn "St Johns Tavern" into "Street Johns Tavern".
    """
    words = normalise(value).split()
    return " ".join(_STREET_ABBREV.get(w, w) for w in words)


def amenity_to_type(amenity: str) -> str:
    """Map an OpenStreetMap `amenity` tag onto our business types."""
    return {
        "restaurant": "Restaurant",
        "cafe": "Cafe",
        "pub": "Pub",
        "fast_food": "Takeaway",
        "bar": "Bar",
    }.get((amenity or "").strip().lower(), "Other")
