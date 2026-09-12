/* Fund Desk front end.
 *
 * No framework and no build step: this page is served straight off disk by the
 * desk router, so it stays editable in a packaged desktop app and adds nothing
 * to the terminal's Vite build.
 *
 * Auth piggybacks on the terminal. /api/desk/* sits behind the same middleware
 * as every other /api route, and the React shell stores its JWT in
 * localStorage under "ot-access-token" on the same origin — so logging into
 * the terminal logs you into the desk.
 */

const ACCESS_TOKEN_KEY = "ot-access-token";

const state = {
  engines: [],
  pinnedSymbols: [],
};

/* ---- transport -------------------------------------------------------- */

function token() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || "";
  } catch {
    return ""; // private mode / blocked storage — handled as "not signed in"
  }
}

async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const jwt = token();
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const response = await fetch(`/api/desk${path}`, { ...options, headers });
  if (response.status === 401) {
    setAuthStatus(false);
    throw new Error("Not signed in — open the terminal, log in, then reload this page.");
  }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${response.status}: ${detail.slice(0, 300)}`);
  }
  return response.json();
}

function setAuthStatus(ok, label) {
  const el = document.getElementById("auth-status");
  el.textContent = label || (ok ? "AUTHENTICATED" : "NOT SIGNED IN");
  el.className = `status ${ok ? "ok" : "warn"}`;
}

/* ---- helpers ---------------------------------------------------------- */

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const pct = (v) => (v === null || v === undefined ? "—" : `${(v * 100).toFixed(2)}%`);
const money = (v) =>
  v === null || v === undefined
    ? "—"
    : v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const signClass = (v) => (v > 0 ? "pos" : v < 0 ? "neg" : "");

/* ---- engines ---------------------------------------------------------- */

async function loadEngines() {
  const grid = document.getElementById("engine-grid");
  try {
    const data = await api("/engines");
    state.engines = data.engines || [];
    setAuthStatus(true);
  } catch (err) {
    grid.innerHTML = `<div class="block errors"><h2>UNAVAILABLE</h2><p>${esc(err.message)}</p></div>`;
    return;
  }

  grid.innerHTML = state.engines.map(engineCard).join("");
  fillEngineSelect();

  try {
    const universe = await api("/universe");
    state.pinnedSymbols = universe.pinned_symbols || [];
    const hint = document.getElementById("universe-hint");
    hint.textContent = state.pinnedSymbols.length
      ? `offline tape: ${state.pinnedSymbols.slice(0, 6).join(", ")}${state.pinnedSymbols.length > 6 ? "…" : ""}`
      : "";
  } catch {
    /* the picker hint is a nicety; its absence shouldn't break the page */
  }
}

function engineCard(engine) {
  const avail = engine.availability || {};
  const cls = avail.ready ? "ready" : avail.installed ? "blocked" : "absent";
  const missing = (avail.missing || []).filter((m) => !m.satisfied);

  return `
    <article class="card ${cls}">
      <h3>${esc(engine.name)}</h3>
      <div class="meta">
        <span class="pill ${avail.ready ? "ready" : "blocked"}">${avail.ready ? "ready" : avail.installed ? "blocked" : "not fetched"}</span>
        <span class="pill">${esc(engine.asset_class)}</span>
        <span class="pill ${engine.license === "AGPL-3.0" ? "agpl" : ""}">${esc(engine.license || "—")}</span>
      </div>
      <p>${esc(engine.summary)}</p>
      <div class="detail">${esc(avail.detail || "")}</div>
      ${
        missing.length
          ? `<ul class="missing">${missing
              .map((m) => `<li><code>${esc(m.key)}</code> — ${esc(m.purpose)}</li>`)
              .join("")}</ul>`
          : ""
      }
      <div class="meta"><span class="pill">${esc(engine.upstream)}</span></div>
    </article>`;
}

function fillEngineSelect() {
  const select = document.getElementById("engine");
  select.innerHTML = state.engines
    .map((e) => {
      const ready = e.availability && e.availability.ready;
      return `<option value="${esc(e.id)}">${esc(e.name)}${ready ? "" : "  (not ready)"}</option>`;
    })
    .join("");
}

/* ---- running ---------------------------------------------------------- */

function selectedEngine() {
  const id = document.getElementById("engine").value;
  return state.engines.find((e) => e.id === id);
}

async function execute(event) {
  event.preventDefault();
  const button = document.getElementById("run-button");
  const output = document.getElementById("run-output");
  const mode = document.getElementById("mode").value;

  const universe = document
    .getElementById("universe")
    .value.split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const body = {
    engine: document.getElementById("engine").value,
    universe,
    capital: Number(document.getElementById("capital").value) || 100000,
  };

  button.disabled = true;
  button.textContent = mode === "backtest" ? "BACKTESTING…" : "RUNNING…";
  output.innerHTML = `<div class="loading">engine working — LLM-backed engines can take a minute…</div>`;

  try {
    let result;
    if (mode === "backtest") {
      body.start = document.getElementById("start").value;
      body.end = document.getElementById("end").value;
      result = await api("/backtest", { method: "POST", body: JSON.stringify(body) });
      output.innerHTML = renderBacktest(result);
      drawCurve(result);
    } else {
      result = await api("/cycle", { method: "POST", body: JSON.stringify(body) });
      output.innerHTML = renderCycle(result);
    }
  } catch (err) {
    output.innerHTML = `<div class="block errors"><h2>FAILED</h2><p>${esc(err.message)}</p></div>`;
  } finally {
    button.disabled = false;
    button.textContent = "EXECUTE";
  }
}

function renderErrors(errors) {
  if (!errors || !errors.length) return "";
  return `<div class="block errors">
      <h2>BLOCKED</h2>
      <ul class="missing">${errors.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>`;
}

function renderCycle(cycle) {
  const blocks = [renderErrors(cycle.errors)];

  blocks.push(`<div class="block">
      <h2>${esc(cycle.fund)} — ${esc(cycle.as_of)}</h2>
      <div class="stats">
        <div class="stat"><div class="k">NAV</div><div class="v">${money(cycle.nav)}</div></div>
        <div class="stat"><div class="k">CASH</div><div class="v">${money(cycle.cash)}</div></div>
        <div class="stat"><div class="k">POSITIONS</div><div class="v">${Object.keys(cycle.positions || {}).length}</div></div>
        <div class="stat"><div class="k">ORDERS</div><div class="v">${(cycle.orders || []).length}</div></div>
        <div class="stat"><div class="k">RISK EVENTS</div><div class="v">${(cycle.risk_events || []).length}</div></div>
      </div>
    </div>`);

  const weights = Object.entries(cycle.final_weights || {}).sort((a, b) => b[1] - a[1]);
  if (weights.length) {
    const max = Math.max(...weights.map(([, w]) => w));
    blocks.push(`<div class="block">
        <h2>BOOK</h2>
        <table>
          <thead><tr><th>TICKER</th><th class="num">TARGET</th><th class="num">FINAL</th><th>WEIGHT</th><th class="num">MARK</th></tr></thead>
          <tbody>${weights
            .map(([ticker, weight]) => {
              const target = (cycle.target_weights || {})[ticker];
              const trimmed = target !== undefined && Math.abs(target - weight) > 1e-6;
              return `<tr>
                <td>${esc(ticker)}</td>
                <td class="num ${trimmed ? "neg" : ""}">${pct(target)}</td>
                <td class="num">${pct(weight)}</td>
                <td><span class="bar" style="width:${(weight / max) * 100}%"></span></td>
                <td class="num">${(cycle.marks || {})[ticker]?.toFixed(4) ?? "—"}</td>
              </tr>`;
            })
            .join("")}</tbody>
        </table>
      </div>`);
  }

  for (const strategy of cycle.strategies || []) {
    const signals = strategy.signals || [];
    if (!signals.length) continue;
    blocks.push(`<div class="block">
        <h2>${esc(strategy.name.toUpperCase())} — SLICE ${pct(strategy.slice)}</h2>
        <table>
          <thead><tr><th>ANALYST</th><th>TICKER</th><th>VIEW</th><th class="num">CONF</th><th>RATIONALE</th></tr></thead>
          <tbody>${signals
            .map(
              (s) => `<tr>
                <td>${esc(s.author)}</td>
                <td>${esc(s.ticker)}</td>
                <td class="${esc(s.direction)}">${esc(s.direction)}</td>
                <td class="num">${(s.confidence * 100).toFixed(0)}%</td>
                <td class="rationale">${esc(s.rationale)}</td>
              </tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>`);
  }

  if ((cycle.risk_events || []).length) {
    blocks.push(`<div class="block">
        <h2>RISK</h2>
        <table>
          <thead><tr><th>KIND</th><th>SCOPE</th><th>REASON</th><th class="num">BEFORE</th><th class="num">AFTER</th></tr></thead>
          <tbody>${cycle.risk_events
            .map(
              (r) => `<tr>
                <td class="${r.kind === "veto" ? "neg" : ""}">${esc(r.kind)}</td>
                <td>${esc(r.scope)}</td>
                <td class="rationale">${esc(r.reason)}</td>
                <td class="num">${pct(r.before)}</td>
                <td class="num">${pct(r.after)}</td>
              </tr>`,
            )
            .join("")}</tbody>
        </table>
      </div>`);
  }

  if ((cycle.skipped || []).length) {
    blocks.push(`<div class="block">
        <h2>SKIPPED</h2>
        <table><tbody>${cycle.skipped
          .map((s) => `<tr><td>${esc(s.ticker)}</td><td class="rationale">${esc(s.reason)}</td></tr>`)
          .join("")}</tbody></table>
      </div>`);
  }

  blocks.push(
    `<details><summary>RAW CYCLE RECORD</summary><pre>${esc(JSON.stringify(cycle, null, 2))}</pre></details>`,
  );
  return blocks.join("");
}

