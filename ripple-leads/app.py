"""Ripple Leads - a local lead intelligence and outreach dashboard.

Run it with:    streamlit run app.py

Everything is local: the database is a file next to this script, and no data
leaves your laptop unless you switch on one of the optional integrations.
"""

from __future__ import annotations

import pandas as pd
import streamlit as st

import config
import db
import score as scoring
from models import BUSINESS_TYPES, LANES, OPEN_STATUSES, PRIORITIES, STATUSES, TRISTATE

st.set_page_config(page_title="Ripple Leads", page_icon="R", layout="wide")

# Create the tables on first run. Cheap and idempotent, so it can sit here.
db.init_db()
cfg = config.load()

# Columns the grid shows, in reading order. Anything in DERIVED is calculated
# by score.py and shown read-only - editing it by hand would just be undone by
# the next rescore.
GRID_COLUMNS = [
    "id", "business", "type", "area", "score", "priority", "suggested_lane",
    "status", "phone", "email", "website", "contact_name",
    "independent", "compliant_yet", "est_monthly_spend",
    "next_action", "next_action_date", "notes", "address", "source",
]
DERIVED = ["id", "score", "priority", "suggested_lane", "source"]
EDITABLE = [c for c in GRID_COLUMNS if c not in DERIVED]


# --- header ----------------------------------------------------------------

def render_header() -> None:
    counts = db.count_by_status()
    total = db.total_leads()

    st.title("Ripple Leads")
    st.caption("Discover → enrich → score → outreach → track. All local, all yours.")

    # The funnel. Each stage counts leads that reached it, so a Won lead is
    # counted as Contacted too - otherwise the numbers look like leads vanish.
    reached = {
        "Leads": total,
        "Contacted": sum(counts.get(s, 0) for s in
                         ["Contacted", "In conversation", "Quote sent", "Won", "Lost"]),
        "In conversation": sum(counts.get(s, 0) for s in
                               ["In conversation", "Quote sent", "Won"]),
        "Quote sent": sum(counts.get(s, 0) for s in ["Quote sent", "Won"]),
        "Won": counts.get("Won", 0),
    }
    columns = st.columns(len(reached))
    for column, (label, value) in zip(columns, reached.items()):
        column.metric(label, value)


# --- Discover tab ----------------------------------------------------------

def render_discover() -> None:
    st.subheader("Discover")
    st.write(
        "Pulls food and hospitality businesses from OpenStreetMap. Free, no API "
        "key, no scraping. Re-running is safe - anything already in your list is "
        "skipped rather than duplicated."
    )

    towns = cfg.town_names
    if not towns:
        st.error("No towns configured. Add some to config.yaml under `towns:`.")
        return

    chosen = st.multiselect("Towns to search", towns, default=towns, key="disc_towns")
    radii = {t["name"]: t.get("radius_m", 8000) for t in cfg.towns}
    if chosen:
        st.caption(
            "Search radius per town: "
            + ", ".join(f"{name} {radii[name] / 1000:g} km" for name in chosen)
            + ". Change these in config.yaml."
        )

    if st.button("Run discovery", type="primary", disabled=not chosen, key="run_discovery"):
        import discover  # imported lazily so the app loads fast

        log = st.empty()
        messages: list[str] = []

        def progress(message: str) -> None:
            messages.append(message)
            log.info("\n\n".join(messages[-6:]))

        with st.spinner("Talking to OpenStreetMap - this can take a minute..."):
            summary = discover.run_discovery(town_names=chosen, progress=progress, cfg=cfg)

        st.success(
            f"Found {summary['found']} businesses. "
            f"{summary['inserted']} new, {summary['duplicates']} already on your list."
        )
        if summary["per_town"]:
            st.dataframe(summary["per_town"], hide_index=True, width="stretch")
        for error in summary["errors"]:
            st.error(error)

        if summary["inserted"]:
            # Score immediately - an unscored lead is invisible in a ranked list.
            updated = scoring.rescore_all(cfg)
            st.success(f"Scored {updated} leads. Head to the Leads tab.")

    with st.expander("Why some businesses are missing"):
        st.write(
            "OpenStreetMap is crowd-sourced. Pubs and restaurants are mapped well; "
            "small independent takeaways are patchier, and email addresses are rare "
            "(most of these leads will be phone or walk-in). Treat a pull as a "
            "starting list - add anything you spot yourself with 'Add a lead by hand' "
            "on the Leads tab."
        )


