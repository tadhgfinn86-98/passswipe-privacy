import csv
import tempfile
import unittest
from pathlib import Path

from ripple.config import Config
from ripple.geo import haversine_miles, within_radius
from ripple.models import CARRIER, CLIENT, FACILITY, Lead
from ripple.outputs import csv_out
from ripple.pipeline import compliance, run as pipeline
from ripple.offline import DEMO_WEBSITES, OfflineClient

from ripple.offline import SAMPLE_DATA as FIXTURES


def demo_config(**overrides) -> Config:
    cfg = Config(
        companies_house_key="test-key",
        google_places_key="test-key",
        ea_carriers_csv=str(FIXTURES / "ea_carriers.csv"),
        ea_sites_csv=str(FIXTURES / "ea_sites.csv"),
        min_score_for_places=0,
    )
    for key, value in overrides.items():
        setattr(cfg, key, value)
    return cfg


class TestGeo(unittest.TestCase):
    def test_known_distance(self):
        # Worcester to Birmingham is roughly 25 miles as the crow flies.
        miles = haversine_miles(52.1885, -2.2206, 52.4862, -1.8904)
        self.assertTrue(20 < miles < 30, miles)

    def test_radius_wins_over_area_when_known(self):
        far = Lead(name="A", postcode="WR1 2NA", distance_miles=90.0)
        self.assertFalse(within_radius(far, 30, ["WR"]))

    def test_falls_back_to_area_without_coordinates(self):
        self.assertTrue(within_radius(Lead(name="A", postcode="WR1 2NA"), 30, ["WR"]))
        self.assertFalse(within_radius(Lead(name="B", postcode="NE1 4AA"), 30, ["WR"]))

    def test_no_postcode_is_excluded(self):
        self.assertFalse(within_radius(Lead(name="A"), 30, ["WR"]))


class TestEndToEnd(unittest.TestCase):
    def setUp(self):
        self.leads = pipeline.run(
            demo_config(),
            towns=["Worcester"],
            client=OfflineClient(websites=DEMO_WEBSITES),
        )
        self.by_name = {lead.name: lead for lead in self.leads}

    def test_produces_both_sides_of_the_market(self):
        categories = {lead.category for lead in self.leads}
        self.assertEqual(categories, {CLIENT, CARRIER, FACILITY})

    def test_excludes_out_of_radius_businesses(self):
        self.assertNotIn("Far North Waste Ltd", self.by_name)

    def test_excludes_revoked_and_surrendered_registrations(self):
        self.assertNotIn("Defunct Carriers Ltd", self.by_name)
        self.assertNotIn("Closed Sites Ltd", self.by_name)

    def test_results_are_ranked(self):
        scores = [lead.score for lead in self.leads]
        self.assertEqual(scores, sorted(scores, reverse=True))

    def test_enrichment_reaches_the_lead(self):
        bella = self.by_name["Bella's Cafe"]
        self.assertEqual(bella.company_number, "09876543")     # Companies House
        self.assertEqual(bella.review_count, 86)                # Google Places
        self.assertTrue(bella.email.endswith("bellascafe.example"))  # website scrape
        self.assertEqual(bella.directors, ["Anita Patel"])      # officers, after scoring

    def test_corporate_lead_is_email_safe(self):
        self.assertEqual(self.by_name["Bella's Cafe"].outreach_channel, compliance.EMAIL_OK)

    def test_unmatched_business_is_kept_off_the_email_list(self):
        # The Olive Branch has no Companies House match in the fixtures, so it
        # must not end up in the email queue even though we found an address.
        olive = self.by_name["The Olive Branch Ltd"]
        self.assertTrue(olive.email)
        self.assertEqual(olive.outreach_channel, compliance.PHONE_POST)
        self.assertNotIn(olive, compliance.email_safe(self.leads))

    def test_every_lead_has_a_compliance_decision(self):
        for lead in self.leads:
            self.assertIn(lead.pecr_status, {"corporate", "individual", "do-not-contact"})
            self.assertTrue(lead.outreach_channel)

    def test_csv_outputs_are_written_and_split(self):
        with tempfile.TemporaryDirectory() as tmp:
            written = csv_out.write_all(self.leads, Path(tmp))
            self.assertEqual(set(written), {"all", "clients", "carriers", "email_queue", "call_queue"})

            with written["all"].open() as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(len(rows), len(self.leads))
            self.assertIn("score_breakdown", rows[0])

            with written["email_queue"].open() as handle:
                email_rows = list(csv.DictReader(handle))
            for row in email_rows:
                self.assertEqual(row["outreach_channel"], compliance.EMAIL_OK)
                self.assertTrue(row["email"])

    def test_clients_only_mode_skips_the_registers(self):
        leads = pipeline.run(
            demo_config(), towns=["Worcester"], include_supply=False,
            client=OfflineClient(websites=DEMO_WEBSITES),
        )
        self.assertTrue(all(lead.category == CLIENT for lead in leads))

    def test_carriers_only_mode_skips_the_client_sources(self):
        leads = pipeline.run(
            demo_config(), towns=["Worcester"], include_clients=False,
            client=OfflineClient(),
        )
        self.assertTrue(all(lead.category in (CARRIER, FACILITY) for lead in leads))

    def test_empty_collection_returns_empty(self):
        cfg = demo_config(ea_carriers_csv="", ea_sites_csv="", ea_carriers_url="",
                          ea_sites_url="", use_fsa=False, use_companies_house=False)
        self.assertEqual(pipeline.run(cfg, client=OfflineClient()), [])


if __name__ == "__main__":
    unittest.main()
