"""Core record types shared by every source, enricher and output."""

from __future__ import annotations

import hashlib
import re
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from typing import Any

# Categories a lead can fall into. Clients buy waste collection; carriers and
# facilities are the supply side Ripple subcontracts to.
CLIENT = "client"
CARRIER = "carrier"
FACILITY = "facility"

_WS = re.compile(r"\s+")
_NON_ALNUM = re.compile(r"[^a-z0-9 ]")
# Apostrophes are deleted rather than spaced, so "Bella's" and "Bellas"
# normalise alike. Spacing them apart used to break exact-match lookups.
_APOSTROPHE = re.compile(r"[\u2019'`]")
_POSTCODE_STRIP = re.compile(r"[^A-Z0-9]")
# A real UK postcode: 1-2 letters, a digit, an optional letter/digit, then the
# inward code of a digit and two letters. Checking only the length let values
# like "rubbish" through and produced a fake postcode area.
_POSTCODE_RE = re.compile(r"^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$")
# Words that add nothing when comparing two spellings of the same business.
_NOISE_WORDS = {
    "ltd",
    "limited",
    "plc",
    "llp",
    "lp",
    "the",
    "co",
    "company",
    "uk",
    "gb",
    "and",
    "t",
    "a",  # from "t/a" trading-as prefixes
}


def normalise_name(name: str | None) -> str:
    """Lowercase, strip punctuation and company suffixes for match keys."""
    if not name:
        return ""
    lowered = _APOSTROPHE.sub("", name.lower().replace("&", " and "))
    text = _NON_ALNUM.sub(" ", lowered)
    words = [w for w in _WS.sub(" ", text).strip().split(" ") if w and w not in _NOISE_WORDS]
    return " ".join(words)


def normalise_postcode(postcode: str | None) -> str:
    """Uppercase, single-spaced UK postcode. Returns '' if it isn't one.

    Idempotent: normalising an already-normalised postcode returns it unchanged.
    """
    if not postcode:
        return ""
    raw = _POSTCODE_STRIP.sub("", postcode.upper())
    if not _POSTCODE_RE.match(raw):
        return ""
    return f"{raw[:-3]} {raw[-3:]}"


def outward_code(postcode: str | None) -> str:
    """The part before the space: 'WR1 3PB' -> 'WR1'."""
    pc = normalise_postcode(postcode)
    return pc.split(" ")[0] if pc else ""


def postcode_area(postcode: str | None) -> str:
    """The leading letters: 'WR1 3PB' -> 'WR'."""
    out = outward_code(postcode)
    match = re.match(r"^[A-Z]{1,2}", out)
    return match.group(0) if match else ""


@dataclass
class Lead:
    """One business, merged from every source that knows about it."""

    name: str
    category: str = CLIENT

    # Address
    address: str = ""
    town: str = ""
    postcode: str = ""
    latitude: float | None = None
    longitude: float | None = None
    distance_miles: float | None = None

    # Contact
    phone: str = ""
    email: str = ""
    website: str = ""

    # What kind of business this is
    business_type: str = ""
    sic_codes: list[str] = field(default_factory=list)

    # Food Standards Agency
    fsa_id: str = ""
    fsa_rating: str = ""

    # Companies House
    company_number: str = ""
    company_type: str = ""
    company_status: str = ""
    incorporation_date: str = ""
    years_trading: float | None = None
    directors: list[str] = field(default_factory=list)

    # Google Places
    place_id: str = ""
    google_rating: float | None = None
    review_count: int | None = None

    # Environment Agency (supply side)
    ea_registration: str = ""
    ea_tier: str = ""
    ea_permit_type: str = ""

    # Marketing compliance, set by pipeline.compliance
    pecr_status: str = "unknown"
    outreach_channel: str = ""

    # Scoring, set by pipeline.scoring
    score: int = 0
    score_breakdown: dict[str, int] = field(default_factory=dict)

    # Provenance
    sources: list[str] = field(default_factory=list)
    first_seen: str = field(default_factory=lambda: date.today().isoformat())
    last_seen: str = field(default_factory=lambda: date.today().isoformat())
    notes: str = ""

    def __post_init__(self) -> None:
        self.postcode = normalise_postcode(self.postcode)
        self.name = _WS.sub(" ", (self.name or "").strip())

    @property
    def match_key(self) -> str:
        """Stable identity: normalised name + postcode."""
        return f"{normalise_name(self.name)}|{self.postcode}"

    @property
    def lead_id(self) -> str:
        """Short deterministic id, safe to use as a CRM primary key."""
        return hashlib.sha1(f"{self.category}|{self.match_key}".encode()).hexdigest()[:12]

    @property
    def has_contact(self) -> bool:
        return bool(self.email or self.phone)

    def to_row(self) -> dict[str, Any]:
        """Flatten to a CSV/CRM-friendly dict."""
        row = asdict(self)
        row["lead_id"] = self.lead_id
        row["sic_codes"] = ";".join(self.sic_codes)
        row["directors"] = ";".join(self.directors)
        row["sources"] = ";".join(sorted(set(self.sources)))
        row["score_breakdown"] = ";".join(f"{k}={v}" for k, v in sorted(self.score_breakdown.items()))
        return row


# Column order for CSV exports: identity first, then the things you act on.
CSV_COLUMNS = [
    "lead_id",
    "score",
    "category",
    "name",
    "business_type",
    "postcode",
    "town",
    "address",
    "phone",
    "email",
    "website",
    "outreach_channel",
    "pecr_status",
    "company_number",
    "company_type",
    "company_status",
    "incorporation_date",
    "years_trading",
    "directors",
    "sic_codes",
    "fsa_id",
    "fsa_rating",
    "place_id",
    "google_rating",
    "review_count",
    "ea_registration",
    "ea_tier",
    "ea_permit_type",
    "distance_miles",
    "latitude",
    "longitude",
    "score_breakdown",
    "sources",
    "first_seen",
    "last_seen",
    "notes",
]


def years_between(iso_date: str, today: date | None = None) -> float | None:
    """Years from an ISO date to today, to one decimal. None if unparseable."""
    if not iso_date:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
        try:
            then = datetime.strptime(iso_date[:10], fmt).date()
        except ValueError:
            continue
        now = today or date.today()
        return round((now - then).days / 365.25, 1)
    return None
