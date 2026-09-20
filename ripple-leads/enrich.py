"""ENRICH - optional AI assist for a single lead.

Entirely optional. With no ANTHROPIC_API_KEY set, the app tells you so and you
fill the fields in by hand; nothing else breaks.

Two design rules, both about not poisoning your pipeline with invented facts:

1. The model is told to answer "unknown" rather than guess. Scoring gives no
   points for "unknown", so an unsure answer costs you nothing and a
   fabricated one would cost you a wasted drive.
2. The model only ever sees the fields already in your database. It does not
   browse, and it is told it has not seen their website - so an opener can
   only reference what you already know.
"""

from __future__ import annotations

import json
from typing import Any, Optional

import config
from models import Lead

# The fields we ask for back. `strict`-style JSON schema means the response is
# guaranteed to parse and to use only these enum values.
RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "independent": {
            "type": "string",
            "enum": ["Y", "N", "unknown"],
            "description": "Y if a single-site or small local independent, "
                           "N if a recognised chain or franchise, unknown if unsure.",
        },
        "independent_reason": {
            "type": "string",
            "description": "One short sentence. Say 'not enough information' when unsure.",
        },
        "opener": {
            "type": "string",
            "description": "One sentence, max 25 words, usable as the opening line of a "
                           "cold email. Must rely only on the supplied facts. Empty string "
                           "if there is nothing specific and truthful to say.",
        },
        "first_lane": {
            "type": "string",
            "enum": ["Email", "Call", "Walk-in"],
            "description": "Best first approach given the contact details available.",
        },
    },
    "required": ["independent", "independent_reason", "opener", "first_lane"],
    "additionalProperties": False,
}

SYSTEM_PROMPT = """You help a one-person commercial waste brokerage in \
Worcestershire, UK qualify food and hospitality leads.

You will be given the facts a public map database holds about one business. \
That is all you get. You have NOT visited their website, read reviews, or seen \
the premises.

Rules, in order of importance:
1. Never invent a fact. If you are not sure, answer "unknown". An "unknown" is \
always better than a guess - the user acts on these answers in person.
2. You may use well-known public knowledge about national chains (for example, \
Costa, Greggs, Wetherspoon are chains). You may not infer that an unfamiliar \
name is independent just because you do not recognise it - that is "unknown".
3. The opener must be truthful and specific enough to show a human wrote to \
this business rather than a list. If the only facts you have are the name and \
the town, say so by returning an empty opener rather than inventing warmth \
("I love your cosy atmosphere" when you have never been there is a lie).
4. Never mention waste, recycling or savings in the opener - that is the next \
line of the email, not the first."""


def available(cfg: Optional[config.Config] = None) -> bool:
    """True when enrichment can run - i.e. a key is present."""
    return bool(config.anthropic_key())


def _lead_facts(lead: Lead) -> str:
    """Render the lead as a plain fact list. Blank fields are shown as
    'not known' so the model sees an explicit absence rather than a gap it
    might be tempted to fill."""
    facts = {
        "Business name": lead.business,
        "Type": lead.type,
        "Town": lead.area,
        "Address": lead.address,
        "Phone on record": lead.phone,
        "Website on record": lead.website,
        "Email on record": lead.email,
        "Notes from the user": lead.notes,
    }
    return "\n".join(f"- {k}: {v or 'not known'}" for k, v in facts.items())


def enrich_lead(lead: Lead, cfg: Optional[config.Config] = None,
                client: Any = None) -> dict[str, Any]:
    """Ask the model about one lead.

    Returns {"ok": True, ...fields...} or {"ok": False, "error": "..."}.
    Never raises - a failed enrichment must not take the dashboard down.

    `client` is only passed by the self-test, so the response handling can be
    exercised without spending money or needing a key.
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
                    "error": "No ANTHROPIC_API_KEY set. Fill the fields in by hand."}
        client = anthropic.Anthropic(api_key=key)
    model = cfg.get("enrichment.model", "claude-haiku-4-5")

    try:
        response = client.messages.create(
            model=model,
            max_tokens=int(cfg.get("enrichment.max_tokens", 700)),
            system=SYSTEM_PROMPT,
            messages=[{
                "role": "user",
                "content": f"Here is the business:\n\n{_lead_facts(lead)}",
            }],
            # Guarantees valid JSON matching the schema, so no fragile parsing.
            output_config={"format": {"type": "json_schema", "schema": RESPONSE_SCHEMA}},
        )
    except anthropic.NotFoundError:
        return {"ok": False, "error": f"Model '{model}' not found for your account. "
                                      "Check enrichment.model in config.yaml."}
    except anthropic.AuthenticationError:
        return {"ok": False, "error": "Anthropic rejected the API key. Check .env."}
    except anthropic.RateLimitError:
        return {"ok": False, "error": "Rate limited by Anthropic. Wait a moment and retry."}
    except anthropic.APIStatusError as exc:
        return {"ok": False, "error": f"Anthropic API error {exc.status_code}."}
    except anthropic.APIConnectionError:
        return {"ok": False, "error": "Could not reach Anthropic. Check your connection."}

    if response.stop_reason == "refusal":
        return {"ok": False, "error": "The model declined to answer for this lead."}

    try:
        text = next(block.text for block in response.content if block.type == "text")
        data = json.loads(text)
    except (StopIteration, json.JSONDecodeError):
        return {"ok": False, "error": "Unexpected response shape from the model."}

    usage = getattr(response, "usage", None)
    return {
        "ok": True,
        "independent": data.get("independent", "unknown"),
        "independent_reason": data.get("independent_reason", ""),
        "opener": (data.get("opener") or "").strip(),
        "first_lane": data.get("first_lane", "Walk-in"),
        "input_tokens": getattr(usage, "input_tokens", 0),
        "output_tokens": getattr(usage, "output_tokens", 0),
    }


def estimate_cost(input_tokens: int, output_tokens: int) -> float:
    """Rough GBP cost of one call, for the running total in the UI.

    Haiku 4.5 list price is $1 per million input tokens and $5 per million
    output. Converted at a round 0.80 GBP to the dollar - this is an estimate
    for reassurance, not an invoice.
    """
    usd = (input_tokens / 1_000_000) * 1.0 + (output_tokens / 1_000_000) * 5.0
    return usd * 0.80
