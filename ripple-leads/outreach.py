"""OUTREACH - three lanes out of the dashboard.

  (a) A ranked call / walk-in list, highest score first.
  (b) An email draft you review and edit, exported as .eml or CSV.
  (c) An optional Gmail send, capped and gated (milestone 4).

Compliance is built into the plumbing rather than left to the model:

  * The opt-out line and your sender identity are appended in Python, after
    the model has finished. The model cannot drop, reword or forget them.
  * The daily cap counts rows in the `sends` table, so it survives restarts
    and cannot be reset by reloading the page.
  * Nothing sends without the lead being marked Approved first.

This is practical guidance, not legal advice. See the note in the UI about
limited companies versus sole traders.
"""

from __future__ import annotations

import csv
import json
import re
from datetime import datetime
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Optional

import config
from models import Lead

EXPORT_DIR = config.BASE_DIR / "exports"

# UK direct marketing in one paragraph, surfaced in the UI. Deliberately short
# and non-scary - it is a prompt to think, not a substitute for advice.
COMPLIANCE_NOTE = """**Before you send cold email (UK)**

Cold B2B email is on its safest footing when the recipient is a *limited
company or LLP* - a "corporate subscriber" under PECR. You must still identify
yourself and offer a way to opt out, both of which this tool adds automatically.

Sole traders, partnerships and individuals are treated as individual
subscribers and generally need prior consent. Many independent cafés and
takeaways are sole traders, and you often cannot tell from the outside - so
for anything you are unsure about, **use the call or walk-in lane instead**.
A conversation needs no consent.

This is guidance, not legal advice."""

DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "subject": {
            "type": "string",
            "description": "Under 55 characters. Plain and specific. No exclamation "
                           "marks, no 'Quick question', no fake urgency.",
        },
        "body": {
            "type": "string",
            "description": "The email body only. 80-120 words, UK English, plain text, "
                           "no greeting line and no sign-off - those are added "
                           "afterwards. End with one clear, small ask.",
        },
    },
    "required": ["subject", "body"],
    "additionalProperties": False,
}


def _draft_system_prompt(cfg: config.Config) -> str:
    company = cfg.get("outreach.company_name", "Ripple Recycling")
    return f"""You write short cold emails for {company}, a one-person commercial \
waste brokerage in Worcestershire, UK.

What the business does, in plain terms: most restaurants, cafés and pubs are \
overpaying their waste collector and their Duty of Care paperwork is untidy. \
{company} audits what they currently pay, moves them to a better-matched local \
permitted facility, and keeps the compliance records in order. It does not own \
trucks or handle waste - it is the broker in between. The opening offer is a \
free audit of their current bill.

How to write:
- Write like one local business owner emailing another. Short sentences.
- 80 to 120 words. Any longer and it will not be read.
- Never invent a fact about them. You know only what you are told. If you were \
given no specific detail, open with something plainly true (their trade and \
their town) rather than inventing a compliment.
- No jargon, no "I hope this email finds you well", no "circular economy", no \
stacked adjectives, no exclamation marks.
- One small ask at the end: a ten-minute call, or permission to send a quick \
comparison. Never ask them to sign anything.
- Do not promise a specific saving. You have not seen their bill.
- Do not write a greeting line or a sign-off. Those are added automatically."""


def available(cfg: Optional[config.Config] = None) -> bool:
    return bool(config.anthropic_key())


def draft_email(lead: Lead, cfg: Optional[config.Config] = None,
                client: Any = None) -> dict[str, Any]:
    """Generate a subject and body for one lead.

    Returns {"ok": True, "subject": ..., "body": ...} or {"ok": False, "error": ...}.
    The body comes back already topped and tailed with greeting, sign-off and
    the opt-out line.
    """
    cfg = cfg or config.load()

    try:
        import anthropic
    except ImportError:
        return {"ok": False, "error": "The `anthropic` package isn't installed. "
                                      "Run: pip install anthropic"}

    if client is None:
        key = config.anthropic_key()
        if not key:
            return {"ok": False,
                    "error": "No ANTHROPIC_API_KEY set. You can still write a draft by "
                             "hand in the box below and export it."}
        client = anthropic.Anthropic(api_key=key)

    facts = [
        f"- Business: {lead.business}",
        f"- Trade: {lead.type}",
        f"- Town: {lead.area or 'not known'}",
        f"- Contact name: {lead.contact_name or 'not known - do not guess one'}",
        f"- Independent: {lead.independent}",
    ]
    if lead.opener:
        facts.append(f"- An opening line already drafted for this business: {lead.opener}")
    if lead.notes:
        facts.append(f"- The sender's own notes: {lead.notes}")

    model = cfg.get("enrichment.model", "claude-haiku-4-5")
    try:
        response = client.messages.create(
            model=model,
            max_tokens=int(cfg.get("enrichment.max_tokens", 700)),
            system=_draft_system_prompt(cfg),
            messages=[{"role": "user",
                       "content": "Write the email for this business:\n\n" + "\n".join(facts)}],
            output_config={"format": {"type": "json_schema", "schema": DRAFT_SCHEMA}},
        )
    except anthropic.NotFoundError:
        return {"ok": False, "error": f"Model '{model}' not found for your account."}
    except anthropic.AuthenticationError:
        return {"ok": False, "error": "Anthropic rejected the API key. Check .env."}
    except anthropic.RateLimitError:
        return {"ok": False, "error": "Rate limited. Wait a moment and retry."}
    except anthropic.APIStatusError as exc:
        return {"ok": False, "error": f"Anthropic API error {exc.status_code}."}
    except anthropic.APIConnectionError:
        return {"ok": False, "error": "Could not reach Anthropic. Check your connection."}

    if response.stop_reason == "refusal":
        return {"ok": False, "error": "The model declined to draft this one."}

    try:
        text = next(b.text for b in response.content if b.type == "text")
        data = json.loads(text)
    except (StopIteration, json.JSONDecodeError):
        return {"ok": False, "error": "Unexpected response shape from the model."}

    return {
        "ok": True,
        "subject": (data.get("subject") or "").strip(),
        "body": assemble_body(lead, data.get("body", ""), cfg),
    }