function renderBacktest(result) {
  const m = result.metrics || {};
  const beat =
    m.total_return !== null && m.benchmark_return !== null && m.benchmark_return !== undefined
      ? m.total_return - m.benchmark_return
      : null;

  const blocks = [renderErrors(result.errors)];
  blocks.push(`<div class="block">
      <h2>${esc(result.fund)} — ${esc(result.start)} → ${esc(result.end)}</h2>
      <div class="stats">
        <div class="stat"><div class="k">TOTAL RETURN</div><div class="v ${signClass(m.total_return)}">${pct(m.total_return)}</div></div>
        <div class="stat"><div class="k">BENCHMARK</div><div class="v ${signClass(m.benchmark_return)}">${pct(m.benchmark_return)}</div></div>
        <div class="stat"><div class="k">EXCESS</div><div class="v ${signClass(beat)}">${pct(beat)}</div></div>
        <div class="stat"><div class="k">CAGR</div><div class="v ${signClass(m.cagr)}">${pct(m.cagr)}</div></div>
        <div class="stat"><div class="k">SHARPE</div><div class="v">${m.sharpe?.toFixed(2) ?? "—"}</div></div>
        <div class="stat"><div class="k">MAX DD</div><div class="v neg">${pct(m.max_drawdown)}</div></div>
      </div>
    </div>`);

  if ((result.curve || []).length) {
    blocks.push(`<div class="block">
        <h2>EQUITY CURVE</h2>
        <canvas class="chart" id="curve"></canvas>
        <div class="legend">
          <span><span class="swatch" style="background:var(--amber)"></span>fund</span>
          <span><span class="swatch" style="background:var(--dim)"></span>equal-weight buy &amp; hold</span>
        </div>
      </div>`);
  }

  blocks.push(
    `<details><summary>RAW RESULT</summary><pre>${esc(JSON.stringify({ ...result, cycles: `${(result.cycles || []).length} cycles omitted` }, null, 2))}</pre></details>`,
  );
  return blocks.join("");
}

