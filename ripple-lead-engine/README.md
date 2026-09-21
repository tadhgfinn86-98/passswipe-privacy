# Ripple lead engine

Finds commercial trade-waste prospects in and around Worcester, adds contact
details, scores them, and writes outreach queues you can work from or push to
a CRM.

Most of the data comes from free, official UK sources, so there is very little
actual scraping: one light pass over each business's own website, and nothing
else.

## What it produces

A run writes five CSVs:

| File | What it is |
|---|---|
| `leads.csv` | everything found, scored and ranked |
| `clients.csv` | the demand side: businesses that pay for collection |
| `carriers.csv` | the supply side: licensed carriers and permitted sites |
| `email_queue.csv` | clients you may lawfully cold-email, with an address |
| `call_queue.csv` | clients to phone instead, with a number |

The last two are the point. They are split by what PECR allows, so the
compliance decision is made once, in the pipeline, instead of per message.

## Quick start

```bash
cd ripple-lead-engine
pip install -r requirements.txt

# See it work with no keys, no network and no cost:
python demo.py

# A real run: Worcester clients, free sources only
python -m ripple.cli --mode clients --towns Worcester --no-places

# With Companies House (needed for the email/call split to mean anything)
cp .env.example .env && $EDITOR .env
set -a && source .env && set +a
python -m ripple.cli --mode clients --towns Worcester Droitwich Malvern

# The carrier map
python -m ripple.cli --mode carriers --ea-carriers-csv data/carriers.csv

# Everything, pushed to Airtable
python -m ripple.cli --mode all --push airtable
```

Run `python -m ripple.cli --help` for every option.

## Where the data comes from

### Clients (demand side)

- **Food Standards Agency hygiene ratings** (`ripple/sources/fsa.py`). Free, no
  key. Lists every registered food business in an area with name, address and
  business type. Close to a full census of the restaurant niche.
- **Companies House** (`ripple/sources/companies_house.py`). Free with a key.
  Advanced search by SIC code and location finds what the FSA never sees:
  warehousing (52101/52103) and property management (68320). It also supplies
  company age, legal type and directors' names.
- **Google Places** (`ripple/sources/google_places.py`). Paid, optional. Fills
  in phone numbers, websites and review counts. We call the API rather than
  scraping Maps pages, which breaks Google's terms and gets blocked.

### Carriers and facilities (supply side)

- **Environment Agency public registers**
  (`ripple/sources/environment_agency.py`). Open data listing licensed waste
  carriers, brokers and dealers, and permitted waste sites. This is how you map
  every hauler and transfer station within range when you are starting with no
  carrier contacts.

### Enrichment

- **The business's own website** (`ripple/enrich/website.py`). The only real
  scraping. Checks `robots.txt`, fetches at most two pages per business, and
  takes one email and one phone number.

## How a run is ordered

```
collect  ─ FSA + Companies House + EA registers
   ↓
dedupe   ─ exact on name+postcode, then fuzzy within each postcode
   ↓
geo      ─ geocode postcodes (postcodes.io), filter to radius
   ↓
classify ─ PECR status, then score: budgets the paid steps
   ↓
enrich   ─ Companies House match → Google Places → website scrape
   ↓
re-score ─ enrichment changed both legal type and contact details
   ↓
export   ─ CSVs, and optionally Airtable or Notion
```

De-duplication happens *before* enrichment so you never pay Google twice for
one business, and scoring happens before it so the budget goes to the leads
worth spending it on.

## The PECR rule, encoded

Under PECR you may cold-email **corporate subscribers** — limited companies,
PLCs, LLPs, and Scottish partnerships — as long as every message carries a
working opt-out and identifies you. **Sole traders and ordinary partnerships
count as individuals** and need consent first, so they are phone-or-post only.

`ripple/pipeline/compliance.py` decides this from the Companies House company
type and tags every lead:

| `pecr_status` | `outreach_channel` | Meaning |
|---|---|---|
| `corporate` | `email_with_optout` | cold email allowed, opt-out required |
| `individual` | `phone_or_post_only` | no cold email without consent |
| `do-not-contact` | `do_not_contact` | dissolved or in liquidation |

**A lead with no Companies House match is treated as an individual.** A sole
trader does not appear in Companies House at all, so "no match" is exactly what
a sole trader looks like. That is the safe direction to be wrong in: it costs
one phone call instead of a complaint. This also means that **without a
Companies House key the email queue will be empty**, which is correct rather
than broken.

Two things the pipeline does not do for you:

- Screen the call list against the **TPS/CTPS** before dialling.
- Put a real opt-out and your business identity in the emails themselves.

I am not a lawyer. Check the ICO's direct marketing guidance before running a
large campaign.

## Scoring

Scores run 0–100 and every one is explained in the `score_breakdown` column,
so you can see why a lead ranks where it does and retune the weights in
`ripple/pipeline/scoring.py`.

Clients score on business type (how much waste it implies), size (review count
as a footfall proxy), years trading, how reachable they are, distance, and
whether more than one source corroborates them. Carriers score on tier — upper
tier is the one that takes work on — plus distance and contactability.

## Environment Agency downloads

The EA moves both its download paths and its column headers from time to time.
The pipeline handles the headers itself by resolving columns fuzzily, so a
rename from `registrationNumber` to `regNo` will not break it.

The paths are a different matter. If a download fails, fetch the register by
hand from the EA public register site and pass the file:

```bash
python -m ripple.cli --mode carriers \
  --ea-carriers-csv data/waste-carriers.csv \
  --ea-sites-csv data/permits.csv
```

A local file always takes priority over the URL. For a nightly job this is also
the more reliable setup.

## Cost control

Only Google Places costs money. It is off by default in the examples above
(`--no-places`), capped by `--max-places`, and only ever called for leads that
are already scoring well and still missing contact details. Set a billing cap
in Google Cloud as well.

Everything else is free. Responses are cached under `data/cache/` for 24 hours,
so re-running a job during the day costs nothing and does not hit anyone's
servers twice.

## Running nightly

```bash
crontab -e
# 0 2 * * *  /path/to/ripple-lead-engine/run_nightly.sh >> /var/log/ripple.log 2>&1
```

`run_nightly.sh` loads `.env`, activates `.venv` if present, and runs all
sources for the Worcester towns into a dated output directory.

## Tests

```bash
python -m unittest discover -s tests -t .
```

79 tests, no network, no keys, no test dependencies. `tests/fakes.py` serves
fixtures through the same interface as the real HTTP client, so the end-to-end
test drives the entire pipeline offline.

## Layout

```
ripple/
  config.py          settings, target SIC codes and FSA business types
  http_client.py     retries, rate limiting, disk cache
  geo.py             postcode geocoding and radius filtering
  models.py          the Lead record and its normalisation rules
  sources/           fsa, companies_house, google_places, environment_agency
  enrich/website.py  robots-aware contact scraper
  pipeline/          dedupe, compliance, scoring, run
  outputs/           csv_out, airtable, notion
demo.py              full offline run against fixtures
run_nightly.sh       cron entry point
```

## Notes on what is not verified here

The sandbox this was built in has no outbound network access, so every source
is tested against fixtures modelled on the documented response shapes rather
than against live responses. The first live run may need small adjustments,
most likely to the Environment Agency download URLs and column names — which
is why both are configurable and a local CSV always wins.
