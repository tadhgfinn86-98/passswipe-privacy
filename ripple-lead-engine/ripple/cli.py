"""Command line entry point: python -m ripple.cli [options]"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .config import Config, DEFAULT_AREAS
from .models import CARRIER, CLIENT, FACILITY, Lead
from .outputs import airtable, csv_out, notion
from .pipeline import run as pipeline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ripple",
        description="Trade-waste lead engine for Worcester and surrounds.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""examples:
  # clients only, Worcester, scored CSV
  python -m ripple.cli --mode clients --towns Worcester

  # the carrier map from a downloaded register
  python -m ripple.cli --mode carriers --ea-carriers-csv data/carriers.csv

  # everything, pushed to Airtable
  python -m ripple.cli --mode all --push airtable
""",
    )
    parser.add_argument("--mode", choices=["clients", "carriers", "all"], default="clients",
                        help="which side of the market to build (default: clients)")
    parser.add_argument("--towns", nargs="+", default=["Worcester"],
                        help="towns to search (default: Worcester)")
    parser.add_argument("--areas", nargs="+", default=DEFAULT_AREAS,
                        help=f"postcode areas to keep (default: {' '.join(DEFAULT_AREAS)})")
    parser.add_argument("--radius", type=float, default=30.0,
                        help="miles from Worcester to keep (default: 30)")
    parser.add_argument("--output-dir", type=Path, default=Path("data/out"),
                        help="where to write CSVs (default: data/out)")

    parser.add_argument("--ea-carriers-csv", default="",
                        help="local EA waste carriers register CSV")
    parser.add_argument("--ea-sites-csv", default="",
                        help="local EA permitted sites register CSV")

    parser.add_argument("--no-places", action="store_true",
                        help="skip Google Places (avoids all API cost)")
    parser.add_argument("--no-websites", action="store_true",
                        help="skip website scraping")
    parser.add_argument("--no-companies-house", action="store_true",
                        help="skip Companies House (leaves PECR status unknown)")
    parser.add_argument("--no-geocode", action="store_true",
                        help="skip postcode geocoding; filter on postcode area only")

    parser.add_argument("--max-places", type=int, default=200,
                        help="cap on paid Places lookups (default: 200)")
    parser.add_argument("--max-websites", type=int, default=300,
                        help="cap on website fetches (default: 300)")
    parser.add_argument("--min-score", type=int, default=0,
                        help="drop leads scoring below this before export")

    parser.add_argument("--push", choices=["airtable", "notion", "none"], default="none",
                        help="also push results to a CRM (default: none)")
    parser.add_argument("--verbose", "-v", action="store_true", help="debug logging")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    cfg = Config.from_env(
        areas=[area.upper() for area in args.areas],
        radius_miles=args.radius,
        output_dir=args.output_dir,
        ea_carriers_csv=args.ea_carriers_csv,
        ea_sites_csv=args.ea_sites_csv,
        use_google_places=not args.no_places,
        enrich_websites=not args.no_websites,
        use_companies_house=not args.no_companies_house,
        max_places_lookups=args.max_places,
        max_website_fetches=args.max_websites,
    )

    log = logging.getLogger("ripple")
    log.info("active sources: %s", ", ".join(cfg.describe_sources()) or "none")
    _warn_about_missing_keys(log, cfg, args)

    leads = pipeline.run(
        cfg,
        towns=args.towns,
        include_clients=args.mode in ("clients", "all"),
        include_supply=args.mode in ("carriers", "all"),
        geocode=not args.no_geocode,
    )

    if args.min_score:
        before = len(leads)
        leads = [lead for lead in leads if lead.score >= args.min_score]
        log.info("min-score filter: %d -> %d leads", before, len(leads))

    if not leads:
        log.warning("nothing to write")
        return 1

    written = csv_out.write_all(leads, cfg.output_dir)
    for label, path in written.items():
        log.info("  %-12s %s", label, path)

    if args.push != "none":
        client = pipeline.build_client(cfg)
        if args.push == "airtable":
            airtable.push(client, cfg, leads)
        else:
            notion.push(client, cfg, leads)

    _print_top(leads)
    return 0


def _warn_about_missing_keys(log: logging.Logger, cfg: Config, args) -> None:
    if cfg.use_companies_house and not cfg.companies_house_key:
        log.warning(
            "COMPANIES_HOUSE_API_KEY is not set: every lead will be treated as an "
            "individual subscriber and routed to the call list, not email."
        )
    if cfg.use_google_places and not cfg.google_places_key:
        log.warning("GOOGLE_PLACES_API_KEY is not set: no phone/website/review enrichment.")
    if args.mode in ("carriers", "all") and not (cfg.ea_carriers_csv or cfg.ea_sites_csv):
        log.info(
            "No local EA register given; will try the download URLs. If those fail, "
            "download the registers by hand and pass --ea-carriers-csv/--ea-sites-csv."
        )


def _print_top(leads: list[Lead], limit: int = 15) -> None:
    clients = [lead for lead in leads if lead.category == CLIENT]
    supply = [lead for lead in leads if lead.category in (CARRIER, FACILITY)]

    for label, group in (("TOP CLIENTS", clients), ("TOP CARRIERS/SITES", supply)):
        if not group:
            continue
        print(f"\n{label}")
        print(f"{'score':>5}  {'name':38} {'type':22} {'postcode':9} {'channel':18} contact")
        print("-" * 118)
        for lead in group[:limit]:
            contact = lead.email or lead.phone or "-"
            print(
                f"{lead.score:5d}  {lead.name[:38]:38} {lead.business_type[:22]:22} "
                f"{lead.postcode:9} {lead.outreach_channel:18} {contact[:28]}"
            )
    print()


if __name__ == "__main__":
    sys.exit(main())
