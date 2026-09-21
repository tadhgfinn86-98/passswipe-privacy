"""An HttpClient stand-in that serves fixtures instead of making requests.

Lets the whole pipeline run in tests and in demo.py with no network access,
no API keys and no cost.
"""

from __future__ import annotations

import json
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str):
    path = FIXTURES / name
    if path.suffix == ".json":
        return json.loads(path.read_text())
    return path.read_text()


class OfflineClient:
    """Routes requests to fixtures by matching on the URL."""

    def __init__(self, websites: dict[str, str] | None = None) -> None:
        self.websites = websites or {}
        self.calls: list[tuple[str, str]] = []

    def _record(self, method: str, url: str) -> None:
        self.calls.append((method, url))

    def get_json(self, url, params=None, headers=None, auth=None, use_cache=True):
        self._record("GET", url)

        if "api.ratings.food.gov.uk" in url:
            # Serve page 1 only; page 2 comes back empty and ends pagination.
            if (params or {}).get("pageNumber", 1) > 1:
                return {"establishments": [], "meta": {"totalCount": 4}}
            return load("fsa_establishments.json")

        if "/advanced-search/companies" in url:
            return {"items": [], "hits": 0}

        if "/search/companies" in url:
            return load("companies_house_search.json")

        if "/officers" in url:
            return load("companies_house_officers.json")

        return None

    def post_json(self, url, body=None, headers=None, use_cache=True):
        self._record("POST", url)

        if "postcodes.io" in url:
            return {"result": [
                {"query": pc, "result": _POSTCODES.get(pc.upper().replace("  ", " "))}
                for pc in (body or {}).get("postcodes", [])
            ]}

        if "places.googleapis.com" in url:
            return {"places": _PLACES.get((body or {}).get("textQuery", ""), [])}

        return None

    def send_json(self, method, url, body=None, headers=None):
        self._record(method, url)
        return {}

    def get_text(self, url, params=None, headers=None, max_bytes=2_000_000):
        self._record("GET", url)
        if url.endswith("/robots.txt"):
            return "User-agent: *\nDisallow: /private\n"
        for domain, html in self.websites.items():
            if domain in url:
                return html
        return None


# Postcode -> coordinates, as postcodes.io would return them.
_POSTCODES = {
    "WR1 2NA": {"latitude": 52.1889, "longitude": -2.2201},
    "WR3 9LT": {"latitude": 52.2211, "longitude": -2.2299},
    "WR9 8ER": {"latitude": 52.2673, "longitude": -2.1533},
    "WR4 9EL": {"latitude": 52.1977, "longitude": -2.2018},
    "WR13 5PX": {"latitude": 52.1080, "longitude": -2.3290},
    "WR5 3EJ": {"latitude": 52.1783, "longitude": -2.2032},
    "B30 3HY": {"latitude": 52.4133, "longitude": -1.9350},
    "GL50 3AA": {"latitude": 51.8994, "longitude": -2.0783},
    "NE1 4AA": {"latitude": 54.9738, "longitude": -1.6131},
    "DY10 4JB": {"latitude": 52.3480, "longitude": -2.2100},
    "WR2 6AA": {"latitude": 52.1900, "longitude": -2.2600},
}

# Google Places text-search responses, keyed by the query the code builds.
_PLACES = {
    "The Olive Branch Ltd WR1 2NA": [{
        "id": "ChIJolive",
        "displayName": {"text": "The Olive Branch"},
        "businessStatus": "OPERATIONAL",
        "nationalPhoneNumber": "01905 123456",
        "websiteUri": "https://olivebranch.example",
        "rating": 4.6,
        "userRatingCount": 238,
        "location": {"latitude": 52.1889, "longitude": -2.2201},
    }],
    "Bella's Cafe WR9 8ER": [{
        "id": "ChIJbella",
        "displayName": {"text": "Bella's Cafe"},
        "businessStatus": "OPERATIONAL",
        "nationalPhoneNumber": "01905 998877",
        "websiteUri": "https://bellascafe.example",
        "rating": 4.2,
        "userRatingCount": 86,
    }],
}

DEMO_WEBSITES = {
    "olivebranch.example": """
        <html><body>
          <h1>The Olive Branch</h1>
          <p>Book a table: <a href="tel:+441905123456">01905 123456</a></p>
          <p>Email <a href="mailto:info@olivebranch.example">info@olivebranch.example</a></p>
          <p>Site by <a href="mailto:hello@someagency.co.uk">someagency</a></p>
        </body></html>
    """,
    "bellascafe.example": """
        <html><body>
          <h1>Bella's Cafe</h1>
          <p>Call 01905 998877 or email enquiries@bellascafe.example</p>
        </body></html>
    """,
}
