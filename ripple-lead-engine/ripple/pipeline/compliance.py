"""PECR classification: who may be cold-emailed, and who may not.

Under PECR, unsolicited marketing email is allowed to "corporate subscribers"
- limited companies, PLCs, LLPs, and (in Scotland) partnerships - provided
every message carries a working opt-out and identifies the sender. Sole
traders and ordinary partnerships count as individual subscribers and need
prior consent, so they are phone-or-post only.

The Companies House company_type is what decides this, which is why the
Companies House step runs before outreach. A lead we could not match to a
company is treated as an individual: that is the safe direction to be wrong
in, and it costs one phone call instead of a complaint.

This encodes the general rule so the pipeline sorts leads for you. It is not
legal advice - check the ICO's direct marketing guidance before running a
large campaign, and honour the TPS/CTPS before cold-calling.
"""

from __future__ import annotations

from ..models import Lead

# Corporate subscribers: cold email allowed with an opt-out.
CORPORATE_TYPES = {
    "ltd",
    "plc",
    "llp",
    "private-limited-guarant-nsc",
    "private-limited-guarant-nsc-limited-exemption",
    "private-unlimited",
    "private-unlimited-nsc",
    "old-public-company",
    "private-limited-shares-section-30-exemption",
    "industrial-and-provident-society",
    "registered-society-non-jurisdictional",
    "community-interest-company",
    "charitable-incorporated-organisation",
    "royal-charter",
    "scottish-partnership",
    "limited-partnership",
    "northern-ireland",
    "converted-closed",
    "uk-establishment",
    "eeig",
    "ukeig",
    "further-education-or-sixth-form-college-corporation",
}

# Statuses meaning "corporate, but do not market to it".
DEAD_STATUSES = {"dissolved", "liquidation", "receivership", "administration", "converted-closed"}

CORPORATE = "corporate"
INDIVIDUAL = "individual"
UNKNOWN_DORMANT = "do-not-contact"

EMAIL_OK = "email_with_optout"
PHONE_POST = "phone_or_post_only"
NO_CONTACT = "do_not_contact"


def classify(lead: Lead) -> Lead:
    """Set pecr_status and outreach_channel on a lead."""
    company_type = (lead.company_type or "").strip().lower()
    status = (lead.company_status or "").strip().lower()

    if status in DEAD_STATUSES:
        lead.pecr_status = UNKNOWN_DORMANT
        lead.outreach_channel = NO_CONTACT
        return lead

    if company_type in CORPORATE_TYPES:
        lead.pecr_status = CORPORATE
        lead.outreach_channel = EMAIL_OK
        return lead

    # No company match, or a type we do not recognise as corporate: assume an
    # individual subscriber and route away from email.
    lead.pecr_status = INDIVIDUAL
    lead.outreach_channel = PHONE_POST
    return lead


def apply(leads: list[Lead]) -> list[Lead]:
    for lead in leads:
        classify(lead)
    return leads


def email_safe(leads: list[Lead]) -> list[Lead]:
    """The subset you may cold-email, given an opt-out in every message."""
    return [
        lead for lead in leads
        if lead.outreach_channel == EMAIL_OK and lead.email
    ]


def call_list(leads: list[Lead]) -> list[Lead]:
    """The subset to phone instead. Screen against the TPS/CTPS first."""
    return [
        lead for lead in leads
        if lead.outreach_channel == PHONE_POST and lead.phone
    ]
