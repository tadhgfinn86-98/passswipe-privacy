import json
import threading
import time
import unittest
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

from ripple import web
from ripple.models import CARRIER, CLIENT, Lead
from ripple.pipeline import compliance, scoring


class TestRequestMapping(unittest.TestCase):
    def test_maps_the_form_onto_a_config(self):
        cfg, options = web._config_from_request({
            "mode": "all", "towns": ["Worcester", " Malvern "], "areas": ["wr", " b "],
            "radius": 15, "minScore": 40, "usePlaces": True, "useWebsites": False,
            "useCompaniesHouse": True, "geocode": False, "maxPlaces": 25,
        })
        self.assertEqual(cfg.areas, ["WR", "B"])
        self.assertEqual(cfg.radius_miles, 15.0)
        self.assertTrue(cfg.use_google_places)
        self.assertFalse(cfg.enrich_websites)
        self.assertEqual(cfg.max_places_lookups, 25)
        self.assertEqual(options["towns"], ["Worcester", "Malvern"])
        self.assertEqual(options["minScore"], 40)
        self.assertFalse(options["geocode"])

    def test_demo_mode_points_at_bundled_sample_data(self):
        cfg, options = web._config_from_request({"demo": True})
        self.assertTrue(options["demo"])
        self.assertTrue(Path(cfg.ea_carriers_csv).is_file())
        self.assertTrue(Path(cfg.ea_sites_csv).is_file())
        # Stand-in keys, so the whole pipeline runs without real ones.
        self.assertTrue(cfg.companies_house_key)

    def test_empty_towns_falls_back_to_worcester(self):
        _, options = web._config_from_request({"towns": ["", "  "]})
        self.assertEqual(options["towns"], ["Worcester"])

    def test_bad_numbers_are_rejected(self):
        with self.assertRaises(ValueError):
            web._config_from_request({"radius": "not-a-number"})


class TestSerialisation(unittest.TestCase):
    def test_counts_split_by_queue(self):
        leads = [
            Lead(name="A", company_type="ltd", company_status="active", email="a@b.co"),
            Lead(name="B", phone="01905 1"),
            Lead(name="C", category=CARRIER, phone="01905 2"),
        ]
        compliance.apply(leads)
        counts = web._counts(leads)
        self.assertEqual(counts["all"], 3)
        self.assertEqual(counts["clients"], 2)
        self.assertEqual(counts["carriers"], 1)
        self.assertEqual(counts["email_queue"], 1)
        self.assertEqual(counts["call_queue"], 1)

    def test_lead_json_is_serialisable_and_flags_queues(self):
        lead = Lead(name="A", company_type="ltd", company_status="active", email="a@b.co",
                    business_type="Hotel", sources=["fsa"])
        compliance.classify(lead)
        scoring.score_lead(lead)
        payload = web._lead_json(lead)
        json.dumps(payload)                      # must not raise
        self.assertTrue(payload["emailSafe"])
        self.assertEqual(payload["channel"], compliance.EMAIL_OK)
        self.assertIn("business_type", payload["breakdown"])

    def test_settings_never_leak_key_values(self):
        settings = web._settings()
        body = json.dumps(settings)
        self.assertNotIn("key", body.lower().replace('"keys"', ""))
        for value in settings["keys"].values():
            self.assertIsInstance(value, bool)


class TestLiveServer(unittest.TestCase):
    """Drives the real HTTP surface on an ephemeral port."""

    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), web.Handler)
        cls.port = cls.server.server_address[1]
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def url(self, path):
        return f"http://127.0.0.1:{self.port}{path}"

    def get(self, path, headers=None):
        request = urllib.request.Request(self.url(path), headers=headers or {})
        return urllib.request.urlopen(request, timeout=10)

    def post(self, path, payload=None):
        request = urllib.request.Request(
            self.url(path),
            data=json.dumps(payload or {}).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        return urllib.request.urlopen(request, timeout=10)

    def test_serves_the_page(self):
        response = self.get("/")
        body = response.read().decode()
        self.assertEqual(response.status, 200)
        self.assertIn("<title>Ripple Lead Engine</title>", body)

    def test_settings_endpoint(self):
        payload = json.load(self.get("/api/settings"))
        self.assertIn("stages", payload)
        self.assertIn("companiesHouse", payload["keys"])

    def test_rejects_foreign_host_header(self):
        # Guards against DNS rebinding reaching a local-only tool.
        with self.assertRaises(urllib.error.HTTPError) as caught:
            self.get("/api/state", headers={"Host": "evil.example.com"})
        self.assertEqual(caught.exception.code, 403)

    def test_static_path_traversal_is_refused(self):
        for path in ["/static/../../config.py", "/static/..%2f..%2fconfig.py"]:
            with self.assertRaises(urllib.error.HTTPError) as caught:
                self.get(path)
            self.assertEqual(caught.exception.code, 404, path)

    def test_download_only_serves_files_from_this_run(self):
        with self.assertRaises(urllib.error.HTTPError) as caught:
            self.get("/api/download/passwd.csv")
        self.assertEqual(caught.exception.code, 404)

    def test_demo_run_end_to_end(self):
        self.post("/api/run", {"mode": "all", "demo": True, "towns": ["Worcester"]})

        state = {}
        for _ in range(100):
            state = json.load(self.get("/api/state"))
            if state["status"] != "running":
                break
            time.sleep(0.1)

        self.assertEqual(state["status"], "done", state.get("message"))
        self.assertTrue(state["demo"])
        self.assertGreater(state["counts"]["all"], 0)
        self.assertGreater(state["counts"]["carriers"], 0)
        self.assertTrue(state["logs"])
        self.assertEqual(state["stage"], "done")

        # Scores arrive ranked, as the table expects.
        scores = [lead["score"] for lead in state["leads"]]
        self.assertEqual(scores, sorted(scores, reverse=True))

        # And the CSVs that run wrote are downloadable.
        response = self.get("/api/download/email_queue.csv")
        self.assertEqual(response.status, 200)
        self.assertIn("lead_id", response.read().decode())


if __name__ == "__main__":
    unittest.main()
