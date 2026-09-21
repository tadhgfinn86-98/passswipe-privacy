# d7 leads finder

Keyword + location in, scored and contactable local-business leads out — a self-hosted
take on the classic "D7"-style lead finder.

```
d7 "dentist" --in "Dublin, Ireland" --limit 50 --out dentists.csv
```

* **Find** every business matching a niche inside a radius (OpenStreetMap by default — free, no key).
* **Enrich** each lead by visiting its website: emails, phone numbers, social profiles, platform and analytics signals.
* **Score** the opportunity (0–100) and label *why* — `no-website`, `not-mobile-friendly`, `stale-site`, `no-analytics`, …
* **Export** to CSV / JSON / NDJSON / HTML, or work in a local web UI with live progress.

Zero npm dependencies. Node 20+. Works as a CLI or a local web app.

---

## Quick start

```bash
cd leadfinder

# CLI
node bin/d7.js "plumber" --in "Manchester, UK" --radius 15 --out plumbers.csv

# Web UI at http://127.0.0.1:8787
node bin/d7.js serve
```

Optional global install: `npm link` → then just `d7 ...`.

## What you get back

| | |
|---|---|
| Identity | `name`, `category`, `address`, `city`, `region`, `postcode`, `country`, `lat`, `lng` |
| Contact | `phone`, `email`, `emails_all`, `phones_all`, `facebook`, `instagram`, `linkedin`, `twitter`, `youtube`, `tiktok` |
| Website signals | `website`, `domain`, `website_live`, `https`, `mobile_friendly`, `contact_form`, `tech` |
| Qualification | `score`, `opportunities`, `rating`, `reviews`, `opening_hours` |
| Provenance | `source`, `source_id`, `source_url`, `found_at` |

## CLI reference

```
d7 "<keyword>" --in "<location>" [options]
d7 serve [--port 8787] [--host 127.0.0.1]
d7 cache clear
```

**Search** — `--in/--location <place>` (name, address or `lat,lng`), `--radius <km>` (10),
`--limit <n>` (100), `--source overpass|google`, `--sort score|name|rating|reviews`.

**Enrichment** — `--no-enrich` (skip crawling; much faster), `--concurrency <n>` (6),
`--pages <n>` pages per site (3), `--ignore-robots` (off by default).

**Filters** — `--require-email`, `--require-phone`, `--no-website`, `--has-website`,
`--min-score <n>`, `--min-rating <n>` (Google only), `--category <regex>`.

**Output** — `--out <file>` (format inferred from the extension), `--format csv|json|ndjson|html`,
`--json`, `--quiet`, `--no-cache`.

Multiple niches in one run: `d7 "plumber,electrician,roofer" --in "Leeds, UK"`.

### Recipes

```bash
# Businesses with no website at all — the classic web-design prospect list
d7 "restaurant" --in "Galway, Ireland" --radius 20 --no-website --out no-site.csv

# Only leads you can email today
d7 "gym" --in "Austin, TX" --require-email --min-score 45 --out gyms.csv

# Google Places instead of OSM (ratings + review counts, needs a key)
GOOGLE_MAPS_API_KEY=... d7 "dentist" --in "Boston, MA" --source google --min-rating 4

# Fast sweep, no crawling, piped into jq
d7 "cafe" --in "53.3498,-6.2603" --radius 3 --no-enrich --json | jq '.leads[].name'
```

## Sources

| Source | Key needed | Coverage | Extras |
|---|---|---|---|
| `overpass` (default) | no | OpenStreetMap, worldwide | opening hours, OSM-verified contacts |
| `google` | `GOOGLE_MAPS_API_KEY` | Google Places (New) | ratings, review counts, verified phones (billed per call) |

Both feed the same pipeline, and results from both merge cleanly — de-duplication keys on
domain, phone and name + city, preferring the richer record.

Locations are geocoded with OpenStreetMap Nominatim, rate-limited to its 1 req/s policy.
Pass `lat,lng` to skip geocoding entirely.

## Scoring

Score rewards *contactability* (email, phone) and *fixable problems* you can sell against.
Weights live in `src/score.js` (`DEFAULT_WEIGHTS`) — edit them to match what you sell.

| Angle | Meaning |
|---|---|
| `no-website` / `social-only-presence` | Business has no site, maybe just a Facebook page |
| `website-unreachable` | Domain in the listing is dead |
| `no-https`, `not-mobile-friendly`, `slow-site` | Basic site quality failures |
| `stale-site`, `diy-site-builder` | Copyright 3+ years old, or a Wix/Squarespace/GoDaddy build |
| `no-analytics`, `no-contact-form` | No measurement, no capture |
| `no-social-profiles`, `low-rating`, `few-reviews` | Reputation and presence gaps |

## Web UI

`node bin/d7.js serve` → search form, live progress over SSE, sortable table, CSV/JSON
download and a "copy all emails" button. Binds to `127.0.0.1` by default; it has no auth,
so keep it local (or put it behind your own reverse proxy and auth).

## Behaviour when crawling

* `robots.txt` is fetched and obeyed per host (`--ignore-robots` opts out).
* One request at a time per host, respecting `Crawl-delay`, with a 350 ms floor.
* At most 3 pages per site (homepage + contact/about), 900 KB per page, then it stops.
* Responses are cached on disk for 24 h in `.d7cache/` (`d7 cache clear`, or `--no-cache`).
* Identify yourself: set `D7_USER_AGENT` to a string with a contact URL or address.

Contact details of businesses are personal data in many jurisdictions. Whether you may
store them and cold-email them is governed by local law (GDPR/PECR, CAN-SPAM, CASL and so
on) — this tool collects what is publicly published; how you use it is on you.

## Environment variables

| Variable | Purpose |
|---|---|
| `GOOGLE_MAPS_API_KEY` | Enables `--source google` |
| `D7_USER_AGENT` | User-Agent sent on every request |
| `D7_CACHE_DIR` | Cache location (default `.d7cache`) |
| `D7_OVERPASS_URL` | Comma-separated Overpass endpoints (failover in order) |
| `D7_NOMINATIM_URL` | Alternative geocoder endpoint |
| `PORT` | Default port for `d7 serve` |

## Layout

```
bin/d7.js            CLI
src/search.js        pipeline: geocode → source → dedupe → enrich → score → filter
src/sources/         overpass.js (OSM), google.js (Places), keywords.js (niche → OSM tags)
src/enrich.js        polite website crawl
src/extract.js       emails, phones, socials, meta, tech signals
src/score.js         lead scoring + opportunity labels
src/dedupe.js        cross-source de-duplication
src/export.js        CSV/JSON/NDJSON/HTML
server/              local web UI (SSE progress, downloads)
test/                57 tests, fully offline
```

## Tests

```bash
npm test
```

Everything runs offline: fixture websites and a mocked Overpass endpoint are served from
localhost, so the suite covers the full CLI path (search → crawl → score → CSV) without
touching the network.

## Limits worth knowing

* OSM coverage varies by country and niche; unmapped businesses simply aren't there.
  For thin niches, add `--source google`, widen `--radius`, or search several keywords.
* Emails only come from pages the business publishes; there is no guessing of addresses
  and no third-party email database behind this.
* Overpass is a shared free service — heavy use should point `D7_OVERPASS_URL` at your own
  instance.
