import unittest

from ripple.models import Lead
from ripple.pipeline import compliance


class TestPecrClassification(unittest.TestCase):
    def test_limited_company_may_be_emailed(self):
        lead = compliance.classify(Lead(name="A", company_type="ltd", company_status="active"))
        self.assertEqual(lead.pecr_status, compliance.CORPORATE)
        self.assertEqual(lead.outreach_channel, compliance.EMAIL_OK)

    def test_llp_and_plc_are_corporate(self):
        for company_type in ["llp", "plc", "community-interest-company"]:
            lead = compliance.classify(
                Lead(name="A", company_type=company_type, company_status="active")
            )
            self.assertEqual(lead.outreach_channel, compliance.EMAIL_OK, company_type)

    def test_unmatched_business_defaults_to_individual(self):
        # A sole trader is not in Companies House at all, so "no match" must
        # fail safe to phone/post rather than to email.
        lead = compliance.classify(Lead(name="Dave's Chippy"))
        self.assertEqual(lead.pecr_status, compliance.INDIVIDUAL)
        self.assertEqual(lead.outreach_channel, compliance.PHONE_POST)

    def test_unknown_company_type_fails_safe(self):
        lead = compliance.classify(
            Lead(name="A", company_type="some-future-type", company_status="active")
        )
        self.assertEqual(lead.outreach_channel, compliance.PHONE_POST)

    def test_dissolved_company_is_do_not_contact(self):
        lead = compliance.classify(
            Lead(name="A", company_type="ltd", company_status="dissolved")
        )
        self.assertEqual(lead.outreach_channel, compliance.NO_CONTACT)

    def test_queues_require_a_contact_detail(self):
        emailable = Lead(name="A", company_type="ltd", company_status="active",
                         email="a@b.co.uk")
        no_email = Lead(name="B", company_type="ltd", company_status="active")
        callable_lead = Lead(name="C", phone="01905 1")
        leads = [compliance.classify(l) for l in [emailable, no_email, callable_lead]]

        self.assertEqual([l.name for l in compliance.email_safe(leads)], ["A"])
        self.assertEqual([l.name for l in compliance.call_list(leads)], ["C"])


if __name__ == "__main__":
    unittest.main()
