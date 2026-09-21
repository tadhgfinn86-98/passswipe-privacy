import unittest

from ripple.models import (
    Lead, normalise_name, normalise_postcode, outward_code, postcode_area, years_between,
)


class TestNormalisation(unittest.TestCase):
    def test_postcode_is_idempotent(self):
        for raw in ["wr13pb", "WR1 3PB", "  wr1  3pb ", "WR13PB"]:
            once = normalise_postcode(raw)
            self.assertEqual(once, "WR1 3PB")
            self.assertEqual(normalise_postcode(once), once)

    def test_postcode_rejects_nonsense(self):
        for raw in ["", "nonsense", "1", None, "WR1 3PB EXTRA"]:
            self.assertEqual(normalise_postcode(raw), "")

    def test_area_and_outward(self):
        self.assertEqual(outward_code("WR1 3PB"), "WR1")
        self.assertEqual(postcode_area("WR1 3PB"), "WR")
        self.assertEqual(postcode_area("B1 1AA"), "B")
        self.assertEqual(postcode_area("rubbish"), "")

    def test_apostrophes_do_not_split_names(self):
        # Regression: "Bella's" used to normalise to "bella s", which stopped
        # it matching "BELLAS CAFE LIMITED" in Companies House.
        self.assertEqual(normalise_name("Bella's Cafe"), normalise_name("BELLAS CAFE LIMITED"))
        self.assertEqual(normalise_name("O'Neill's Bar"), normalise_name("ONEILLS BAR LTD"))

    def test_company_suffixes_and_ampersands(self):
        self.assertEqual(normalise_name("Smith & Sons Limited"), "smith sons")
        self.assertEqual(normalise_name("The Olive Branch Ltd"), "olive branch")

    def test_years_between(self):
        self.assertIsNone(years_between(""))
        self.assertIsNone(years_between("not-a-date"))
        self.assertGreater(years_between("2015-01-01"), 9)


class TestLead(unittest.TestCase):
    def test_lead_id_is_stable_and_category_scoped(self):
        a = Lead(name="The Olive Branch Ltd", postcode="wr1 2na")
        b = Lead(name="THE OLIVE BRANCH LIMITED", postcode="WR1 2NA")
        self.assertEqual(a.lead_id, b.lead_id)

        carrier = Lead(name="The Olive Branch Ltd", postcode="WR1 2NA", category="carrier")
        self.assertNotEqual(a.lead_id, carrier.lead_id)

    def test_to_row_flattens_lists(self):
        lead = Lead(name="X", sources=["fsa", "fsa", "google_places"], directors=["A B"])
        row = lead.to_row()
        self.assertEqual(row["directors"], "A B")
        self.assertEqual(row["sources"], "fsa;google_places")


if __name__ == "__main__":
    unittest.main()