# --- Leads tab -------------------------------------------------------------

def _filters(frame: pd.DataFrame) -> pd.DataFrame:
    """Sidebar-style filter row above the grid."""
    row1 = st.columns([2, 1, 1, 1])
    search = row1[0].text_input("Search", placeholder="business, street or notes",
                               key="f_search")
    types = row1[1].multiselect("Type", BUSINESS_TYPES, key="f_type")
    priorities = row1[2].multiselect("Priority", PRIORITIES, key="f_priority")
    lanes = row1[3].multiselect("Lane", LANES, key="f_lane")

    row2 = st.columns([2, 2, 1])
    statuses = row2[0].multiselect("Status", STATUSES, key="f_status")
    areas = row2[1].multiselect("Area", sorted(a for a in frame["area"].unique() if a),
                                key="f_area")
    min_score = row2[2].slider("Min score", 0, 100, 0, step=5, key="f_minscore")

    view = frame
    if search:
        needle = search.lower()
        haystack = (view["business"].fillna("") + " " + view["address"].fillna("")
                    + " " + view["notes"].fillna("")).str.lower()
        view = view[haystack.str.contains(needle, regex=False)]
    if types:
        view = view[view["type"].isin(types)]
    if priorities:
        view = view[view["priority"].isin(priorities)]
    if lanes:
        view = view[view["suggested_lane"].isin(lanes)]
    if statuses:
        view = view[view["status"].isin(statuses)]
    if areas:
        view = view[view["area"].isin(areas)]
    if min_score:
        view = view[view["score"] >= min_score]
    return view


def _column_config() -> dict:
    return {
        "id": st.column_config.NumberColumn("ID", width="small"),
        "business": st.column_config.TextColumn("Business", width="medium"),
        "type": st.column_config.SelectboxColumn("Type", options=BUSINESS_TYPES),
        "area": st.column_config.TextColumn("Area"),
        "score": st.column_config.ProgressColumn(
            "Score", min_value=0, max_value=100, format="%d"),
        "priority": st.column_config.TextColumn("Priority", width="small"),
        "suggested_lane": st.column_config.TextColumn("Lane", width="small"),
        "status": st.column_config.SelectboxColumn("Status", options=STATUSES, width="medium"),
        "phone": st.column_config.TextColumn("Phone"),
        "email": st.column_config.TextColumn("Email"),
        "website": st.column_config.LinkColumn("Website"),
        "contact_name": st.column_config.TextColumn("Contact"),
        "independent": st.column_config.SelectboxColumn(
            "Indep.", options=TRISTATE, width="small",
            help="Independent, not part of a chain. Chains buy waste centrally."),
        "compliant_yet": st.column_config.SelectboxColumn(
            "Compliant", options=TRISTATE, width="small",
            help="Do they already have Duty of Care paperwork in order?"),
        "est_monthly_spend": st.column_config.NumberColumn(
            "Spend £/mo", min_value=0, step=25, format="%.0f"),
        "next_action": st.column_config.TextColumn("Next action", width="medium"),
        "next_action_date": st.column_config.DateColumn("When", format="YYYY-MM-DD"),
        "notes": st.column_config.TextColumn("Notes", width="large"),
        "address": st.column_config.TextColumn("Address", width="large"),
        "source": st.column_config.TextColumn("Source", width="small"),
    }


