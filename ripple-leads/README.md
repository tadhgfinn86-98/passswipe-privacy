# Ripple Leads

A local lead intelligence and outreach system for **Ripple Recycling** — a
one-person commercial waste brokerage working food and hospitality in
Worcestershire.

It runs the loop: **discover → enrich → score → outreach → CRM → track replies.**
Think of it as a small, private Clay that lives on your laptop instead of a
subscription.

Everything runs on your machine. The database is a single file next to the code.
Nothing leaves your laptop unless you explicitly switch on one of the optional
integrations.

---

## Quick start (Windows)

One-time setup. Open **Anaconda Prompt** and run these one at a time:

```bat
conda create -n ripple python=3.11 -y
conda activate ripple

cd path\to\ripple-leads
pip install -r requirements.txt

python selftest.py
```

**After that, just double-click `Ripple Leads.bat`.** An application window
opens — no terminal to keep open, no browser tab, no address to remember.
Closing the window shuts everything down.

Right-click that file → *Send to* → *Desktop (create shortcut)* to get an icon
you can launch it from. (Right-click the shortcut → Properties → Change Icon if
you want to give it a nicer one.)

### If you prefer the terminal

Both of these still work exactly as before:

```bat
conda activate ripple
cd path\to\ripple-leads

python desktop.py       :: app window
streamlit run app.py    :: browser tab, with the log visible
```

`streamlit run app.py` is the one to use when something is wrong — it prints
errors to the terminal where you can read them.

**You do not need any API keys to start.** Run discovery, get real leads, score
them, work the call list, and export email drafts — all with an empty `.env`.

### First five minutes

1. **Discover tab** → *Run discovery*. Pulls Worcester, Pershore, Malvern and
   Droitwich from OpenStreetMap. Takes a minute or two; expect a few hundred
   businesses.
2. **Leads tab** → your list, ranked. Sort by score, filter to `Priority: High`.
3. Work down the **Outreach → Call & walk-in list**. Most leads land here,
   because OpenStreetMap rarely carries email addresses.
4. Update `status` and `next_action` inline on the Leads tab as you go. The
   funnel at the top updates itself.

---

## How the desktop app works

There is no separate application — it is the same code, wrapped in a window.
`desktop.py` does this when you launch it:

1. Asks Windows for a **free port**, so it never clashes with anything else you
   have running (including another copy of Streamlit).
2. Starts Streamlit on that port, **hidden and bound to `127.0.0.1`** — loopback
   only, so nothing outside your laptop can reach it, not even on shared wifi.
3. Waits until the server reports itself ready.
4. Opens a **native window** pointed at it.
5. When you close the window, **stops the server** and exits. No orphan
   processes, no port left listening.

A few consequences worth knowing:

- **If the window fails to open**, you get your normal browser instead and the
  app works identically. That happens when `pywebview` isn't installed.
- **If something is broken inside the app**, Streamlit still starts and shows
  you the error *in the window* rather than failing silently.
- **If Streamlit can't start at all** (wrong environment, missing packages), the
  launcher notices within a second and tells you what to check, rather than
  hanging.
- The developer menu is hidden via `.streamlit/config.toml`, so it looks like an
  app rather than a web page. Delete `toolbarMode = "viewer"` from that file if
  you ever want it back.

The window is 1400×900 and resizable, down to 900×600.

## What's free and what costs money

