import unittest

from ripple.config import Config
from ripple.enrich import website
from ripple.models import Lead
from tests.fakes import OfflineClient


class TestUrlNormalisation(unittest.TestCase):
    def test_adds_scheme_to_bare_domain(self):
        self.assertEqual(website._normalise_url("olivebranch.co.uk"), "https://olivebranch.co.uk/")

    def test_rejects_non_http_schemes(self):
        for url in ["javascript:alert(1)", "ftp://x.com", "mailto:a@b.com", "file:///etc/passwd"]:
            self.assertEqual(website._normalise_url(url), "", url)

    def test_rejects_internal_hosts(self):
        # Register data occasionally carries junk in the website column; we
        # must never turn that into a request to something on the network.
        for url in ["http://localhost", "http://192.168.1.1/admin", "not a url", ""]:
            self.assertEqual(website._normalise_url(url), "", url)


class TestEmailExtraction(unittest.TestCase):
    HTML = """<html><head><style>.a{background:url(sprite@2x.png)}</style></head><body>
        <a href="mailto:dave@olivebranch.co.uk">Dave</a>
        <a href="mailto:info@olivebranch.co.uk">General</a>
        <a href="mailto:studio@webagency.com">Site by webagency</a>
        noreply@olivebranch.co.uk
    </body></html>"""

    def test_prefers_role_address(self):
        self.assertEqual(website._pick_email(self.HTML, "olivebranch.co.uk"),
                         "info@olivebranch.co.uk")

    def test_rejects_third_party_domain(self):
        # The web designer's address is not the lead's contact.
        self.assertNotIn("webagency", website._pick_email(self.HTML, "olivebranch.co.uk"))

    def test_rejects_noreply_and_asset_filenames(self):
        picked = website._pick_email(
            '<p>noreply@olivebranch.co.uk sprite@2x.png</p>', "olivebranch.co.uk"
        )
        self.assertEqual(picked, "")

    def test_matches_www_prefixed_domain(self):
        self.assertEqual(
            website._pick_email('<p>info@olivebranch.co.uk</p>', "www.olivebranch.co.uk"),
            "info@olivebranch.co.uk",
        )


class TestPhoneExtraction(unittest.TestCase):
    def test_prefers_tel_link(self):
        html = '<p>0800 000000</p><a href="tel:+441905123456">call</a>'
        self.assertEqual(website._pick_phone(html), "01905123456")

    def test_reads_number_from_text(self):
        self.assertEqual(website._pick_phone("<p>Call us on 01905 123 456 today</p>"),
                         "01905123456")

    def test_cleans_formats(self):
        self.assertEqual(website._clean_phone("+44 1905 123456"), "01905123456")
        self.assertEqual(website._clean_phone("0790 123 4567"), "07901234567")

    def test_rejects_non_uk_and_short_numbers(self):
        for raw in ["123", "+1 555 0100", "", "99999999999999"]:
            self.assertEqual(website._clean_phone(raw), "", raw)


class TestEnrichRespectsRobots(unittest.TestCase):
    # Note: the reserved example.com domain is on the email blocklist, so
    # these use a realistic domain instead.
    SITE = {"olivebranch.co.uk": "<p>info@olivebranch.co.uk</p>"}

    def test_disallowed_path_is_not_fetched(self):
        client = OfflineClient(websites=self.SITE)
        lead = Lead(name="A", website="https://olivebranch.co.uk/private", score=90)
        website.enrich(client, Config(), [lead])
        # robots.txt in the fake disallows /private, so no email is taken
        # from it. The crawler moves on rather than ignoring the rule.
        fetched = [url for _, url in client.calls if url.endswith("/private")]
        self.assertEqual(fetched, [])

    def test_allowed_path_is_scraped(self):
        client = OfflineClient(websites=self.SITE)
        lead = Lead(name="A", website="https://olivebranch.co.uk/", score=90)
        website.enrich(client, Config(), [lead])
        self.assertEqual(lead.email, "info@olivebranch.co.uk")
        self.assertIn("website", lead.sources)

    def test_budget_is_respected(self):
        client = OfflineClient(websites=self.SITE)
        leads = [
            Lead(name=f"L{i}", website="https://olivebranch.co.uk/", score=50)
            for i in range(10)
        ]
        website.enrich(client, Config(max_website_fetches=3), leads)
        self.assertEqual(sum(1 for lead in leads if lead.email), 3)

    def test_blocklisted_reserved_domain_yields_nothing(self):
        self.assertEqual(website._pick_email("<p>info@example.com</p>", "example.com"), "")


if __name__ == "__main__":
    unittest.main()