def assemble_body(lead: Lead, core: str, cfg: Optional[config.Config] = None) -> str:
    """Wrap the model's paragraphs in a greeting, a signature and the opt-out.

    Done in Python on purpose: these three things are the parts that must be
    present on every single email, so they are not left to a language model.
    """
    cfg = cfg or config.load()
    sender = cfg.get("outreach.sender_name", "") or "[your name]"
    company = cfg.get("outreach.company_name", "Ripple Recycling")
    email_address = cfg.get("outreach.sender_email", "")
    phone = cfg.get("outreach.reply_phone", "")
    opt_out = " ".join((cfg.get("outreach.opt_out_line", "") or "").split())

    greeting = f"Hi {lead.contact_name.split()[0]}," if lead.contact_name else "Hello,"

    signature = [sender, company]
    if phone:
        signature.append(phone)
    if email_address:
        signature.append(email_address)

    parts = [greeting, "", (core or "").strip(), "", "Thanks,", "\n".join(signature)]
    if opt_out:
        parts += ["", "--", opt_out]
    return "\n".join(parts).strip() + "\n"


def has_opt_out(body: str, cfg: Optional[config.Config] = None) -> bool:
    """Check an edited draft still carries an opt-out.

    You can edit any draft freely, including deleting the footer. This is what
    the UI uses to warn you before you export or send something without one.
    """
    cfg = cfg or config.load()
    configured = " ".join((cfg.get("outreach.opt_out_line", "") or "").split()).lower()
    text = " ".join(body.split()).lower()
    if configured and configured in text:
        return True
    # A hand-written opt-out counts too - look for the usual phrasings.
    return bool(re.search(r"\b(unsubscribe|opt out|reply stop|remove you from|"
                          r"no longer wish to hear|rather not hear)\b", text))


# --- export ----------------------------------------------------------------

def _safe_filename(text: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-")
    return (cleaned or "lead")[:60]


def build_eml(lead: Lead, subject: str, body: str,
              cfg: Optional[config.Config] = None) -> EmailMessage:
    """Build a standards-compliant email message object."""
    cfg = cfg or config.load()
    message = EmailMessage()
    message["Subject"] = subject
    sender_name = cfg.get("outreach.sender_name", "")
    sender_email = cfg.get("outreach.sender_email", "")
    if sender_email:
        message["From"] = f"{sender_name} <{sender_email}>" if sender_name else sender_email
    if lead.email:
        message["To"] = lead.email
    message["Date"] = datetime.now().astimezone().strftime("%a, %d %b %Y %H:%M:%S %z")
    message.set_content(body)
    return message


def export_eml(lead: Lead, subject: str, body: str,
               cfg: Optional[config.Config] = None) -> Path:
    """Write a .eml file you can double-click to open in Outlook, Thunderbird
    or the Windows Mail app, ready to review and send yourself."""
    EXPORT_DIR.mkdir(exist_ok=True)
    message = build_eml(lead, subject, body, cfg)
    path = EXPORT_DIR / f"{_safe_filename(lead.business)}-{lead.id or 0}.eml"
    path.write_bytes(bytes(message))
    return path


def export_csv(leads: list[Lead], filename: str = "",
               cfg: Optional[config.Config] = None) -> Path:
    """Export drafts as a CSV - for mail merge, or just for a record."""
    EXPORT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    path = EXPORT_DIR / (filename or f"drafts-{stamp}.csv")
    fields = ["business", "contact_name", "email", "phone", "area", "type",
              "score", "priority", "suggested_lane", "status",
              "draft_subject", "draft_body"]
    with open(path, "w", newline="", encoding="utf-8-sig") as handle:
        # utf-8-sig writes a BOM so Excel on Windows opens accented characters
        # correctly instead of showing mojibake.
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for lead in leads:
            writer.writerow({f: getattr(lead, f, "") for f in fields})
    return path


def export_call_list(leads: list[Lead], cfg: Optional[config.Config] = None) -> Path:
    """The ranked call / walk-in sheet, as a CSV you can print for the van."""
    EXPORT_DIR.mkdir(exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    path = EXPORT_DIR / f"call-list-{stamp}.csv"
    fields = ["score", "priority", "business", "type", "area", "phone",
              "address", "suggested_lane", "status", "next_action", "notes"]
    with open(path, "w", newline="", encoding="utf-8-sig") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for lead in leads:
            writer.writerow({f: getattr(lead, f, "") for f in fields})
    return path


# --- daily cap -------------------------------------------------------------

def cap_status(cfg: Optional[config.Config] = None) -> dict[str, int]:
    """How many sends are left today. Counted from the database, so closing
    the app does not reset it."""
    import db

    cfg = cfg or config.load()
    cap = int(cfg.get("outreach.daily_send_cap", 20))
    used = db.sends_today()
    return {"cap": cap, "used": used, "remaining": max(0, cap - used)}
