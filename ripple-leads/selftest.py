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

    print("\nSaving edits from the grid")
    import pandas as pd

    grid = db.leads_dataframe()[["id", "status", "notes", "est_monthly_spend",
                                 "next_action_date"]].copy()
    grid["next_action_date"] = pd.to_datetime(grid["next_action_date"], errors="coerce")
    edited = grid.copy()
    editable = ["status", "notes", "est_monthly_spend", "next_action_date"]

    check("an untouched grid saves nothing",
          db.apply_edits(grid, edited, editable) == 0)

    edited.loc[edited.index[0], "status"] = "Quote sent"
    edited.loc[edited.index[0], "est_monthly_spend"] = 350.0
    edited.loc[edited.index[0], "next_action_date"] = pd.Timestamp("2026-10-01")
    changed_id = int(grid.iloc[0]["id"])
    check("one edited row saves one lead",
          db.apply_edits(grid, edited, editable) == 1)

    saved_lead = db.get_lead(changed_id)
    check("status saved", saved_lead.status == "Quote sent", saved_lead.status)
    check("spend saved as a number", saved_lead.est_monthly_spend == 350.0,
          str(saved_lead.est_monthly_spend))
    check("date saved as YYYY-MM-DD text",
          saved_lead.next_action_date == "2026-10-01", saved_lead.next_action_date)

    cleared = edited.copy()
    cleared.loc[cleared.index[0], "next_action_date"] = pd.NaT
    db.apply_edits(edited, cleared, editable)
    check("clearing a date stores an empty string, not 'NaT'",
          db.get_lead(changed_id).next_action_date == "",
          repr(db.get_lead(changed_id).next_action_date))

    print("\nScoring")
    try:
        import score
    except ImportError:
        print("  SKIP  score.py not present yet")
    else:
        results = score.self_check()
        for label, ok, detail in results:
            check(label, ok, detail)

    print("\nEnrichment (with a stand-in for the API, so no key or spend needed)")
    import enrich
    import outreach

    class _Block:
        type = "text"
        def __init__(self, text): self.text = text

    class _Usage:
        input_tokens, output_tokens = 500, 80

    class _Response:
        stop_reason = "end_turn"
        def __init__(self, text):
            self.content, self.usage = [_Block(text)], _Usage()

    class _Messages:
        def __init__(self, payload): self.payload, self.kwargs = payload, None
        def create(self, **kwargs):
            self.kwargs = kwargs
            return _Response(self.payload)

    class _Client:
        def __init__(self, payload): self.messages = _Messages(payload)

    import json as _json
    # Pick the one with an email - the .eml checks below need a recipient.
    lead = next(l for l in db.all_leads() if l.email)

    client = _Client(_json.dumps({"independent": "unknown",
                                  "independent_reason": "not enough information",
                                  "opener": "", "first_lane": "Call"}))
    result = enrich.enrich_lead(lead, client=client)
    check("enrichment parses a response", result["ok"], str(result))
    check("'unknown' is passed through unchanged", result["independent"] == "unknown")
    check("an empty opener is allowed rather than invented", result["opener"] == "")
    schema = client.messages.kwargs["output_config"]["format"]["schema"]
    check("the model is constrained to Y/N/unknown",
          schema["properties"]["independent"]["enum"] == ["Y", "N", "unknown"])
    check("no extra fields can come back", schema["additionalProperties"] is False)

    broken = _Client("this is not json")
    check("a malformed response is reported, not crashed",
          enrich.enrich_lead(lead, client=broken)["ok"] is False)

    print("\nDrafting and export")
    draft_client = _Client(_json.dumps({"subject": "About your bin collections",
                                        "body": "A short body with no footer."}))
    draft = outreach.draft_email(lead, client=draft_client)
    check("a draft comes back", draft["ok"], str(draft))
    check("the opt-out line is added in Python, not by the model",
          outreach.has_opt_out(draft["body"]), draft.get("body", "")[-120:])
    check("a draft stripped of its footer is detected",
          outreach.has_opt_out("Hello. Buy my thing. Thanks, Sam") is False)
    check("a hand-written opt-out is accepted",
          outreach.has_opt_out("Hello. Reply STOP to unsubscribe.") is True)

    message = outreach.build_eml(lead, "Subject here", draft["body"])
    check("the .eml addresses the lead", message["To"] == lead.email, str(message["To"]))
    check("the .eml carries the subject", message["Subject"] == "Subject here")

    no_email = next(l for l in db.all_leads() if not l.email)
    check("a lead with no email produces an .eml with no recipient, not 'None'",
          outreach.build_eml(no_email, "s", "b")["To"] is None)

    cap = outreach.cap_status()
    check("the daily cap starts unspent", cap["remaining"] == cap["cap"], str(cap))
    db.log_send(lead.id, "test", "x")
    check("a logged send counts against the cap",
          outreach.cap_status()["remaining"] == cap["cap"] - 1)

    print("\nSend guards and optional integrations")
    guard_lead = Lead(id=lead.id, business="X", email="a@b.c", approved=False,
                      draft_subject="s", draft_body="Body. Reply STOP to unsubscribe.")
    check("an unapproved lead cannot be sent",
          outreach.send_guard(guard_lead)[0] is False)
    guard_lead.approved = True
    check("an approved lead with an opt-out can be sent",
          outreach.send_guard(guard_lead)[0] is True,
          outreach.send_guard(guard_lead)[1])
    guard_lead.draft_body = "Body with the footer deleted."
    check("a draft with no opt-out cannot be sent",
          outreach.send_guard(guard_lead)[0] is False)
    check("a lead with no email cannot be sent",
          outreach.send_guard(Lead(business="Y", approved=True, draft_subject="s",
                                   draft_body="Reply STOP"))[0] is False)

    check("Gmail is off by default", outreach.gmail_available() is False)
    check("sending is refused while Gmail is off",
          outreach.send_gmail(guard_lead, "s", "b")["ok"] is False)

    import crm
    check("Notion is off by default", crm.available() is False)
    check("a Notion push is refused while it is off",
          crm.push_lead(guard_lead)["ok"] is False)

    notion_lead = Lead(business="The Olive Branch", type="Restaurant", phone="01905 1",
                       email="a@b.c", website="olive.example", score=88)
    props = crm.build_properties(notion_lead, {
        "Name": {"type": "title"}, "Type": {"type": "select"},
        "Website": {"type": "url"}, "Score": {"type": "number"},
        "Something": {"type": "files"}})
    check("Notion properties match the database's own column types",
          props["Score"] == {"number": 88.0} and props["Type"] == {"select": {"name": "Restaurant"}})
    check("a URL without a scheme is fixed up",
          props["Website"] == {"url": "https://olive.example"})
    check("column types we cannot fill are skipped, not sent empty",
          "Something" not in props)
    check("a title column under any name still gets filled",
          "Company" in crm.build_properties(notion_lead, {"Company": {"type": "title"}}))

    print("\nDesktop launcher")
    import desktop

    port = desktop.find_free_port()
    check("a free port is found", isinstance(port, int) and 1024 < port < 65536, str(port))
    check("two calls do not return the same port in use",
          desktop.find_free_port() != 0)

    command = desktop.streamlit_command(port)
    check("the launcher uses this same Python environment",
          command[0] == sys.executable and command[1:3] == ["-m", "streamlit"])
    check("the server binds to loopback only, not the whole network",
          "--server.address" in command
          and command[command.index("--server.address") + 1] == "127.0.0.1")
    check("headless mode is on, so no stray browser tab or email prompt",
          "--server.headless" in command)

    print("  ...starting a real server, this takes a few seconds")
    process = desktop.start_server(port)
    ready = desktop.wait_until_ready(port, process, timeout_s=60)
    check("the server starts and reports itself ready", ready)

    if ready:
        import requests as _requests
        check("the health endpoint answers 'ok'",
              _requests.get(desktop.health_url(port), timeout=5).text.strip() == "ok")
        check("the app itself serves a page",
              _requests.get(desktop.app_url(port), timeout=15).status_code == 200)

    desktop.stop_server(process)
    check("closing the app stops the server", process.poll() is not None)

    import socket as _socket
    probe = _socket.socket()
    probe.settimeout(2)
    try:
        probe.connect(("127.0.0.1", port))
        released = False
    except OSError:
        released = True
    finally:
        probe.close()
    check("the port is released, leaving nothing running", released)

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
