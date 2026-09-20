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
from models import BUSINESS_TYPES, LANES, PRIORITIES, STATUSES, TRISTATE

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

    chosen = st.multiselect("Towns to search", towns, default=towns)
    radii = {t["name"]: t.get("radius_m", 8000) for t in cfg.towns}
    if chosen:
        st.caption(
            "Search radius per town: "
            + ", ".join(f"{name} {radii[name] / 1000:g} km" for name in chosen)
            + ". Change these in config.yaml."
        )

    if st.button("Run discovery", type="primary", disabled=not chosen):
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
    search = row1[0].text_input("Search", placeholder="business, street or notes")
    types = row1[1].multiselect("Type", BUSINESS_TYPES)
    priorities = row1[2].multiselect("Priority", PRIORITIES)
    lanes = row1[3].multiselect("Lane", LANES)

    row2 = st.columns([2, 2, 1])
    statuses = row2[0].multiselect("Status", STATUSES)
    areas = row2[1].multiselect("Area", sorted(a for a in frame["area"].unique() if a))
    min_score = row2[2].slider("Min score", 0, 100, 0, step=5)

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
        if buttons[0].button("Save changes", type="primary"):
            saved = db.apply_edits(grid, edited, EDITABLE)
            if saved:
                scoring.rescore_all(cfg)
                st.success(f"Saved {saved} lead(s) and rescored.")
            else:
                st.info("Nothing changed.")
            st.rerun()

        if buttons[1].button("Rescore all"):
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
        if st.button("Delete", disabled=not confirm):
            db.delete_lead(options[chosen])
            st.success(f"Deleted {chosen}.")
            st.rerun()


# --- Outreach tab ----------------------------------------------------------

def render_outreach() -> None:
    st.subheader("Outreach")
    st.info("Built in milestone 3.")


# --- Settings tab ----------------------------------------------------------

def render_settings() -> None:
    st.subheader("Settings")

    st.markdown("**Integration status**")
    st.caption("Presence only - your keys are never displayed or logged.")
    for label, present in config.key_status().items():
        st.write(("✅ " if present else "⬜ ") + label + ("" if present else "  (not configured)"))

    st.markdown("**Scoring rubric**")
    st.caption("Edit these in config.yaml, then press Reload and Rescore all on the Leads tab.")
    st.json(cfg.get("scoring", {}), expanded=False)

    st.markdown("**Towns and radius**")
    st.dataframe(cfg.towns, hide_index=True, width="stretch")

    st.caption(f"Config file: `{config.CONFIG_PATH}` · database: `{cfg.db_path}`")
    if st.button("Reload config.yaml"):
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