/* Hand-rolled canvas chart — a charting library would be the single heaviest
   dependency on this page, for two lines. */
function drawCurve(result) {
  const canvas = document.getElementById("curve");
  if (!canvas || !(result.curve || []).length) return;

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);

  const points = result.curve;
  const navs = points.map((p) => p.nav);
  const benches = points.map((p) => p.benchmark).filter((v) => v !== null && v !== undefined);
  const min = Math.min(...navs, ...benches);
  const max = Math.max(...navs, ...benches);
  const span = max - min || 1;
  const pad = 8;

  const x = (i) => (i / (points.length - 1 || 1)) * (width - pad * 2) + pad;
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);

  const line = (values, color, dash) => {
    ctx.beginPath();
    ctx.setLineDash(dash);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    values.forEach((v, i) => (i ? ctx.lineTo(x(i), y(v)) : ctx.moveTo(x(i), y(v))));
    ctx.stroke();
  };

  if (benches.length === points.length) line(benches, "#64748b", [4, 4]);
  line(navs, "#f59e0b", []);
}

/* ---- history ---------------------------------------------------------- */

async function loadHistory() {
  const body = document.getElementById("history-body");
  try {
    const [cycles, backtests] = await Promise.all([
      api("/history/cycles?limit=20"),
      api("/history/backtests?limit=20"),
    ]);

    const rows = [
      ...(cycles.cycles || []).map((c) => ({ ...c, kind: "cycle", when: c.created_at, span: c.as_of })),
      ...(backtests.backtests || []).map((b) => ({
        ...b,
        kind: "backtest",
        when: b.created_at,
        span: `${b.start} → ${b.end}`,
      })),
    ].sort((a, b) => String(b.when).localeCompare(String(a.when)));

    if (!rows.length) {
      body.innerHTML = `<div class="empty">No runs yet. Execute one from the RUN tab.</div>`;
      return;
    }

    body.innerHTML = `<div class="block"><table>
        <thead><tr><th>WHEN</th><th>KIND</th><th>ENGINE</th><th>FUND</th><th>PERIOD</th><th class="num">NAV</th><th>STATUS</th></tr></thead>
        <tbody>${rows
          .map(
            (r) => `<tr>
              <td>${esc(String(r.when).replace("T", " ").slice(0, 19))}</td>
              <td>${esc(r.kind)}</td>
              <td>${esc(r.engine)}</td>
              <td>${esc(r.fund)}</td>
              <td>${esc(r.span)}</td>
              <td class="num">${r.nav ? money(r.nav) : "—"}</td>
              <td class="${r.ok ? "pos" : "neg"}">${r.ok ? "ok" : "errored"}</td>
            </tr>`,
          )
          .join("")}</tbody>
      </table></div>`;
  } catch (err) {
    body.innerHTML = `<div class="block errors"><h2>UNAVAILABLE</h2><p>${esc(err.message)}</p></div>`;
  }
}

/* ---- wiring ----------------------------------------------------------- */

function switchView(name) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("is-active", t.dataset.view === name));
  document.querySelectorAll(".view").forEach((v) => v.classList.toggle("is-active", v.dataset.view === name));
  if (name === "history") loadHistory();
}

function init() {
  document.querySelectorAll(".tab").forEach((tab) =>
    tab.addEventListener("click", () => switchView(tab.dataset.view)),
  );

  document.getElementById("mode").addEventListener("change", (event) => {
    document.querySelector(".date-range").hidden = event.target.value !== "backtest";
  });

  document.getElementById("run-form").addEventListener("submit", execute);
  document.getElementById("refresh-history").addEventListener("click", loadHistory);

  // A two-year window ending at the pinned tape's rough end, so the default
  // backtest lands on data that exists rather than on an empty range.
  document.getElementById("end").value = "2026-06-30";
  document.getElementById("start").value = "2024-06-30";

  if (!token()) setAuthStatus(false);
  loadEngines();
}

document.addEventListener("DOMContentLoaded", init);