def render_leads() -> None:
    st.subheader("Leads")
    frame = db.leads_dataframe()

    if frame.empty:
        st.info("No leads yet. Run a discovery pull on the Discover tab, or add one by hand below.")
        _add_lead_form()
        return

    view = _filters(frame)
    st.caption(f"Showing {len(view)} of {len(frame)} leads. "
               "Edit any white cell, then press Save. Score, priority and lane are "
               "calculated - they update when you save.")

    if view.empty:
        st.warning("No leads match those filters.")
    else:
        grid = view[GRID_COLUMNS].copy()
        # DateColumn needs real dates; the database stores 'YYYY-MM-DD' strings.
        grid["next_action_date"] = pd.to_datetime(grid["next_action_date"], errors="coerce")

        edited = st.data_editor(
            grid,
            key="leads_editor",
            column_config=_column_config(),
            disabled=DERIVED,
            hide_index=True,
            width="stretch",
            num_rows="fixed",
            height=520,
        )

        buttons = st.columns([1, 1, 4])
        if buttons[0].button("Save changes", type="primary", key="leads_save"):
            saved = db.apply_edits(grid, edited, EDITABLE)
            if saved:
                scoring.rescore_all(cfg)
                st.success(f"Saved {saved} lead(s) and rescored.")
            else:
                st.info("Nothing changed.")
            st.rerun()

        if buttons[1].button("Rescore all", key="leads_rescore"):
            updated = scoring.rescore_all(cfg)
            st.success(f"Rescored - {updated} lead(s) changed.")
            st.rerun()

    _score_breakdown(frame)
    _add_lead_form()
    _danger_zone(frame)


def _score_breakdown(frame: pd.DataFrame) -> None:
    with st.expander("Why did a lead score what it scored?"):
        options = {f"{r.business} ({r.area}) - {r.score}": int(r.id)
                   for r in frame.itertuples()}
        if not options:
            return
        chosen = st.selectbox("Lead", list(options), key="explain_pick")
        lead = db.get_lead(options[chosen])
        if lead:
            st.write(scoring.explain(lead, cfg))
            st.caption(f"Total {lead.score}/100 → {lead.priority} priority, "
                       f"suggested lane: {lead.suggested_lane}. "
                       "Weights live in config.yaml under `scoring:`.")


def _add_lead_form() -> None:
    with st.expander("Add a lead by hand"):
        st.caption("For the ones you spot driving past that OpenStreetMap missed.")
        with st.form("add_lead", clear_on_submit=True):
            row1 = st.columns([2, 1, 1])
            business = row1[0].text_input("Business name *")
            lead_type = row1[1].selectbox("Type", BUSINESS_TYPES)
            area = row1[2].selectbox("Area", cfg.town_names + ["Other"]) if cfg.town_names else \
                row1[2].text_input("Area")

            row2 = st.columns(3)
            street = row2[0].text_input("Street")
            phone = row2[1].text_input("Phone")
            email = row2[2].text_input("Email")

            notes = st.text_area("Notes", height=70)

            if st.form_submit_button("Add lead", type="primary"):
                if not business.strip():
                    st.error("A business name is required.")
                else:
                    from models import Lead

                    new_id = db.insert_lead(Lead(
                        business=business.strip(), type=lead_type, area=area,
                        street=street.strip(), address=street.strip(),
                        phone=phone.strip(), email=email.strip(),
                        notes=notes.strip(), source="manual",
                    ))
                    if new_id is None:
                        st.warning(f"'{business}' on that street is already on your list.")
                    else:
                        scoring.rescore_all(cfg)
                        st.success(f"Added '{business}'.")
                        st.rerun()


def _danger_zone(frame: pd.DataFrame) -> None:
    with st.expander("Delete a lead"):
        options = {f"{r.business} ({r.area})": int(r.id) for r in frame.itertuples()}
        chosen = st.selectbox("Lead to delete", list(options), key="delete_pick")
        confirm = st.checkbox("Yes, delete it permanently", key="delete_confirm")
        if st.button("Delete", disabled=not confirm, key="leads_delete"):
            db.delete_lead(options[chosen])
            st.success(f"Deleted {chosen}.")
            st.rerun()


# --- Outreach tab ----------------------------------------------------------

def render_outreach() -> None:
    import outreach

    st.subheader("Outreach")
    frame = db.leads_dataframe()
    if frame.empty:
        st.info("No leads yet. Run a discovery pull first.")
        return

    lane_calls, lane_email, lane_queue = st.tabs(
        ["Call & walk-in list", "Email drafts", "Queue & approvals"]
    )
    with lane_calls:
        _render_call_list(frame, outreach)
    with lane_email:
        _render_draft_panel(frame, outreach)
    with lane_queue:
        _render_queue(outreach)


