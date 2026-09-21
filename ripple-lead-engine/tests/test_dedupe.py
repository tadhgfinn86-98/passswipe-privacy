import unittest

from ripple.models import CARRIER, Lead
from ripple.pipeline.dedupe import deduplicate, merge_into


class TestDeduplicate(unittest.TestCase):
    def test_merges_spelling_variants_in_same_postcode(self):
        leads = deduplicate([
            Lead(name="Bella's Cafe", postcode="WR9 8ER", fsa_id="123", sources=["fsa"]),
            Lead(name="BELLAS CAFE LIMITED", postcode="WR9 8ER", company_number="09876543",
                 sources=["companies_house"]),
        ])
        self.assertEqual(len(leads), 1)
        self.assertEqual(leads[0].fsa_id, "123")
        self.assertEqual(leads[0].company_number, "09876543")
        self.assertEqual(sorted(leads[0].sources), ["companies_house", "fsa"])

    def test_keeps_different_businesses_apart(self):
        leads = deduplicate([
            Lead(name="Kings Arms", postcode="WR1 2NA"),
            Lead(name="Kings Head", postcode="WR1 2NA"),
        ])
        self.assertEqual(len(leads), 2)

    def test_same_name_different_postcode_is_not_merged(self):
        leads = deduplicate([
            Lead(name="Bella's Cafe", postcode="WR9 8ER"),
            Lead(name="Bella's Cafe", postcode="B1 1AA"),
        ])
        self.assertEqual(len(leads), 2)

    def test_categories_never_merge(self):
        # A company can be both a client and a licensed carrier; those are
        # two different relationships and must stay two rows.
        leads = deduplicate([
            Lead(name="Severn Waste Services Ltd", postcode="WR4 9EL"),
            Lead(name="Severn Waste Services Ltd", postcode="WR4 9EL", category=CARRIER),
        ])
        self.assertEqual(len(leads), 2)

    def test_drops_nameless_leads(self):
        self.assertEqual(deduplicate([Lead(name="", postcode="WR1 2NA")]), [])


class TestMergeInto(unittest.TestCase):
    def test_fills_gaps_without_overwriting(self):
        target = Lead(name="A", phone="01905 111", sources=["fsa"])
        other = Lead(name="A", phone="01905 999", email="a@b.co.uk", sources=["google_places"])
        merge_into(target, other)

        self.assertEqual(target.phone, "01905 111")   # existing value wins
        self.assertEqual(target.email, "a@b.co.uk")   # gap filled
        self.assertEqual(sorted(target.sources), ["fsa", "google_places"])

    def test_keeps_larger_review_count_and_earliest_sighting(self):
        target = Lead(name="A", review_count=10, first_seen="2026-02-01", last_seen="2026-02-01")
        other = Lead(name="A", review_count=250, first_seen="2026-01-01", last_seen="2026-03-01")
        merge_into(target, other)

        self.assertEqual(target.review_count, 250)
        self.assertEqual(target.first_seen, "2026-01-01")
        self.assertEqual(target.last_seen, "2026-03-01")


if __name__ == "__main__":
    unittest.main()
