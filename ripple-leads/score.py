"""SCORE - rank leads 0-100 with plain Python. No AI involved.

Deliberately deterministic: the same lead always scores the same, and you can
read config.yaml to see exactly why. That matters when you are deciding who to
drive to on a Tuesday morning - an unexplainable score is not actionable.

Tune the weights in config.yaml under `scoring:`. Nothing here is hardcoded
except the 0-100 clamp.
"""

from __future__ import annotations

from typing import Any, Optional

import config
from models import Lead


def score_lead(lead: Lead, cfg: Optional[config.Config] = None) -> dict[str, Any]:
    """Score one lead and derive its priority and outreach lane.

    Returns a dict with the score, the priority band, the suggested lane and
    a `reasons` breakdown - the breakdown is shown in the UI so you can see
    what earned the points.
    """
    cfg = cfg or config.load()
    rubric = cfg.get("scoring", {}) or {}
    reasons: list[tuple[str, int]] = []

    def award(label: str, points: Any) -> None:
        points = int(points or 0)
        if points:
            reasons.append((label, points))

    # 1. Business type. Restaurants and takeaways make the most food waste
    #    per site, so they carry the most weight.
    type_weights = rubric.get("type_weights", {}) or {}
    award(f"Type: {lead.type}", type_weights.get(lead.type, 0))

    # 2. Reachability. A lead you cannot contact is not a lead.
    if lead.phone:
        award("Has phone", rubric.get("has_phone", 0))
    if lead.website:
        award("Has website", rubric.get("has_website", 0))
    if lead.email:
        award("Has email", rubric.get("has_email", 0))

    # 3. Independence. Chains buy waste centrally through head office, so an
    #    independent is far more likely to be able to say yes to you.
    #    Only a confirmed "Y" scores - "unknown" earns nothing either way.
    if lead.independent == "Y":
        award("Independent", rubric.get("independent", 0))

    # 4. Not yet compliant - an open Duty of Care gap is the whole pitch.
    if lead.compliant_yet == "N":
        award("Not compliant yet", rubric.get("not_compliant_yet", 0))

    # 5. On route. Sites in your towns are cheap to visit and cheap to serve.
    if lead.area and lead.area in cfg.town_names:
        award("On route", rubric.get("on_route", 0))

    # 6. Estimated monthly spend. Tiers are checked top-down, first match wins.
    spend = lead.est_monthly_spend
    if spend:
        for tier in rubric.get("spend_tiers", []) or []:
            if spend >= float(tier.get("min", 0)):
                award(f"Spend £{spend:,.0f}/mo", tier.get("points", 0))
                break

    total = sum(points for _, points in reasons)
    # Clamp: weights are user-editable, so nothing stops someone setting them
    # to 500. A score outside 0-100 would break the priority bands.
    total = max(0, min(100, total))

    high = int(rubric.get("priority_high", 70))
    medium = int(rubric.get("priority_medium", 45))
    priority = "High" if total >= high else "Medium" if total >= medium else "Low"

    return {
        "score": total,
        "priority": priority,
        "suggested_lane": suggest_lane(lead),
        "reasons": reasons,
    }


def suggest_lane(lead: Lead) -> str:
    """Cheapest effective way to make first contact.

    Email scales and costs nothing, so it wins where we have an address.
    Phone is next. A walk-in costs you a drive, so it is the fallback - which
    is fine, because most OSM leads will land here and walk-ins convert well
    for a local broker.
    """
    if lead.email:
        return "Email"
    if lead.phone:
        return "Call"
    return "Walk-in"


def rescore_all(cfg: Optional[config.Config] = None) -> int:
    """Recalculate every lead. Run after editing weights or bulk-editing data."""
    import db

    cfg = cfg or config.load()
    updated = 0
    for lead in db.all_leads():
        result = score_lead(lead, cfg)
        # Only write when something actually changed - keeps updated_at
        # meaningful instead of resetting it on every lead every time.
        if (result["score"] != lead.score
                or result["priority"] != lead.priority
                or result["suggested_lane"] != lead.suggested_lane):
            db.update_lead(
                lead.id,
                score=result["score"],
                priority=result["priority"],
                suggested_lane=result["suggested_lane"],
            )
            updated += 1
    return updated


def explain(lead: Lead, cfg: Optional[config.Config] = None) -> str:
    """One-line human-readable breakdown, e.g. 'Type: Restaurant +30, ...'."""
    result = score_lead(lead, cfg)
    if not result["reasons"]:
        return "No points scored - fill in type, phone, email or spend."
    return " · ".join(f"{label} +{points}" for label, points in result["reasons"])


def self_check() -> list[tuple[str, bool, str]]:
    """Checks run by selftest.py. Returns (label, passed, detail) tuples."""
    cfg = config.load()
    out: list[tuple[str, bool, str]] = []

    # A strong lead: independent restaurant, reachable, on route, spending well.
    strong = Lead(business="A", type="Restaurant", area=cfg.town_names[0] if cfg.town_names else "",
                  phone="01905 1", website="x", email="a@b.c", independent="Y",
                  compliant_yet="N", est_monthly_spend=500)
    strong_result = score_lead(strong, cfg)
    out.append(("strong lead scores High", strong_result["priority"] == "High",
                str(strong_result["score"])))
    out.append(("lead with an email is routed to Email",
                strong_result["suggested_lane"] == "Email", strong_result["suggested_lane"]))

    # A weak lead: unknown everything, no contact details.
    weak = Lead(business="B", type="Other", area="Elsewhere")
    weak_result = score_lead(weak, cfg)
    out.append(("bare lead scores Low", weak_result["priority"] == "Low",
                str(weak_result["score"])))
    out.append(("lead with no contact details is a Walk-in",
                weak_result["suggested_lane"] == "Walk-in", weak_result["suggested_lane"]))

    phone_only = Lead(business="C", type="Pub", phone="01905 2")
    out.append(("phone but no email is routed to Call",
                score_lead(phone_only, cfg)["suggested_lane"] == "Call", ""))

    # "unknown" must never score - that is what stops guesses inflating ranks.
    unknown = Lead(business="D", type="Cafe", independent="unknown", compliant_yet="unknown")
    known = Lead(business="D", type="Cafe", independent="Y", compliant_yet="N")
    out.append(("'unknown' scores nothing",
                score_lead(unknown, cfg)["score"] < score_lead(known, cfg)["score"], ""))

    # Scores must stay inside 0-100 even with silly weights.
    silly = config.Config({"scoring": {"type_weights": {"Restaurant": 5000},
                                       "priority_high": 70, "priority_medium": 45}})
    out.append(("score is clamped to 100",
                score_lead(Lead(business="E", type="Restaurant"), silly)["score"] == 100, ""))

    # The rubric is data, so a changed weight must change the result.
    tweaked = config.Config({"scoring": {"type_weights": {"Cafe": 99},
                                         "priority_high": 70, "priority_medium": 45}})
    out.append(("editing config.yaml changes the score",
                score_lead(Lead(business="F", type="Cafe"), tweaked)["score"] == 99, ""))

    return out