def _render_call_list(frame: pd.DataFrame, outreach) -> None:
    """Lane (a): who to ring or walk into, best first."""
    st.write("Your ranked list for the phone and the van. Highest score first.")

    columns = st.columns([1, 1, 2])
    lanes = columns[0].multiselect("Lane", ["Call", "Walk-in"], default=["Call", "Walk-in"],
                                   key="cl_lane")
    only_open = columns[1].checkbox("Hide closed leads", value=True, key="cl_open")
    areas = columns[2].multiselect("Area", sorted(a for a in frame["area"].unique() if a),
                                   key="cl_area")

    view = frame[frame["suggested_lane"].isin(lanes)] if lanes else frame
    if only_open:
        view = view[view["status"].isin(OPEN_STATUSES)]
    if areas:
        view = view[view["area"].isin(areas)]
    view = view.sort_values("score", ascending=False)

    st.caption(f"{len(view)} leads.")
    st.dataframe(
        view[["score", "priority", "business", "type", "area", "phone",
              "address", "status", "next_action"]],
        hide_index=True, width="stretch", height=420,
        column_config={"score": st.column_config.ProgressColumn(
            "Score", min_value=0, max_value=100, format="%d")},
    )

    if st.button("Export this list as CSV", disabled=view.empty, key="cl_export"):
        leads = [db.get_lead(int(i)) for i in view["id"]]
        path = outreach.export_call_list([l for l in leads if l], cfg)
        st.success(f"Saved to {path}")
        st.download_button("Download it", path.read_bytes(), file_name=path.name,
                           mime="text/csv", key="cl_download")

    st.caption("Walk-ins and calls need no consent under UK marketing rules - "
               "this lane is always safe, and it is where most OpenStreetMap "
               "leads will land, because few list an email address.")


