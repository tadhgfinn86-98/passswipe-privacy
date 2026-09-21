"""Score leads so the outreach queue is ordered by who is worth calling first.

Scores run 0-100 and are built from a breakdown dict, so every number in the
CSV can be explained back to the reason it got there. Clients and carriers
score on different things: a client is graded on how much waste it makes and
how reachable it is, a carrier on whether it can actually take work on.
"""

from __future__ import annotations

from ..models import CARRIER, CLIENT, FACILITY, Lead

# How much trade waste a business type implies, and how well it fits Ripple's
# restaurant-and-warehouse starting niche.
CLIENT_TYPE_WEIGHTS = {
    # FSA business types
    "restaurant/cafe/canteen": 30,
    "takeaway/sandwich shop": 26,
    "pub/bar/nightclub": 28,
    "hotel/bed & breakfast/guest house": 28,
    "retailers - supermarkets/hypermarkets": 30,
    "retailers - other": 16,
    "manufacturers/packers": 24,
    "distributors/transporters": 22,
    "hospitals/childcare/caring premises": 20,
    "school/college/university": 18,
    "mobile caterer": 8,
    "other catering premises": 14,
    "farmers/growers": 10,
    "importers/exporters": 10,
    # Companies House SIC labels
    "licensed restaurant": 30,
    "unlicensed restaurant/cafe": 26,
    "takeaway": 26,
    "pub/bar": 28,
    "hotel": 28,
    "warehousing/storage": 25,
    "warehousing (refrigerated)": 27,
    "property management": 29,
    "supermarket/convenience": 30,
}
DEFAULT_TYPE_WEIGHT = 10

# Review count is the best free proxy we have for footfall, and footfall is
# the best proxy for bin volume.
REVIEW_BANDS = [(500, 15), (200, 12), (75, 9), (25, 6), (5, 3)]

# Years trading: a business past its first two years is likelier to still be
# there in six months, and likelier to have an incumbent contract to displace.
AGE_BANDS = [(10, 10), (5, 8), (2, 5), (1, 2)]

DISTANCE_BANDS = [(5, 15), (10, 12), (20, 8), (30, 4)]

# Carrier scoring
CARRIER_TIER_POINTS = {"upper": 35, "lower": 10}


def score_lead(lead: Lead) -> Lead:
    """Attach score and score_breakdown to one lead."""
    if lead.category == CLIENT:
        breakdown = _score_client(lead)
    else:
        breakdown = _score_supply(lead)

    # A lead we must not contact is worth nothing to the outreach queue,
    # whatever else it scores on.
    if lead.outreach_channel == "do_not_contact":
        breakdown = {"do_not_contact": 0}

    lead.score_breakdown = breakdown
    lead.score = max(0, min(100, sum(breakdown.values())))
    return lead


def _score_client(lead: Lead) -> dict[str, int]:
    breakdown = {
        "business_type": CLIENT_TYPE_WEIGHTS.get(
            (lead.business_type or "").strip().lower(), DEFAULT_TYPE_WEIGHT
        ),
        "size": _band(lead.review_count, REVIEW_BANDS),
        "age": _band(lead.years_trading, AGE_BANDS),
        "contactability": _contactability(lead),
        "proximity": _proximity(lead),
        "corroboration": 5 if len(set(lead.sources)) >= 2 else 0,
    }
    # A named director is a warm opening on the phone.
    if lead.directors:
        breakdown["named_contact"] = 4
    return breakdown


def _score_supply(lead: Lead) -> dict[str, int]:
    """Carriers and facilities: can they take work, and are they close?"""
    breakdown = {
        "tier": CARRIER_TIER_POINTS.get(lead.ea_tier, 15 if lead.category == FACILITY else 5),
        "contactability": _contactability(lead),
        "proximity": _proximity(lead),
        "corroboration": 5 if len(set(lead.sources)) >= 2 else 0,
    }
    if lead.category == FACILITY and lead.ea_permit_type:
        # A named permit type tells us what they can actually accept.
        breakdown["permit_detail"] = 8
    if lead.category == CARRIER:
        # Being on the register at all is the licence we need them to hold.
        breakdown["licensed"] = 10
    return breakdown


def _contactability(lead: Lead) -> int:
    """How ready this lead is to be contacted today."""
    points = 0
    if lead.email:
        points += 8
    if lead.phone:
        points += 6
    if lead.website:
        points += 2
    return points


def _proximity(lead: Lead) -> int:
    if lead.distance_miles is None:
        # Unknown distance still passed the area filter, so give it the
        # benefit of the doubt at the bottom band rather than zero.
        return 4
    return _band(lead.distance_miles, DISTANCE_BANDS, ascending=False)


def _band(value, bands: list[tuple[float, int]], ascending: bool = True) -> int:
    """Score a value against (threshold, points) bands.

    ascending=True  -> more is better (reviews, years trading)
    ascending=False -> less is better (distance)
    """
    if value is None:
        return 0
    for threshold, points in bands:
        if ascending and value >= threshold:
            return points
        if not ascending and value <= threshold:
            return points
    return 0


def apply(leads: list[Lead]) -> list[Lead]:
    for lead in leads:
        score_lead(lead)
    return leads


def rank(leads: list[Lead]) -> list[Lead]:
    """Highest score first; ties broken by distance, then name."""
    return sorted(
        leads,
        key=lambda lead: (-lead.score, lead.distance_miles if lead.distance_miles is not None else 999, lead.name),
    )
