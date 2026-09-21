"""Companies House: free with an API key.

Does two jobs here:

1. Discovery. Advanced search by SIC code and location finds the niches the
   FSA never sees, notably warehousing (52101/52103) and property management
   (68320).
2. Enrichment. For a business we already have, it supplies the company
   number, legal type, age and directors' names. The legal type is what
   decides the PECR question, so this is the source that keeps outreach
   lawful, not just the one that adds detail.

API docs: https://developer-specs.company-information.service.gov.uk/
"""

from __future__ import annotations

import logging

from ..config import Config
from ..http_client import HttpClient
from ..models import CLIENT, Lead, normalise_name, normalise_postcode, years_between

log = logging.getLogger(__name__)

BASE_URL = "https://api.company-information.service.gov.uk"
# Advanced search returns at most 5000 hits; page through in chunks of 100.
PAGE_SIZE = 100


def _auth(cfg: Config) -> tuple[str, str]:
    """Companies House uses HTTP Basic with the key as username, no password."""
    return (cfg.companies_house_key, "")


def discover(client: HttpClient, cfg: Config, sic_codes: list[str] | None = None,
             locations: list[str] | None = None) -> list[Lead]:
    """Find companies by SIC code and location."""
    if not cfg.companies_house_key:
        log.info("companies_house: no API key, skipping discovery")
        return []

    sic_codes = sic_codes or []
    locations = locations or ["Worcester"]
    leads: list[Lead] = []

    for location in locations:
        for sic in sic_codes:
            items = _advanced_search(client, cfg, sic, location)
            log.info("companies_house: %d companies for sic=%s location=%s",
                     len(items), sic, location)
            leads.extend(_to_lead(item) for item in items)

    return [lead for lead in leads if lead.name]


def _advanced_search(client: HttpClient, cfg: Config, sic: str, location: str) -> list[dict]:
    """Page through advanced-search for one SIC code in one location."""
    collected: list[dict] = []
    start_index = 0
    while start_index < 1000:  # a sane ceiling for one town/SIC pair
        payload = client.get_json(
            f"{BASE_URL}/advanced-search/companies",
            params={
                "sic_codes": sic,
                "location": location,
                "company_status": "active",
                "size": PAGE_SIZE,
                "start_index": start_index,
            },
            auth=_auth(cfg),
        )
        if not payload:
            break
        items = payload.get("items") or []
        collected.extend(items)
        if len(items) < PAGE_SIZE:
            break
        start_index += PAGE_SIZE
    return collected


def _to_lead(item: dict) -> Lead:
    """Map an advanced-search result onto a Lead."""
    address = item.get("registered_office_address") or {}
    street = ", ".join(
        part for part in [
            (address.get("address_line_1") or "").strip(),
            (address.get("address_line_2") or "").strip(),
        ] if part
    )
    incorporated = (item.get("date_of_creation") or "")[:10]

    return Lead(
        name=(item.get("company_name") or "").strip(),
        category=CLIENT,
        address=street,
        town=(address.get("locality") or "").strip(),
        postcode=address.get("postal_code") or "",
        business_type=_sic_label(item.get("sic_codes") or []),
        sic_codes=[str(code) for code in (item.get("sic_codes") or [])],
        company_number=(item.get("company_number") or "").strip(),
        company_type=(item.get("company_type") or "").strip(),
        company_status=(item.get("company_status") or "").strip(),
        incorporation_date=incorporated,
        years_trading=years_between(incorporated),
        sources=["companies_house"],
    )


def enrich(client: HttpClient, cfg: Config, leads: list[Lead]) -> list[Lead]:
    """Attach company details to leads that don't have them yet.

    Matches on normalised name, then confirms with the postcode when both
    sides have one. A name-only match across a different postcode is rejected:
    a wrong company number would mislabel the PECR status, which is worse
    than leaving the lead unenriched.
    """
    if not cfg.companies_house_key:
        log.info("companies_house: no API key, skipping enrichment")
        return leads

    for lead in leads:
        if lead.company_number or not lead.name:
            continue
        match = _search_company(client, cfg, lead)
        if not match:
            continue
        _apply_match(lead, match)

    return leads


