"""Configuration: everything tunable lives here, secrets come from the env."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# Worcester city centre (Cathedral Square), used as the hub for distances.
WORCESTER_LAT = 52.1885
WORCESTER_LON = -2.2206

# Postcode areas Ripple can realistically serve from Worcester.
# WR Worcester, DY Dudley/Stourport, B Birmingham, GL Gloucester,
# HR Hereford, CV Coventry, WS Walsall, TF Telford.
DEFAULT_AREAS = ["WR", "DY", "B", "GL", "HR"]

# FSA business types worth calling. The API returns these verbatim.
TARGET_FSA_TYPES = [
    "Restaurant/Cafe/Canteen",
    "Takeaway/sandwich shop",
    "Pub/bar/nightclub",
    "Hotel/bed & breakfast/guest house",
    "Retailers - supermarkets/hypermarkets",
    "Retailers - other",
    "Manufacturers/packers",
    "Distributors/Transporters",
    "Hospitals/Childcare/Caring Premises",
    "School/college/university",
]

# SIC codes for the non-food niches: restaurants, warehousing, property mgmt.
TARGET_SIC_CODES = [
    "56101",  # Licensed restaurants
    "56102",  # Unlicensed restaurants and cafes
    "56103",  # Take-away food shops and mobile food stands
    "56302",  # Public houses and bars
    "55100",  # Hotels and similar accommodation
    "52103",  # Operation of warehousing and storage (non-refrigerated)
    "52101",  # Operation of warehousing and storage (refrigerated)
    "68320",  # Management of real estate on a fee or contract basis
    "47110",  # Retail sale in non-specialised stores with food predominating
]


@dataclass
class Config:
    """Runtime settings. Construct with Config.from_env()."""

    # Geography
    areas: list[str] = field(default_factory=lambda: list(DEFAULT_AREAS))
    radius_miles: float = 30.0
    hub_lat: float = WORCESTER_LAT
    hub_lon: float = WORCESTER_LON

    # Source toggles
    use_fsa: bool = True
    use_companies_house: bool = True
    use_google_places: bool = True
    use_environment_agency: bool = True
    enrich_websites: bool = True

    # Limits, so a nightly run stays polite and predictable in cost
    max_fsa_pages: int = 20
    fsa_page_size: int = 200
    max_places_lookups: int = 200
    max_website_fetches: int = 300
    min_score_for_places: int = 30

    # API keys
    companies_house_key: str = ""
    google_places_key: str = ""
    airtable_key: str = ""
    airtable_base: str = ""
    airtable_table: str = "Leads"
    notion_token: str = ""
    notion_database: str = ""

    # HTTP behaviour
    user_agent: str = (
        "RippleLeadEngine/0.1 (+https://github.com/tadhgfinn86-98/passswipe-privacy; "
        "trade waste lead research; contact via repository)"
    )
    request_timeout: float = 20.0
    rate_limit_seconds: float = 0.5
    max_retries: int = 3
    cache_dir: Path = Path("data/cache")
    cache_ttl_hours: float = 24.0

    # Environment Agency register. The EA changes these download paths from
    # time to time, so both are overridable and a local CSV always wins.
    ea_carriers_csv: str = ""
    ea_carriers_url: str = (
        "https://environment.data.gov.uk/public-register/"
        "waste-carriers-brokers/registration.csv"
    )
    ea_sites_csv: str = ""
    ea_sites_url: str = (
        "https://environment.data.gov.uk/public-register/"
        "enviromental-permitting-registrations/registration.csv"
    )

    output_dir: Path = Path("data/out")

    @classmethod
    def from_env(cls, **overrides) -> "Config":
        """Read secrets from the environment, then apply explicit overrides."""
        cfg = cls(
            companies_house_key=os.getenv("COMPANIES_HOUSE_API_KEY", ""),
            google_places_key=os.getenv("GOOGLE_PLACES_API_KEY", ""),
            airtable_key=os.getenv("AIRTABLE_API_KEY", ""),
            airtable_base=os.getenv("AIRTABLE_BASE_ID", ""),
            airtable_table=os.getenv("AIRTABLE_TABLE_NAME", "Leads"),
            notion_token=os.getenv("NOTION_TOKEN", ""),
            notion_database=os.getenv("NOTION_DATABASE_ID", ""),
        )
        for key, value in overrides.items():
            if value is not None and hasattr(cfg, key):
                setattr(cfg, key, value)
        return cfg

    def describe_sources(self) -> list[str]:
        """Which sources will actually run, given the keys present."""
        active = []
        if self.use_fsa:
            active.append("fsa")
        if self.use_companies_house and self.companies_house_key:
            active.append("companies_house")
        if self.use_google_places and self.google_places_key:
            active.append("google_places")
        if self.use_environment_agency:
            active.append("environment_agency")
        if self.enrich_websites:
            active.append("website_enrichment")
        return active