| Piece | Cost | On by default | Needs |
|---|---|---|---|
| **OpenStreetMap discovery** | Free, no key, no limit | ✅ Yes | Nothing |
| **Scoring and priority** | Free (plain Python, no AI) | ✅ Yes | Nothing |
| **Leads table, editing, funnel** | Free | ✅ Yes | Nothing |
| **Call / walk-in list + CSV export** | Free | ✅ Yes | Nothing |
| **`.eml` and CSV draft export** | Free | ✅ Yes | Nothing |
| **AI enrichment** | ~£0.001 per lead | ❌ Off | `ANTHROPIC_API_KEY` |
| **AI email drafting** | ~£0.002 per draft | ❌ Off | `ANTHROPIC_API_KEY` |
| **Google Places discovery** | Paid per request | ❌ Off | Key + config flag |
| **Notion CRM push** | Free (Notion's own free tier) | ❌ Off | Token + config flag |
| **Gmail drafts / sending** | Free | ❌ Off | OAuth setup + config flag |

On the AI costs: enrichment is Haiku 4.5 at about $1 per million input tokens.
A lead's prompt is roughly 500 tokens. **Enriching 500 leads costs well under
£1.** The dashboard shows a running estimate after each call. Even so, enrich
selectively — there is no point spending anything on a lead you can see is a
Costa.

---

## The `.env` file

Copy `.env.example` to `.env` and fill in only what you want. Every line can
stay blank.

```bat
copy .env.example .env
notepad .env
```

```ini
# Enrichment + email drafting (optional, cheap)
ANTHROPIC_API_KEY=

# Google Places discovery (optional, PAID, off by default)
GOOGLE_PLACES_API_KEY=

# Notion CRM push (optional, off by default)
NOTION_TOKEN=
NOTION_DATABASE_ID=

# Gmail drafts/send (optional, off by default)
GMAIL_CREDENTIALS_FILE=credentials.json
GMAIL_TOKEN_FILE=token.json
```

`.env` is in `.gitignore`. Keys are never printed, logged or committed — the
Settings tab only ever shows whether one is *present*.

---

## Tuning it: `config.yaml`

Settings live in `config.yaml` (safe to commit); secrets live in `.env` (never
committed). Edit the YAML in Notepad, then press **Reload config.yaml** on the
Settings tab.

**Towns and radius** — add a town by copying a line and putting in its
latitude/longitude (right-click a spot in Google Maps to copy coordinates):

```yaml
towns:
  - {name: Worcester,  lat: 52.1936, lon: -2.2216, radius_m: 8000}
  - {name: Evesham,    lat: 52.0920, lon: -1.9470, radius_m: 8000}
```

**Scoring weights** — every number that makes up a score is here. Nothing is
hardcoded:

```yaml
scoring:
  type_weights:
    Restaurant: 30      # most food waste per site
    Takeaway: 30
    Pub: 22
  has_phone: 10
  independent: 15       # chains buy waste centrally through head office
  not_compliant_yet: 12 # an open Duty of Care gap is the whole pitch
  on_route: 10
  priority_high: 70
  priority_medium: 45
```

After changing weights, press **Rescore all** on the Leads tab.

> **A note on the ceiling.** The weights as shipped can add up to about 111 for
> a perfect lead, and scores are clamped at 100. That means your very best leads
> all cluster at 100 and you lose some separation between them. That is fine
> when you are ranking a few hundred leads — but if you want finer distinctions
> at the top, scale the weights down (halve them all) rather than raising the
> `priority_high` threshold.

---

## How scoring works

Deterministic Python, no AI. The same lead always scores the same, and the
**Leads tab → "Why did a lead score what it scored?"** panel shows the full
breakdown, e.g.

```
Type: Restaurant +30 · Has phone +10 · Has email +6 · Independent +15 ·
Not compliant yet +12 · On route +10 · Spend £300/mo +14
```

Score 0–100 → **High ≥ 70**, **Medium ≥ 45**, otherwise Low.

The **suggested lane** is derived from what you can actually reach them with:
email if you have an address, else phone, else walk-in.

One rule matters more than the rest: **`unknown` never scores.** If you don't
know whether a place is independent, it earns nothing — it isn't penalised
either. That's what stops an unsure AI guess from inflating a rank and sending
you on a wasted drive.

---

## Optional integrations

### 1. Anthropic — enrichment and drafting

Get a key at [console.anthropic.com](https://console.anthropic.com) → API Keys →
put it in `.env` as `ANTHROPIC_API_KEY`. Nothing else to switch on.

What enrichment does for one lead: decides **independent vs chain**, writes a
**one-line opener**, and suggests a **first lane**. It is told it has not seen
their website and must answer `unknown` rather than guess — so an empty opener
is a correct answer, not a failure. It only ever sees the fields already in your
database.

Drafting writes an 80–120 word cold email. The greeting, your signature and the
opt-out line are added by Python *after* the model finishes, so they can't be
dropped or reworded. You then edit it by hand before anything happens to it.

Model: `claude-haiku-4-5`, set in `config.yaml` under `enrichment.model`.

### 2. Google Places — extra discovery (paid)

OpenStreetMap is enough to run the business; this is a top-up for gaps. In
`config.yaml` set `discovery.use_google_places: true` and put the key in `.env`.

**Set a spend cap on the key in Google Cloud Console before you enable it.**
Places bills per request and per field returned.

### 3. Notion — CRM push

1. Create an integration at
   [notion.so/my-integrations](https://www.notion.so/my-integrations), copy the
   **Internal Integration Token**.
2. Open your Notion database → **•••** → **Connections** → add your integration.
   *(Skipping this is the usual cause of a "couldn't find that database" error —
   the token alone isn't enough.)*
3. Copy the database ID from its URL: `notion.so/<workspace>/`**`<32 characters`**`?v=...`
4. Put both in `.env`, then set `crm.use_notion: true` in `config.yaml`.

You don't need to match any particular schema. The app reads your database's
columns and sends only the ones you actually have, converted to the type you
declared. Columns it recognises: Business/Name, Type, Area, Address, Phone,
Email, Website, Contact, Score, Priority, Lane, Status, Independent, Compliant,
Monthly spend, Next action, Notes. Start with just a title column if you like.

### 4. Gmail — drafts and capped sending

The fiddliest one, and genuinely optional — exporting `.eml` files and sending
from your normal mail client gets you the same outcome with no setup.

1. [Google Cloud Console](https://console.cloud.google.com) → create a project.
2. **APIs & Services → Library** → enable **Gmail API**.
3. **OAuth consent screen** → External → add yourself as a test user.
4. **Credentials → Create credentials → OAuth client ID → Desktop app** →
   download the JSON, save it as `credentials.json` in this folder.
5. Install the extra libraries: `pip install -r requirements-optional.txt`
6. Set `outreach.use_gmail: true` in `config.yaml`.

First use opens a browser to approve access, then caches `token.json`. Both
files are gitignored. The scope requested is `gmail.compose` — **this tool can
create and send, but cannot read your mailbox.**

---

## Compliance (UK)

Baked into the plumbing, not left to good intentions:

- **Every draft carries an opt-out line**, added in Python after the model runs.
  If you edit it out, the app warns you and the send button refuses.
- **A daily send cap** (default 20, in `config.yaml`) counted from the database,
  so closing the app doesn't reset it.
- **Nothing sends without you ticking "Approved"** on that specific lead. There
  is no bulk auto-send anywhere in this tool, by design.

The guidance the app shows you, in short: cold B2B email is on its safest footing
when the recipient is a **limited company or LLP** — a corporate subscriber under
PECR. **Sole traders, partnerships and individuals** generally need prior consent,
and plenty of independent cafés and takeaways are sole traders you can't identify
from the outside. When you're unsure, **use the call or walk-in lane** — a
conversation needs no consent, and it's where most of these leads live anyway.

This is guidance to keep you thinking, not legal advice.

---

## What's in each file

| File | What it does |
|---|---|
| `Ripple Leads.bat` | Double-click this. The Windows launcher |
| `desktop.py` | Starts the hidden server and opens the app window |
| `app.py` | The Streamlit dashboard — four tabs and the funnel |
| `.streamlit/config.toml` | Makes it look like an app, not a web page |
| `config.py` / `config.yaml` | Settings loading; towns, radius, weights, caps |
| `models.py` | The `Lead` data model and the dedupe key |
| `db.py` | All the SQLite: schema, reads, writes, grid edits, send log |
| `discover.py` | Overpass (OSM) and the optional Google Places provider |
| `enrich.py` | Optional Anthropic enrichment for one lead |
| `score.py` | The 0–100 rubric, priority bands and lane derivation |
| `outreach.py` | Drafting, `.eml`/CSV export, send guards, optional Gmail |
| `crm.py` | Optional Notion push |
| `selftest.py` | 63 offline checks — no keys, no network, no spend |

`requirements.txt` is everything the app needs to run free. The two Google
libraries Gmail needs are in `requirements-optional.txt` instead — they have
native dependencies that occasionally fail to build, and a problem installing
something you may never use should not be able to stop the rest of the app
working.

Your data: `ripple_leads.db` (the database) and `exports/` (files you generate).
Both gitignored. **Back up `ripple_leads.db` — it is your entire pipeline.**
Copying that one file is a complete backup.

---

## Troubleshooting

**Double-clicking the .bat does nothing, or a window flashes and vanishes** —
the conda environment name doesn't match. Open `Ripple Leads.bat` in Notepad and
change `ripple` on the `CALL conda activate` line to whatever you called yours.
To see the actual error, run `python desktop.py` from Anaconda Prompt instead.

**It opens in a browser instead of a window** — `pywebview` didn't install.
Run `pip install pywebview`. The app is perfectly usable either way.

**`streamlit: command not found`** — the conda environment isn't active. Run
`conda activate ripple` first.

**Discovery returns nothing, or times out** — Overpass is a free shared service
and sometimes busy. Wait a few minutes and try again, or try one town at a time.
The app records the error per town and keeps going with the others.

**"No leads have an email address"** — expected. OpenStreetMap rarely carries
them. Work the call and walk-in lane, and add emails by hand as you find them.

**Notion says it can't find the database** — you almost certainly skipped
sharing the database with the integration (step 2 above). The token alone isn't
enough.

**Everything looks broken after editing `config.yaml`** — YAML is picky about
indentation and needs spaces, not tabs. Run `python selftest.py`; it will fail
loudly with the parse error.

---

## Honest limits

- **OpenStreetMap coverage is uneven.** Pubs and restaurants are mapped well;
  small independent takeaways are patchier. A pull is a starting list, not a
  census of the town.
- **Chain detection is partial.** A `brand` tag in OSM reliably means a chain,
  so that's free and certain. Its absence means nothing — hence `unknown`.
- **The Overpass HTTP call is unverified in this build.** The environment this
  was built in blocks `overpass-api.de` at the network level, so the request was
  never run against the live API. Everything either side of it is covered by
  `selftest.py` using a recorded response. **Your first `Run discovery` is the
  real test** — if it errors, the message in the app will say why.
- **The live Anthropic, Gmail and Notion calls are likewise unverified** — no
  credentials were available at build time. Their request shapes and every
  failure path are tested against stand-in clients.
- **The app window itself is untested.** The launcher's machinery is covered
  end to end by `selftest.py` — a real server is started, checked, and shut
  down, and the port confirmed released. But this was built on a headless Linux
  container with no display and no way to install `pywebview`, so the one thing
  I could not run is the window appearing. If it doesn't, you'll get the browser
  fallback and a message saying so.
- **`est_monthly_spend` is yours to fill in.** Nothing estimates it for you;
  guessing it from a building footprint would be inventing data. Put in what you
  learn on the call, and the score updates.
