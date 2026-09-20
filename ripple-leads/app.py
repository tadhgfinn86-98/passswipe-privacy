"""Ripple Leads - a local lead intelligence and outreach dashboard.

Run it with:    streamlit run app.py

Everything is local: the database is a file next to this script, and no data
leaves your laptop unless you switch on one of the optional integrations.
"""

from __future__ import annotations

import streamlit as st

import config
import db
from models import BUSINESS_TYPES, OPEN_STATUSES, STATUSES

st.set_page_config(page_title="Ripple Leads", page_icon="R", layout="wide")

# Create the tables on first run. Cheap and idempotent, so it can sit here.
db.init_db()
cfg = config.load()


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
            st.dataframe(summary["per_town"], hide_index=True, width='stretch')
        for error in summary["errors"]:
            st.error(error)
        if summary["inserted"]:
            st.info("New leads land with a score of 0. Go to the Leads tab and hit "
                    "'Rescore all' to rank them.")

    with st.expander("Why some businesses are missing"):
        st.write(
            "OpenStreetMap is crowd-sourced. Pubs and restaurants are mapped well; "
            "small independent takeaways are patchier, and email addresses are rare "
            "(most of these leads will be phone or walk-in). Treat a pull as a "
            "starting list - add anything you spot yourself straight into the Leads tab."
        )


# --- Leads tab -------------------------------------------------------------

def render_leads() -> None:
    st.subheader("Leads")
    frame = db.leads_dataframe()
    if frame.empty:
        st.info("No leads yet. Run a discovery pull on the Discover tab.")
        return
    st.write(f"{len(frame)} leads. Full editing arrives in milestone 2.")
    st.dataframe(frame, hide_index=True, width='stretch')


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

    st.markdown("**Current configuration**")
    st.caption(f"Loaded from `{config.CONFIG_PATH}` · database `{cfg.db_path}`")
    st.json(cfg.data, expanded=False)

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
