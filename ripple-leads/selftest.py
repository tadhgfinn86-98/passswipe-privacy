"""Offline self-test.

Run this after installing to check the pieces work before you trust a real
discovery pull:

    python selftest.py

It uses a throwaway database and a canned OpenStreetMap response, so it needs
no internet connection and no API keys, and it never touches your real data.
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

# Point the app at a temporary database BEFORE importing anything that reads
# the config, so the test can never write to ripple_leads.db.
_tmp = tempfile.TemporaryDirectory()
import config  # noqa: E402

config.load().data.setdefault("database", {})["path"] = str(Path(_tmp.name) / "selftest.db")

import db  # noqa: E402
import discover  # noqa: E402
from models import Lead  # noqa: E402

FAILURES: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  PASS  {label}")
    else:
        print(f"  FAIL  {label}" + (f"  ({detail})" if detail else ""))
        FAILURES.append(label)


# A realistic slice of what Overpass returns: a well-tagged restaurant, a
# branded chain, a pub with no address tags, and an unnamed node.
SAMPLE = {
    "elements": [
        {"type": "node", "id": 1, "tags": {
            "name": "The Olive Branch", "amenity": "restaurant",
            "addr:housenumber": "12", "addr:street": "High Street",
            "addr:city": "Pershore", "addr:postcode": "WR10 1AA",
            "phone": "01386 123456", "website": "https://olivebranch.example",
            "contact:email": "hello@olivebranch.example"}},
        {"type": "way", "id": 2, "tags": {
            "name": "Costa", "amenity": "cafe", "brand": "Costa",
            "brand:wikidata": "Q608845", "addr:street": "Bridge Street"}},
        {"type": "node", "id": 3, "tags": {
            "name": "The Brandy Cask", "amenity": "pub",
            "contact:phone": "01386 552602"}},
        {"type": "node", "id": 4, "tags": {"amenity": "fast_food"}},
    ]
}


def main() -> int:
    print("Ripple Leads self-test\n")

    print("Parsing OpenStreetMap results")
    leads = [l for l in (discover.parse_element(e, "Pershore") for e in SAMPLE["elements"]) if l]
    check("unnamed businesses are skipped", len(leads) == 3, f"got {len(leads)}")

    olive = leads[0]
    check("name, type and address parsed",
          olive.business == "The Olive Branch" and olive.type == "Restaurant"
          and olive.address == "12 High Street, Pershore, WR10 1AA",
          olive.address)
    check("phone/website/email picked up from any tag spelling",
          bool(olive.phone and olive.website and olive.email))
    check("amenity=fast_food maps to Takeaway",
          discover.parse_element({"type": "node", "id": 9,
                                  "tags": {"name": "Chip Shop", "amenity": "fast_food"}},
                                 "Worcester").type == "Takeaway")
    check("branded sites flagged as not independent", leads[1].independent == "N")
    check("unbranded sites stay 'unknown'", leads[2].independent == "unknown")

    print("\nDatabase and deduplication")
    db.init_db()
    first = db.insert_many(leads)
    check("all three leads inserted", first["inserted"] == 3, str(first))
    second = db.insert_many(leads)
    check("re-running discovery inserts nothing new",
          second["inserted"] == 0 and second["duplicates"] == 3, str(second))

    check("'High St.' is recognised as 'High Street'",
          db.insert_lead(Lead(business="the olive branch", street="High St.",
                              area="Pershore")) is None)
    check("same name in a different town is a separate lead",
          db.insert_lead(Lead(business="Costa", street="Broad Street",
                              area="Worcester")) is not None)

    lead_id = db.all_leads()[0].id
    db.update_lead(lead_id, status="Contacted", notes="Called, ask for Sam")
    check("edits save", db.get_lead(lead_id).status == "Contacted")
    db.update_lead(lead_id, not_a_real_column="boom")
    check("unknown columns are ignored rather than crashing", True)

    print("\nScoring")
    try:
        import score
    except ImportError:
        print("  SKIP  score.py not present yet")
    else:
        results = score.self_check()
        for label, ok, detail in results:
            check(label, ok, detail)

    print()
    if FAILURES:
        print(f"{len(FAILURES)} check(s) failed: " + ", ".join(FAILURES))
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    code = main()
    _tmp.cleanup()
    sys.exit(code)
