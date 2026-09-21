import json
import unittest
from pathlib import Path

from ripple.config import Config
from ripple.models import CARRIER, FACILITY, Lead
from ripple.sources import companies_house, environment_agency, fsa, google_places
from ripple.offline import OfflineClient

from ripple.offline import SAMPLE_DATA as FIXTURES


class TestFsa(unittest.TestCase):
    def setUp(self):
        self.entries = json.loads((FIXTURES / "fsa_establishments.json").read_text())["establishments"]

    def test_maps_core_fields(self):
        lead = fsa._to_lead(self.entries[0])
        self.assertEqual(lead.name, "The Olive Branch Ltd")
        self.assertEqual(lead.postcode, "WR1 2NA")
        self.assertEqual(lead.business_type, "Restaurant/Cafe/Canteen")
        self.assertEqual(lead.fsa_rating, "5")
        self.assertAlmostEqual(lead.latitude, 52.1889)

    def test_prefers_town_over_county(self):
        lead = fsa._to_lead(self.entries[0])
        self.assertEqual(lead.town, "Worcester")
        self.assertEqual(lead.address, "12 Friar Street")

    def test_tolerates_null_geocode_and_messy_postcode(self):
        lead = fsa._to_lead(self.entries[1])
        self.assertIsNone(lead.latitude)
        self.assertEqual(lead.postcode, "WR3 9LT")

    def test_fetch_drops_nameless_records(self):
        leads = fsa.fetch(OfflineClient(), Config(), ["Worcester"])
        self.assertEqual(len(leads), 3)
        self.assertTrue(all(lead.name for lead in leads))


class TestCompaniesHouse(unittest.TestCase):
    def setUp(self):
        self.cfg = Config(companies_house_key="test-key")
        self.client = OfflineClient()

    def test_matches_on_name_and_postcode(self):
        lead = Lead(name="Bella's Cafe", postcode="WR9 8ER")
        companies_house.enrich(self.client, self.cfg, [lead])
        self.assertEqual(lead.company_number, "09876543")
        self.assertEqual(lead.company_type, "ltd")
        self.assertIsNotNone(lead.years_trading)

    def test_rejects_same_name_in_another_postcode(self):
        # The fixture also holds a BELLAS CAFE LIMITED in Manchester. Taking
        # it would attach the wrong company number, and so the wrong PECR
        # status, to a Worcester lead.
        lead = Lead(name="Bella's Cafe", postcode="B1 1AA")
        companies_house.enrich(self.client, self.cfg, [lead])
        self.assertEqual(lead.company_number, "")

    def test_no_key_means_no_requests(self):
        client = OfflineClient()
        companies_house.enrich(client, Config(companies_house_key=""), [Lead(name="A")])
        self.assertEqual(client.calls, [])

    def test_officers_exclude_resigned_and_corporate(self):
        names = companies_house.fetch_officers(self.client, self.cfg, "09876543")
        self.assertEqual(names, ["Anita Patel"])

    def test_officers_respect_score_threshold(self):
        low = Lead(name="A", company_number="09876543", score=10)
        high = Lead(name="B", company_number="09876543", score=80)
        companies_house.enrich_officers(self.client, self.cfg, [low, high], min_score=50)
        self.assertEqual(low.directors, [])
        self.assertEqual(high.directors, ["Anita Patel"])


class TestEnvironmentAgency(unittest.TestCase):
    def setUp(self):
        self.cfg = Config(
            ea_carriers_csv=str(FIXTURES / "ea_carriers.csv"),
            ea_sites_csv=str(FIXTURES / "ea_sites.csv"),
        )
        self.client = OfflineClient()

    def test_reads_carriers_and_drops_revoked(self):
        leads = environment_agency.fetch_carriers(self.client, self.cfg)
        names = [lead.name for lead in leads]
        self.assertIn("Severn Waste Services Ltd", names)
        self.assertNotIn("Defunct Carriers Ltd", names)
        self.assertTrue(all(lead.category == CARRIER for lead in leads))

    def test_normalises_tier(self):
        leads = {lead.name: lead for lead in environment_agency.fetch_carriers(self.client, self.cfg)}
        self.assertEqual(leads["Severn Waste Services Ltd"].ea_tier, "upper")
        self.assertEqual(leads["J Brown Haulage"].ea_tier, "lower")

    def test_reads_sites_and_drops_surrendered(self):
        leads = environment_agency.fetch_sites(self.client, self.cfg)
        names = [lead.name for lead in leads]
        self.assertIn("Severn Waste Services Ltd", names)
        self.assertNotIn("Closed Sites Ltd", names)
        self.assertTrue(all(lead.category == FACILITY for lead in leads))

    def test_missing_local_file_is_not_fatal(self):
        cfg = Config(ea_carriers_csv="/nonexistent/path.csv", ea_carriers_url="")
        self.assertEqual(environment_agency.fetch_carriers(self.client, cfg), [])

    def test_column_resolution_survives_renamed_headers(self):
        resolved = environment_agency.resolve_columns(
            ["regNo", "organisationName", "tier", "status", "addressLine1", "postcode"],
            environment_agency.CARRIER_COLUMNS,
        )
        self.assertEqual(resolved["registration"], "regNo")
        self.assertEqual(resolved["name"], "organisationName")
        self.assertEqual(resolved["postcode"], "postcode")


class TestGooglePlaces(unittest.TestCase):
    def test_rejects_a_different_business(self):
        self.assertIsNone(google_places._best_match(
            Lead(name="Bella's Cafe"),
            [{"id": "1", "displayName": {"text": "Tony's Pizza"}, "businessStatus": "OPERATIONAL"}],
        ))

    def test_rejects_permanently_closed(self):
        self.assertIsNone(google_places._best_match(
            Lead(name="Gone Cafe"),
            [{"id": "1", "displayName": {"text": "Gone Cafe"},
              "businessStatus": "CLOSED_PERMANENTLY"}],
        ))

    def test_does_not_overwrite_official_data(self):
        lead = Lead(name="A", phone="01905 111111")
        google_places._apply(lead, {
            "id": "X", "displayName": {"text": "A"},
            "nationalPhoneNumber": "09999 999999", "websiteUri": "https://a.example",
            "rating": 4.1, "userRatingCount": 40,
        })
        self.assertEqual(lead.phone, "01905 111111")
        self.assertEqual(lead.website, "https://a.example")
        self.assertEqual(lead.review_count, 40)

    def test_no_key_means_no_requests(self):
        client = OfflineClient()
        google_places.enrich(client, Config(google_places_key=""), [Lead(name="A", score=99)])
        self.assertEqual(client.calls, [])

    def test_budget_is_respected(self):
        cfg = Config(google_places_key="k", max_places_lookups=2, min_score_for_places=0)
        client = OfflineClient()
        leads = [Lead(name=f"Lead {i}", score=50) for i in range(10)]
        google_places.enrich(client, cfg, leads)
        self.assertEqual(len(client.calls), 2)


if __name__ == "__main__":
    unittest.main()
