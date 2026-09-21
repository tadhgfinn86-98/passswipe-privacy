"""Environment Agency public registers: the carrier and facility map.

Two registers matter:

* Waste carriers, brokers and dealers - every licensed hauler.
* Environmental permits - transfer stations, treatment and disposal sites.

Both are open data and downloadable as CSV. The EA reshuffles both the
download paths and the column headers from time to time, so this module
resolves columns by fuzzy header matching and accepts a local CSV file as
the preferred input. Download the register once, point --ea-carriers-csv at
it, and the pipeline stops depending on a URL that may have moved.
"""

from __future__ import annotations

import csv
import io
import logging
import re
from pathlib import Path

from ..config import Config
from ..http_client import HttpClient
from ..models import CARRIER, FACILITY, Lead

log = logging.getLogger(__name__)

# Registers can be tens of megabytes.
MAX_DOWNLOAD_BYTES = 60_000_000

_HEADER_CLEAN = re.compile(r"[^a-z0-9]")


def _clean_header(header: str) -> str:
    return _HEADER_CLEAN.sub("", (header or "").lower())


# Candidate header fragments, most specific first. Matching is on the cleaned
# header, trying exact equality before falling back to substring containment.
CARRIER_COLUMNS = {
    "registration": ["registrationnumber", "registrationno", "regnumber", "regno", "permitnumber", "licencenumber", "reference"],
    "name": ["registeredcompanyname", "organisationname", "companyname", "tradingname", "applicantname", "name"],
    "tier": ["registrationtier", "tier", "carriertype", "registrationtype"],
    "status": ["registrationstatus", "status"],
    "address": ["registeredaddressline1", "addressline1", "address1", "buildingandstreet", "address"],
    "town": ["registeredaddresstown", "addresstown", "town", "city", "locality", "posttown"],
    "postcode": ["registeredaddresspostcode", "addresspostcode", "postcode", "postalcode"],
    "phone": ["telephonenumber", "telephone", "phonenumber", "phone", "contactnumber"],
    "email": ["emailaddress", "email"],
}

SITE_COLUMNS = {
    "registration": ["permitnumber", "permitno", "registrationnumber", "regnumber", "regno", "licencenumber", "reference"],
    "name": ["operatorname", "sitename", "tradingname", "organisationname", "companyname", "name"],
    "permit_type": ["permittype", "facilitytype", "sitetype", "activity", "permitcategory"],
    "status": ["permitstatus", "status"],
    "address": ["siteaddressline1", "addressline1", "address1", "siteaddress", "address"],
    "town": ["siteaddresstown", "addresstown", "town", "city", "locality", "posttown"],
    "postcode": ["siteaddresspostcode", "addresspostcode", "postcode", "postalcode"],
    "phone": ["telephonenumber", "telephone", "phonenumber", "phone"],
    "email": ["emailaddress", "email"],
}


def resolve_columns(headers: list[str], spec: dict[str, list[str]]) -> dict[str, str]:
    """Map our field names onto whatever headers this CSV actually uses."""
    cleaned = {_clean_header(h): h for h in headers if h}
    resolved: dict[str, str] = {}

    for field, candidates in spec.items():
        for candidate in candidates:
            if candidate in cleaned:
                resolved[field] = cleaned[candidate]
                break
        else:
            # No exact hit: accept the first header that contains a candidate.
            for candidate in candidates:
                match = next(
                    (orig for clean, orig in cleaned.items() if candidate in clean),
                    None,
                )
                if match:
                    resolved[field] = match
                    break
    return resolved


def load_rows(client: HttpClient, local_path: str, url: str, label: str) -> list[dict]:
    """Read a register from a local CSV if given, otherwise download it."""
    if local_path:
        path = Path(local_path)
        if not path.exists():
            log.warning("%s: local csv %s not found", label, path)
            return []
        log.info("%s: reading local csv %s", label, path)
        return _parse_csv(path.read_text(encoding="utf-8-sig", errors="replace"))

    if not url:
        return []
    log.info("%s: downloading %s", label, url)
    text = client.get_text(url, max_bytes=MAX_DOWNLOAD_BYTES)
    if not text:
        log.warning(
            "%s: download failed. Download the register by hand and pass it "
            "with --ea-carriers-csv / --ea-sites-csv.", label,
        )
        return []
    return _parse_csv(text)


def _parse_csv(text: str) -> list[dict]:
    reader = csv.DictReader(io.StringIO(text))
    return [row for row in reader]


def fetch_carriers(client: HttpClient, cfg: Config) -> list[Lead]:
    """Licensed waste carriers, brokers and dealers."""
    rows = load_rows(client, cfg.ea_carriers_csv, cfg.ea_carriers_url, "ea_carriers")
    if not rows:
        return []
    columns = resolve_columns(list(rows[0].keys()), CARRIER_COLUMNS)
    log.info("ea_carriers: %d rows, columns resolved: %s", len(rows), sorted(columns))

    leads = []
    for row in rows:
        lead = _row_to_lead(row, columns, CARRIER)
        if lead:
            leads.append(lead)
    return leads


def fetch_sites(client: HttpClient, cfg: Config) -> list[Lead]:
    """Permitted waste sites: transfer stations, treatment, disposal."""
    rows = load_rows(client, cfg.ea_sites_csv, cfg.ea_sites_url, "ea_sites")
    if not rows:
        return []
    columns = resolve_columns(list(rows[0].keys()), SITE_COLUMNS)
    log.info("ea_sites: %d rows, columns resolved: %s", len(rows), sorted(columns))

    leads = []
    for row in rows:
        lead = _row_to_lead(row, columns, FACILITY)
        if lead:
            leads.append(lead)
    return leads


def _row_to_lead(row: dict, columns: dict[str, str], category: str) -> Lead | None:
    """Map one register row to a Lead, dropping inactive and nameless rows."""
    def value(field: str) -> str:
        column = columns.get(field)
        return (row.get(column) or "").strip() if column else ""

    name = value("name")
    if not name:
        return None

    status = value("status").lower()
    # Registers include revoked, expired and surrendered entries; we only want
    # operators who can legally take waste today.
    if status and not any(
        good in status for good in ("active", "valid", "current", "issued", "granted", "registered")
    ):
        return None

    source = "ea_carriers" if category == CARRIER else "ea_sites"
    return Lead(
        name=name,
        category=category,
        address=value("address"),
        town=value("town"),
        postcode=value("postcode"),
        phone=value("phone"),
        email=value("email"),
        business_type=value("permit_type") or ("Waste carrier" if category == CARRIER else "Waste site"),
        ea_registration=value("registration"),
        ea_tier=_normalise_tier(value("tier")),
        ea_permit_type=value("permit_type"),
        sources=[source],
    )


def _normalise_tier(tier: str) -> str:
    """EA writes the tier several ways; reduce to 'upper' / 'lower' / ''.

    Upper tier carriers handle waste as a main business and are the ones
    worth subcontracting to. Lower tier is mostly businesses moving their
    own waste.
    """
    lowered = tier.lower()
    if "upper" in lowered:
        return "upper"
    if "lower" in lowered:
        return "lower"
    return tier.strip()