def _render_draft_panel(frame: pd.DataFrame, outreach) -> None:
    """Lane (b): enrich a lead, draft an email, review it, export it."""
    with st.expander("Before you send cold email (UK) - read once", expanded=False):
        st.markdown(outreach.COMPLIANCE_NOTE)

    emailable = frame[frame["email"].fillna("") != ""]
    if emailable.empty:
        st.warning(
            "None of your leads have an email address yet. OpenStreetMap rarely "
            "carries them. Add addresses by hand on the Leads tab, or work the "
            "call and walk-in lane instead."
        )
        return

    options = {f"{r.business} ({r.area}) - score {r.score}": int(r.id)
               for r in emailable.sort_values("score", ascending=False).itertuples()}
    chosen = st.selectbox("Lead", list(options), key="draft_pick")
    lead = db.get_lead(options[chosen])
    if lead is None:
        return

    facts = st.columns(4)
    facts[0].metric("Score", lead.score)
    facts[1].metric("Priority", lead.priority)
    facts[2].metric("Independent", lead.independent)
    facts[3].metric("Status", lead.status)
    st.caption(f"{lead.email} · {lead.address or 'no address on record'}")

    # --- enrichment -------------------------------------------------------
    st.markdown("**1. Enrich (optional)**")
    import enrich as enrichment

    if not enrichment.available(cfg):
        st.caption("No Anthropic key set, so this is manual. Set `independent` and "
                   "write an opener yourself on the Leads tab - everything else "
                   "works exactly the same.")
    if st.button("Enrich with AI", disabled=not enrichment.available(cfg), key="do_enrich"):
        with st.spinner("Asking the model..."):
            result = enrichment.enrich_lead(lead, cfg)
        if not result["ok"]:
            st.error(result["error"])
        else:
            db.update_lead(lead.id, independent=result["independent"],
                           opener=result["opener"])
            scoring.rescore_all(cfg)
            cost = enrichment.estimate_cost(result["input_tokens"], result["output_tokens"])
            st.success(
                f"Independent: **{result['independent']}** - {result['independent_reason']}  \n"
                f"Suggested first lane: **{result['first_lane']}**  \n"
                f"Cost: about £{cost:.4f}"
            )
            if not result["opener"]:
                st.info("The model had nothing specific and truthful to open with, so it "
                        "returned nothing rather than inventing a compliment. That is "
                        "working as intended.")
            st.rerun()

    if lead.opener:
        st.info(f"Opener on file: {lead.opener}")

    # --- drafting ---------------------------------------------------------
    st.markdown("**2. Draft**")
    if st.button("Generate email draft", type="primary", key="do_draft",
                 disabled=not outreach.available(cfg)):
        with st.spinner("Writing..."):
            result = outreach.draft_email(lead, cfg)
        if not result["ok"]:
            st.error(result["error"])
        else:
            db.update_lead(lead.id, draft_subject=result["subject"],
                           draft_body=result["body"])
            st.rerun()
    if not outreach.available(cfg):
        st.caption("No Anthropic key - write the draft yourself below and it will "
                   "export just the same.")

    # --- review -----------------------------------------------------------
    st.markdown("**3. Review and edit**")
    st.caption("Nothing is sent from this screen. Edit freely - you have the last word.")
    subject = st.text_input("Subject", value=lead.draft_subject, key=f"subj_{lead.id}")
    body = st.text_area("Body", value=lead.draft_body or outreach.assemble_body(lead, "", cfg),
                        height=320, key=f"body_{lead.id}")

    if body and not outreach.has_opt_out(body, cfg):
        st.warning("This draft has no opt-out line. UK rules expect one on every "
                   "marketing email. Put it back before you send.")

    row = st.columns([1, 1, 1, 2])
    if row[0].button("Save draft", key="do_save_draft"):
        db.update_lead(lead.id, draft_subject=subject, draft_body=body)
        st.success("Saved.")
        st.rerun()

    approved = row[1].checkbox("Approved", value=lead.approved, key=f"appr_{lead.id}",
                               help="Nothing can be sent until you tick this.")
    if approved != lead.approved:
        db.update_lead(lead.id, approved=approved)
        st.rerun()

    if row[2].button("Export .eml", disabled=not (subject and body), key="do_export_eml"):
        db.update_lead(lead.id, draft_subject=subject, draft_body=body)
        path = outreach.export_eml(lead, subject, body, cfg)
        st.success(f"Saved to {path}")
        st.download_button("Download it", path.read_bytes(), file_name=path.name,
                           mime="message/rfc822", key="do_download_eml")
    st.caption("A .eml file opens straight into Outlook, Thunderbird or Windows Mail "
               "with the recipient and text already filled in - you press send.")

    # --- optional integrations, only shown when switched on ---------------
    import crm

    extras = st.columns([1, 1, 2])
    if outreach.gmail_available(cfg):
        if extras[0].button("Save to Gmail drafts", key="do_gmail_draft",
                            disabled=not (subject and body)):
            db.update_lead(lead.id, draft_subject=subject, draft_body=body)
            result = outreach.create_gmail_draft(lead, subject, body, cfg)
            if result["ok"]:
                st.success("Drafted in Gmail. Open Gmail, read it once more, press send.")
            else:
                st.error(result["error"])
    if crm.available(cfg):
        if extras[1].button("Push to Notion", key="do_notion"):
            result = crm.push_lead(lead, cfg)
            if result["ok"]:
                st.success(f"Pushed. [Open in Notion]({result['url']})")
                st.caption("Sent: " + ", ".join(result["sent_properties"]))
            else:
                st.error(result["error"])
    if not outreach.gmail_available(cfg) and not crm.available(cfg):
        st.caption("Gmail and Notion are switched off. Turn them on in config.yaml "
                   "once you have the credentials - see the README.")


