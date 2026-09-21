"""The nightly run: collect, de-duplicate, enrich, score, export.

Ordering matters here and is not arbitrary:

* De-duplicate before enriching, so we never pay Google twice for one
  business.
* Filter by radius before enriching, for the same reason.
* Classify and score before the paid enrichers, so the budget goes to the
  leads most worth spending it on.
* Classify and score again afterwards, because enrichment changes both the
  company type (PECR) and the contact details (score).
"""

from __future__ import annotations

import logging

from ..config import Config, TARGET_SIC_CODES
from ..geo import annotate_distances, within_radius
from ..http_client import HttpClient
from ..models import CARRIER, CLIENT, FACILITY, Lead
from ..sources import companies_house, environment_agency, fsa, google_places
from ..enrich import website
from . import compliance, dedupe, scoring

log = logging.getLogger(__name__)


def build_client(cfg: Config, should_stop=None) -> HttpClient:
    return HttpClient(
        user_agent=cfg.user_agent,
        timeout=cfg.request_timeout,
        rate_limit_seconds=cfg.rate_limit_seconds,
        max_retries=cfg.max_retries,
        cache_dir=cfg.cache_dir,
        cache_ttl_hours=cfg.cache_ttl_hours,
        should_stop=should_stop,
    )


def collect(client: HttpClient, cfg: Config, towns: list[str],
            include_clients: bool = True, include_supply: bool = True) -> list[Lead]:
    """Pull raw leads from every enabled source."""
    leads: list[Lead] = []

    if include_clients:
        if cfg.use_fsa:
            leads.extend(fsa.fetch(client, cfg, towns))
        if cfg.use_companies_house:
            leads.extend(companies_house.discover(client, cfg, TARGET_SIC_CODES, towns))

    if include_supply and cfg.use_environment_agency:
        leads.extend(environment_agency.fetch_carriers(client, cfg))
        leads.extend(environment_agency.fetch_sites(client, cfg))

    log.info("collected %d raw leads", len(leads))
    return leads


# The stages a run moves through, in order, for progress reporting.
STAGES = [
    "collect", "dedupe", "locate", "classify",
    "companies_house", "places", "websites", "score", "done",
]


def run(cfg: Config, towns: list[str] | None = None,
        include_clients: bool = True, include_supply: bool = True,
        geocode: bool = True, client: HttpClient | None = None,
        on_stage=None) -> list[Lead]:
    """Run the whole pipeline and return scored, ranked leads.

    `client` is injectable so tests, the offline demo and the web app's Demo
    mode can drive the whole pipeline without touching the network.
    `on_stage(name, index, total)` is called as each stage begins.
    """
    towns = towns or ["Worcester"]
    client = client or build_client(cfg)

    def stage(name: str) -> None:
        if on_stage:
            on_stage(name, STAGES.index(name) + 1, len(STAGES))

    stage("collect")
    leads = collect(client, cfg, towns, include_clients, include_supply)
    if not leads:
        log.warning("no leads collected; check source configuration and network access")
        return []

    stage("dedupe")
    leads = dedupe.deduplicate(leads)

    stage("locate")
    leads = annotate_distances(leads, client, cfg.hub_lat, cfg.hub_lon, geocode=geocode)
    before = len(leads)
    leads = [lead for lead in leads if within_radius(lead, cfg.radius_miles, cfg.areas)]
    log.info("radius filter: %d -> %d leads within %.0f miles", before, len(leads), cfg.radius_miles)

    # First pass, so the paid enrichers know which leads deserve the budget.
    stage("classify")
    compliance.apply(leads)
    scoring.apply(leads)

    stage("companies_house")
    if cfg.use_companies_house:
        companies_house.enrich(client, cfg, leads)
    stage("places")
    if cfg.use_google_places:
        google_places.enrich(client, cfg, leads)
    stage("websites")
    if cfg.enrich_websites:
        website.enrich(client, cfg, leads)

    # Second pass: enrichment changed both the legal type and the contacts.
    stage("score")
    compliance.apply(leads)
    scoring.apply(leads)

    # Directors last, judged on a score that already counts contact details,
    # then re-score so a named contact is credited.
    if cfg.use_companies_house:
        companies_house.enrich_officers(client, cfg, leads, min_score=50)
        scoring.apply(leads)

    ranked = scoring.rank(leads)
    stage("done")
    _log_summary(ranked)
    return ranked


def _log_summary(leads: list[Lead]) -> None:
    clients = [lead for lead in leads if lead.category == CLIENT]
    carriers = [lead for lead in leads if lead.category == CARRIER]
    facilities = [lead for lead in leads if lead.category == FACILITY]
    emailable = compliance.email_safe(clients)
    callable_leads = compliance.call_list(clients)

    log.info(
        "summary: %d leads (%d clients, %d carriers, %d facilities); "
        "%d with email, %d with phone; %d email-safe, %d call-list",
        len(leads), len(clients), len(carriers), len(facilities),
        sum(1 for lead in leads if lead.email),
        sum(1 for lead in leads if lead.phone),
        len(emailable), len(callable_leads),
    )