def enrich_officers(client: HttpClient, cfg: Config, leads: list[Lead],
                    min_score: int = 50, max_lookups: int = 150) -> list[Lead]:
    """Add directors' names to the leads you are actually going to call.

    Runs after scoring, not during company matching, so the threshold is
    compared against a score that already reflects contact details. Checking
    it mid-enrichment meant testing a half-built score and silently skipping
    leads that ended up well above the line.
    """
    if not cfg.companies_house_key:
        return leads

    candidates = [
        lead for lead in leads
        if lead.company_number and not lead.directors and lead.score >= min_score
    ]
    candidates.sort(key=lambda lead: lead.score, reverse=True)
    budget = candidates[:max_lookups]
    log.info("companies_house: fetching officers for %d leads", len(budget))

    for lead in budget:
        lead.directors = fetch_officers(client, cfg, lead.company_number)
    return leads


def _search_company(client: HttpClient, cfg: Config, lead: Lead) -> dict | None:
    """Find the best Companies House match for a lead, or None."""
    payload = client.get_json(
        f"{BASE_URL}/search/companies",
        params={"q": lead.name, "items_per_page": 20},
        auth=_auth(cfg),
    )
    if not payload:
        return None

    target_name = normalise_name(lead.name)
    target_postcode = normalise_postcode(lead.postcode)

    fallback: dict | None = None
    for item in payload.get("items") or []:
        if (item.get("company_status") or "").lower() != "active":
            continue
        if normalise_name(item.get("title") or "") != target_name:
            continue

        item_postcode = normalise_postcode(
            (item.get("address") or {}).get("postal_code") or ""
        )
        if target_postcode and item_postcode:
            if item_postcode == target_postcode:
                return item          # name and postcode agree: confident
            continue                 # same name elsewhere: not our business
        fallback = fallback or item  # name matches, no postcode to check

    return fallback


def _apply_match(lead: Lead, match: dict) -> None:
    """Copy company fields onto the lead without overwriting what we have."""
    lead.company_number = (match.get("company_number") or "").strip()
    lead.company_type = (match.get("company_type") or "").strip()
    lead.company_status = (match.get("company_status") or "").strip()

    incorporated = (match.get("date_of_creation") or "")[:10]
    if incorporated:
        lead.incorporation_date = incorporated
        lead.years_trading = years_between(incorporated)

    if not lead.postcode:
        lead.postcode = normalise_postcode(
            (match.get("address") or {}).get("postal_code") or ""
        )
    if "companies_house" not in lead.sources:
        lead.sources.append("companies_house")


def fetch_officers(client: HttpClient, cfg: Config, company_number: str,
                   limit: int = 5) -> list[str]:
    """Names of active directors: who to ask for on the phone."""
    payload = client.get_json(
        f"{BASE_URL}/company/{company_number}/officers",
        params={"register_type": "directors", "items_per_page": 35},
        auth=_auth(cfg),
    )
    if not payload:
        return []

    names = []
    for item in payload.get("items") or []:
        if item.get("resigned_on"):
            continue
        role = (item.get("officer_role") or "").lower()
        if "director" not in role:
            continue
        name = (item.get("name") or "").strip()
        if name:
            names.append(_tidy_officer_name(name))
        if len(names) >= limit:
            break
    return names


def _tidy_officer_name(name: str) -> str:
    """Companies House returns 'SMITH, John Andrew'; make it 'John Andrew Smith'."""
    if "," not in name:
        return name.title()
    surname, _, forenames = name.partition(",")
    return f"{forenames.strip().title()} {surname.strip().title()}".strip()


_SIC_LABELS = {
    "56101": "Licensed restaurant",
    "56102": "Unlicensed restaurant/cafe",
    "56103": "Takeaway",
    "56302": "Pub/bar",
    "55100": "Hotel",
    "52101": "Warehousing (refrigerated)",
    "52103": "Warehousing/storage",
    "68320": "Property management",
    "47110": "Supermarket/convenience",
}


def _sic_label(sic_codes: list) -> str:
    """Human-readable business type from the first SIC code we recognise."""
    for code in sic_codes:
        label = _SIC_LABELS.get(str(code).strip())
        if label:
            return label
    return ""