def _render_queue(outreach) -> None:
    """Lane (c): what is approved and ready, and what the cap allows today."""
    status = outreach.cap_status(cfg)
    columns = st.columns(3)
    columns[0].metric("Daily cap", status["cap"])
    columns[1].metric("Sent today", status["used"])
    columns[2].metric("Remaining", status["remaining"])
    st.caption("The cap counts real sends recorded in the database, so restarting "
               "the app does not reset it. Change it in config.yaml.")

    approved = [l for l in db.all_leads() if l.approved and l.draft_subject and l.draft_body]
    if not approved:
        st.info("Nothing approved yet. Draft an email, then tick 'Approved' on the "
                "Email drafts tab.")
        return

    st.write(f"**{len(approved)} lead(s) approved and ready.**")
    st.dataframe(
        [{"Business": l.business, "To": l.email, "Score": l.score,
          "Subject": l.draft_subject,
          "Opt-out present": "yes" if outreach.has_opt_out(l.draft_body, cfg) else "NO"}
         for l in approved],
        hide_index=True, width="stretch",
    )

    buttons = st.columns([1, 1, 2])
    if buttons[0].button("Export all as .eml", key="q_eml"):
        paths = [outreach.export_eml(l, l.draft_subject, l.draft_body, cfg) for l in approved]
        st.success(f"Wrote {len(paths)} files to {outreach.EXPORT_DIR}")
    if buttons[1].button("Export all as CSV", key="q_csv"):
        path = outreach.export_csv(approved, cfg=cfg)
        st.success(f"Saved to {path}")
        st.download_button("Download it", path.read_bytes(), file_name=path.name,
                           mime="text/csv", key="q_download")

    # --- sending, one at a time and always gated --------------------------
    st.markdown("**Send**")
    if not outreach.gmail_available(cfg):
        st.caption("Gmail sending is off. Export the .eml files above and send them "
                   "from your own mail client instead - same result, no setup. "
                   "To switch Gmail on, see the README.")
        return

    st.caption("One at a time, on purpose. Each send is checked against the cap, "
               "the approval tick and the opt-out line at the moment you press it.")
    for lead in approved:
        allowed, reason = outreach.send_guard(lead, cfg=cfg)
        row = st.columns([3, 2, 1])
        row[0].write(f"**{lead.business}** → {lead.email}")
        row[1].caption(reason or "Ready to send.")
        if row[2].button("Send", key=f"send_{lead.id}", disabled=not allowed):
            result = outreach.send_gmail(lead, lead.draft_subject, lead.draft_body, cfg)
            if result["ok"]:
                st.success(f"Sent to {lead.business}. {result['remaining']} left today.")
                st.rerun()
            else:
                st.error(result["error"])


# --- Settings tab ----------------------------------------------------------

def outreach_ready() -> bool:
    import outreach

    return outreach.gmail_available(cfg)



def render_settings() -> None:
    st.subheader("Settings")

    st.markdown("**Integration status**")
    st.caption("Presence only - your keys are never displayed or logged.")
    for label, present in config.key_status().items():
        st.write(("✅ " if present else "⬜ ") + label + ("" if present else "  (not configured)"))

    st.markdown("**Switches**")
    import crm

    switches = {
        "Google Places discovery": bool(cfg.get("discovery.use_google_places", False)),
        "Gmail drafts and sending": bool(cfg.get("outreach.use_gmail", False)),
        "Notion CRM push": bool(cfg.get("crm.use_notion", False)),
    }
    for label, on in switches.items():
        st.write(("🟢 on   " if on else "⚪ off  ") + label)
    ready = {
        "Gmail is usable right now": outreach_ready(),
        "Notion is usable right now": crm.available(cfg),
    }
    for label, ok in ready.items():
        st.caption(("yes - " if ok else "no - ") + label.lower()
                   + ("" if ok else " (needs both the switch in config.yaml and the "
                                   "credentials in .env)"))
    st.caption(f"Daily send cap: {cfg.get('outreach.daily_send_cap', 20)} · "
               f"sent today: {db.sends_today()}")

    st.markdown("**Scoring rubric**")
    st.caption("Edit these in config.yaml, then press Reload and Rescore all on the Leads tab.")
    st.json(cfg.get("scoring", {}), expanded=False)

    st.markdown("**Towns and radius**")
    st.dataframe(cfg.towns, hide_index=True, width="stretch")

    st.caption(f"Config file: `{config.CONFIG_PATH}` · database: `{cfg.db_path}`")
    if st.button("Reload config.yaml", key="settings_reload"):
        config.reload()
        st.success("Reloaded. Switch tabs to see the new values.")
        st.rerun()


# --- layout ----------------------------------------------------------------

render_header()
tab_discover, tab_leads, tab_outreach, tab_settings = st.tabs(
    ["Discover", "Leads", "Outreach", "Settings"]
)
with tab_discover:
    render_discover()
with tab_leads:
    render_leads()
with tab_outreach:
    render_outreach()
with tab_settings:
    render_settings()
