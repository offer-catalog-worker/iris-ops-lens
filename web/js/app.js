(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = { summary: null, metrics: {}, alerts: [], rest: [], mock: false };

  const mockSummary = {
    product: "IRIS Community Edition · demo",
    namespace: "IRISOPS",
    user: "demo",
    job: "—",
    roles: "%Developer",
    readOnly: 1,
    security: { authenticated: true, secretsExposed: false }
  };

  const mockRest = [
    { name: "%Api.Mgmnt.v2", namespace: "%SYS", webApplications: "/api/mgmnt", swaggerSpec: "/api/mgmnt/v2/%25SYS/%Api.Mgmnt.v2" },
    { name: "%Api.Monitor", namespace: "%SYS", webApplications: "/api/monitor", swaggerSpec: "/api/monitor" },
    { name: "IRISOps.REST", namespace: "IRISOPS", webApplications: "/rest/irisops", swaggerSpec: "/rest/irisops" }
  ];

  const mockMetrics = { iris_cpu_percent: 21, iris_jobs: 6, iris_global_refs: 1842 };

  function esc(value) {
    return String(value == null ? "—" : value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(url, { headers: { Accept: "application/json, text/plain, */*" }, signal: controller.signal, credentials: "same-origin" });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async function json(url) {
    const response = await fetchWithTimeout(url);
    return response.json();
  }

  async function text(url) {
    const response = await fetchWithTimeout(url);
    return response.text();
  }

  function parseOpenMetrics(raw) {
    const result = {};
    String(raw || "").split(/\r?\n/).forEach((line) => {
      if (!line || line[0] === "#") return;
      const match = line.match(/^([a-zA-Z_:][\w:.]*)(?:\{[^}]*\})?\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/);
      if (!match) return;
      const key = match[1];
      const value = Number(match[2]);
      if (Number.isFinite(value) && result[key] === undefined) result[key] = value;
    });
    return result;
  }

  function pickMetric(names, fallback) {
    for (const name of names) if (state.metrics[name] !== undefined) return state.metrics[name];
    return fallback;
  }

  function formatNumber(value, suffix) {
    if (value === undefined || value === null || Number.isNaN(Number(value))) return "—";
    const number = Number(value);
    return `${number >= 1000 ? `${(number / 1000).toFixed(1)}k` : Math.round(number * 10) / 10}${suffix || ""}`;
  }

  function setNotice(message) {
    const notice = $("notice");
    notice.textContent = message || "";
    notice.classList.toggle("show", Boolean(message));
  }

  function renderSummary() {
    const summary = state.summary || mockSummary;
    const product = String(summary.product || "IRIS");
    $("instanceValue").textContent = summary.namespace || "IRIS";
    $("instanceSub").textContent = product.replace(/^InterSystems\s+/i, "").slice(0, 42);
    const cpu = pickMetric(["iris_cpu_percent", "iris_system_cpu_percent", "system_cpu_percent", "cpu_percent"], null);
    const jobs = pickMetric(["iris_jobs", "iris_processes", "process_count", "iris_process_count"], null);
    $("cpuValue").textContent = cpu === null ? "—" : formatNumber(cpu, "%");
    $("jobsValue").textContent = jobs === null ? "—" : formatNumber(jobs);
    $("alertsValue").textContent = formatNumber(state.alerts.length);
    $("alertSub").textContent = state.alerts.length ? "needs review" : "no active alerts reported";
    const pill = $("modePill");
    pill.textContent = state.mock ? "DEMO DATA" : "CONNECTED";
    pill.className = `pill ${state.mock ? "pill-warn" : "pill-ok"}`;
    const security = summary.security || {};
    $("securityBox").innerHTML = `<span class="security-icon">◉</span><div><strong>${security.authenticated ? "Authenticated IRIS session" : "Session not authenticated"}</strong><p>${security.secretsExposed ? "Review secret exposure policy." : "The cockpit does not render secrets."}</p></div>`;
  }

  function renderSignals() {
    const signals = [
      ["CPU utilization", pickMetric(["iris_cpu_percent", "iris_system_cpu_percent", "system_cpu_percent", "cpu_percent"], null), "%"],
      ["Process count", pickMetric(["iris_jobs", "iris_processes", "process_count", "iris_process_count"], null), ""],
      ["Global references", pickMetric(["iris_global_refs", "global_refs", "iris_global_references"], null), ""]
    ];
    $("signalList").innerHTML = signals.map(([label, value, suffix]) => `<div class="signal"><label>${label}</label><strong>${value === null ? "—" : esc(formatNumber(value, suffix))}</strong></div>`).join("");
  }

  function renderRest() {
    const list = Array.isArray(state.rest) ? state.rest : [];
    $("restCount").textContent = `${list.length} service${list.length === 1 ? "" : "s"}`;
    if (!list.length) {
      $("restList").innerHTML = `<div class="empty">No REST services were returned for this session.</div>`;
      return;
    }
    $("restList").innerHTML = list.slice(0, 12).map((service) => {
      const name = service.name || service.application || "Unnamed service";
      const namespace = service.namespace || service.ns || "—";
      const app = service.webApplications || service.webApplication || service.url || "management API";
      const spec = service.swaggerSpec || service.spec || "#";
      return `<div class="service-row"><div><div class="service-name">${esc(name)}</div><div class="service-meta">${esc(namespace)} · ${esc(app)}</div></div><a class="service-link" href="${esc(spec)}" target="_blank" rel="noreferrer">OpenAPI ↗</a></div>`;
    }).join("");
  }

  async function load() {
    setNotice("");
    state.mock = false;
    const results = await Promise.allSettled([
      json("/rest/irisops/summary"),
      text("/api/monitor/metrics"),
      json("/api/monitor/alerts"),
      json("/api/mgmnt/")
    ]);
    const [summary, metrics, alerts, rest] = results;
    if (summary.status === "fulfilled") state.summary = summary.value;
    else state.summary = mockSummary;
    state.metrics = metrics.status === "fulfilled" ? parseOpenMetrics(metrics.value) : mockMetrics;
    if (alerts.status === "fulfilled") {
      const value = alerts.value;
      state.alerts = Array.isArray(value) ? value : (Array.isArray(value.alerts) ? value.alerts : []);
    } else state.alerts = [];
    if (rest.status === "fulfilled") {
      const value = rest.value;
      state.rest = Array.isArray(value) ? value : (Array.isArray(value.services) ? value.services : []);
    } else state.rest = mockRest;
    state.mock = results.every((result) => result.status === "rejected");
    if (state.mock) setNotice("IRIS APIs are not reachable from this browser, so a clearly labelled demo snapshot is shown. Run inside IRIS to see live values.");
    renderSummary();
    renderSignals();
    renderRest();
    $("updatedAt").textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }

  $("refreshBtn").addEventListener("click", load);
  load();
}());
