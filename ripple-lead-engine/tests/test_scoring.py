import unittest

from ripple.models import CARRIER, FACILITY, Lead
from ripple.pipeline import compliance
from ripple.pipeline.scoring import rank, score_lead


def scored(**kwargs) -> Lead:
    lead = Lead(**kwargs)
    compliance.classify(lead)
    return score_lead(lead)


class TestScoring(unittest.TestCase):
    def test_score_stays_in_range(self):
        best = scored(name="A", business_type="Restaurant/Cafe/Canteen", review_count=5000,
                      years_trading=40.0, email="a@b.co", phone="1", website="x.co",
                      distance_miles=0.5, company_type="ltd", company_status="active",
                      directors=["A B"], sources=["fsa", "google_places"])
        worst = scored(name="B")
        self.assertLessEqual(best.score, 100)
        self.assertGreaterEqual(worst.score, 0)

    def test_busy_restaurant_beats_quiet_one(self):
        busy = scored(name="A", business_type="Restaurant/Cafe/Canteen", review_count=600,
                      distance_miles=2.0)
        quiet = scored(name="B", business_type="Restaurant/Cafe/Canteen", review_count=3,
                       distance_miles=2.0)
        self.assertGreater(busy.score, quiet.score)

    def test_closer_beats_further(self):
        near = scored(name="A", business_type="Hotel", distance_miles=3.0)
        far = scored(name="B", business_type="Hotel", distance_miles=28.0)
        self.assertGreater(near.score, far.score)

    def test_contact_details_raise_the_score(self):
        with_email = scored(name="A", business_type="Hotel", email="a@b.co", distance_miles=5.0)
        without = scored(name="B", business_type="Hotel", distance_miles=5.0)
        self.assertGreater(with_email.score, without.score)

    def test_do_not_contact_scores_zero(self):
        lead = scored(name="A", business_type="Restaurant/Cafe/Canteen", review_count=900,
                      email="a@b.co", distance_miles=1.0,
                      company_type="ltd", company_status="dissolved")
        self.assertEqual(lead.score, 0)

    def test_upper_tier_carrier_beats_lower_tier(self):
        upper = scored(name="A", category=CARRIER, ea_tier="upper", distance_miles=10.0)
        lower = scored(name="B", category=CARRIER, ea_tier="lower", distance_miles=10.0)
        self.assertGreater(upper.score, lower.score)

    def test_breakdown_sums_to_score(self):
        lead = scored(name="A", category=FACILITY, ea_permit_type="Transfer station",
                      phone="1", distance_miles=4.0)
        self.assertEqual(sum(lead.score_breakdown.values()), lead.score)

    def test_rank_orders_by_score_then_distance(self):
        a = scored(name="A", business_type="Hotel", distance_miles=20.0)
        b = scored(name="B", business_type="Hotel", distance_miles=3.0)
        ordered = rank([a, b])
        self.assertEqual(ordered[0].name, "B")


if __name__ == "__main__":
    unittest.main()
