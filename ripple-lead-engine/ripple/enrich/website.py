"""The only real scraping in the pipeline: a business's own website.

We fetch the homepage and one likely contact page, pull the first sensible
email and phone number, and stop. Rules we hold to:

* robots.txt is checked and obeyed before any fetch.
* One business, at most two pages, rate limited like everything else.
* Role addresses (info@, enquiries@) are preferred over personal ones, and
  we never take an address from a different domain than the site itself.
"""

from __future__ import annotations

import logging
import re
import urllib.robotparser
from urllib.parse import urljoin, urlparse

from ..config import Config
from ..http_client import HttpClient
from ..models import Lead

log = logging.getLogger(__name__)

EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# UK numbers: 01/02/03 landlines, 07 mobiles, optional +44, spaces or dashes.
PHONE_RE = re.compile(
    r"(?:(?:\+44\s?|0)(?:\d\s?){9,10}\d)"
)
CONTACT_PATHS = ["/contact", "/contact-us", "/contact.html", "/about", "/about-us"]

# Addresses that are never a sales contact.
EMAIL_BLOCKLIST = re.compile(
    r"(no-?reply|do-?not-?reply|example\.|sentry\.|wixpress|godaddy|"
    r"@(?:sentry|wordpress|squarespace|shopify|google|facebook)\.)",
    re.IGNORECASE,
)
# Image and asset names that regex-match as emails in inline CSS/JS.
EMAIL_FILE_SUFFIX = re.compile(r"\.(png|jpe?g|gif|svg|webp|css|js|woff2?)$", re.IGNORECASE)

ROLE_PREFIXES = ("info", "enquiries", "enquiry", "hello", "contact", "office", "admin", "sales", "accounts")


def enrich(client: HttpClient, cfg: Config, leads: list[Lead]) -> list[Lead]:
    """Scrape websites for contact details, best leads first, under a cap."""
    candidates = [lead for lead in leads if lead.website and not lead.email]
    candidates.sort(key=lambda lead: lead.score, reverse=True)
    budget = candidates[: cfg.max_website_fetches]
    log.info("website: %d candidates, fetching %d", len(candidates), len(budget))

    robots_cache: dict[str, urllib.robotparser.RobotFileParser | None] = {}
    for lead in budget:
        try:
            _enrich_one(client, cfg, lead, robots_cache)
        except Exception as exc:  # noqa: BLE001 - one bad site must not stop the run
            log.warning("website: %s failed: %s", lead.website, exc)
    return leads


def _enrich_one(client: HttpClient, cfg: Config, lead: Lead,
                robots_cache: dict) -> None:
    base = _normalise_url(lead.website)
    if not base:
        return
    domain = urlparse(base).netloc

    for url in [base] + [urljoin(base, path) for path in CONTACT_PATHS]:
        if lead.email and lead.phone:
            return
        if not _allowed(client, cfg, url, robots_cache):
            log.debug("website: robots.txt disallows %s", url)
            continue

        html = client.get_text(url, max_bytes=600_000)
        if not html:
            continue

        if not lead.email:
            email = _pick_email(html, domain)
            if email:
                lead.email = email
                if "website" not in lead.sources:
                    lead.sources.append("website")
        if not lead.phone:
            phone = _pick_phone(html)
            if phone:
                lead.phone = phone
                if "website" not in lead.sources:
                    lead.sources.append("website")

        # The homepage usually has it; only walk on to contact pages if not.
        if lead.email:
            return


_SCHEME_RE = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.\-]*:")
_HOSTNAME_RE = re.compile(r"^[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?::\d+)?$")


def _normalise_url(website: str) -> str:
    """Ensure an http(s) scheme and a real hostname, or return ''.

    The scheme is checked before anything is prepended, so a value like
    'javascript:...' is rejected rather than turned into a fake https URL.
    """
    url = (website or "").strip()
    if not url:
        return ""

    if _SCHEME_RE.match(url):
        if not url.lower().startswith(("http://", "https://")):
            return ""
    else:
        url = f"https://{url}"

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return ""
    if not _HOSTNAME_RE.match(parsed.netloc):
        return ""
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path or '/'}"


def _allowed(client: HttpClient, cfg: Config, url: str, cache: dict) -> bool:
    """Check robots.txt for this host, caching one parser per host."""
    parsed = urlparse(url)
    host = f"{parsed.scheme}://{parsed.netloc}"

    if host not in cache:
        parser = urllib.robotparser.RobotFileParser()
        text = client.get_text(urljoin(host, "/robots.txt"), max_bytes=100_000)
        if text is None:
            # No robots.txt served: the standard treats that as allow-all.
            cache[host] = None
        else:
            parser.parse(text.splitlines())
            cache[host] = parser

    parser = cache[host]
    if parser is None:
        return True
    return parser.can_fetch(cfg.user_agent, url)


def _pick_email(html: str, domain: str) -> str:
    """Best contact email on the page, or ''."""
    site_domain = domain.lower().removeprefix("www.")
    scored: list[tuple[int, str]] = []

    for raw in EMAIL_RE.findall(html):
        email = raw.strip().strip(".").lower()
        if EMAIL_BLOCKLIST.search(email) or EMAIL_FILE_SUFFIX.search(email):
            continue
        local, _, email_domain = email.partition("@")
        if not local or not email_domain:
            continue

        # Never take an address from an unrelated domain: those are almost
        # always the web designer's, a stock photo credit, or a tracker.
        if site_domain and site_domain not in email_domain and email_domain not in site_domain:
            continue

        rank = 0 if local.startswith(ROLE_PREFIXES) else 1
        scored.append((rank, email))

    if not scored:
        return ""
    scored.sort()
    return scored[0][1]


def _pick_phone(html: str) -> str:
    """First plausible UK phone number on the page, tidied."""
    # tel: links are the most reliable signal when present.
    for match in re.findall(r'href=["\']tel:([^"\']+)["\']', html, re.IGNORECASE):
        cleaned = _clean_phone(match)
        if cleaned:
            return cleaned

    text = re.sub(r"<[^>]+>", " ", html)
    for match in PHONE_RE.findall(text):
        cleaned = _clean_phone(match)
        if cleaned:
            return cleaned
    return ""


def _clean_phone(raw: str) -> str:
    """Normalise to 0-leading UK format, or '' if it isn't one."""
    digits = re.sub(r"[^\d+]", "", raw or "")
    if digits.startswith("+44"):
        digits = "0" + digits[3:]
    elif digits.startswith("44") and len(digits) == 12:
        digits = "0" + digits[2:]
    if not digits.startswith("0"):
        return ""
    if len(digits) not in (10, 11):
        return ""
    return digits
