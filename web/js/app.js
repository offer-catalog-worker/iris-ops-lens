(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const state = {
    summary: null,
    metrics: {},
    alerts: null,
    rest: null,
    sources: {},
    mode: "connecting",
    requestId: 0
  };

  const sourceLabels = {
    summary: "server snapshot",
    metrics: "monitor metrics",
    alerts: "monitor alerts",
    rest: "REST inventory"
  };
  const nativeLinks = [
    { id: "rawMetricsLink", path: "/api/monitor/metrics", enabled: "Open raw metrics →", disabled: "IRIS only · raw metrics" },
    { id: "securityPortalLink", path: "/csp/sys/sec/", enabled: "Open security portal →", disabled: "IRIS only · security portal" },
    { id: "taskManagerLink", path: "/csp/sys/op/TaskManager.csp", enabled: "Open Task Manager", disabled: "IRIS only · Task Manager" }
  ];

  const demoSummary = {
    product: "IRIS Community Edition · sample",
    namespace: "IRISOPS"
  };
  const demoRest = [
    { name: "%Api.Mgmnt.v2", namespace: "%SYS", webApplications: "/api/mgmnt", swaggerSpec: "/api/mgmnt/v2/%25SYS/%Api.Mgmnt.v2" },
    { name: "%Api.Monitor", namespace: "%SYS", webApplications: "/api/monitor", swaggerSpec: "/api/monitor" },
    { name: "IRISOps.REST", namespace: "IRISOPS", webApplications: "/rest/irisops", swaggerSpec: "/rest/irisops" }
  ];
  const demoMetrics = { iris_cpu_percent: 21, iris_jobs: 6, iris_global_refs: 1842 };

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function boundedText(value, limit) {
    return typeof value === "string" ? value.trim().slice(0, limit) : "";
  }

  function esc(value) {
    return String(value == null ? "—" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  async function fetchWithTimeout(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json, text/plain, */*" },
        signal: controller.signal,
        credentials: "same-origin"
      });
      if (!response.ok) throw new Error("HTTP response was not successful");
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async function json(url) {
    return (await fetchWithTimeout(url)).json();
  }

  async function text(url) {
    return (await fetchWithTimeout(url)).text();
  }

  function normalizeSummary(value) {
    if (!isRecord(value)) throw new Error("Invalid summary response");
    const product = boundedText(value.product, 100);
    const namespace = boundedText(value.namespace, 64);
    if (!product || !namespace) throw new Error("Incomplete summary response");
    const rawSecurity = isRecord(value.security) ? value.security : null;
    const booleanOrUnknown = (flag) => typeof flag === "boolean" ? flag : null;
    return {
      product,
      namespace,
      security: rawSecurity ? {
        authenticated: booleanOrUnknown(rawSecurity.authenticated),
        secretsExposed: booleanOrUnknown(rawSecurity.secretsExposed)
      } : null
    };
  }

  function normalizeAlerts(value) {
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.alerts)) return value.alerts;
    throw new Error("Invalid alerts response");
  }

  function normalizeRest(value) {
    if (Array.isArray(value)) return value;
    if (isRecord(value) && Array.isArray(value.services)) return value.services;
    throw new Error("Invalid REST inventory response");
  }

  function parseOpenMetrics(raw) {
    const result = {};
    String(raw || "").split(/\r?\n/).forEach((line) => {
      if (!line || line[0] === "#") return;
      const match = line.match(/^([a-zA-Z_:][\w:.]*)(?:\{[^}]*\})?\s+([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)(?:\s+\d+)?\s*$/);
      if (!match) return;
      const value = Number(match[2]);
      if (Number.isFinite(value) && result[match[1]] === undefined) result[match[1]] = value;
    });
    return result;
  }

  function pickMetric(names) {
    for (const name of names) {
      if (Number.isFinite(state.metrics[name])) return state.metrics[name];
    }
    return null;
  }

  function formatNumber(value, suffix) {
    if (value === null || value === undefined || value === "") return "—";
    const number = Number(value);
    if (!Number.isFinite(number)) return "—";
    return `${Math.abs(number) >= 1000 ? `${(number / 1000).toFixed(1)}k` : Math.round(number * 10) / 10}${suffix || ""}`;
  }

  function setNotice(message) {
    const notice = $("notice");
    notice.textContent = message || "";
    notice.classList.toggle("show", Boolean(message));
  }

  function setModePill() {
    const labels = {
      connecting: ["CONNECTING", "pill-warn"],
      live: ["LIVE DATA", "pill-ok"],
      partial: ["PARTIAL DATA", "pill-warn"],
      demo: ["DEMO DATA", "pill-warn"]
    };
    const [label, className] = labels[state.mode] || labels.connecting;
    const pill = $("modePill");
    pill.textContent = label;
    pill.className = `pill ${className}`;
  }

  function setNativeLinks(enabled) {
    for (const item of nativeLinks) {
      const link = $(item.id);
      if (enabled) {
        link.href = item.path;
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
      link.textContent = enabled ? item.enabled : item.disabled;
    }
  }

  function renderSummary() {
    const summary = state.summary;
    const demo = state.mode === "demo";
    $("instanceValue").textContent = summary ? summary.namespace : (demo ? demoSummary.namespace : "Unavailable");
    $("instanceSub").textContent = summary ? summary.product : (demo ? "Sample only · not live" : "Server snapshot unavailable");

    const cpu = pickMetric(["iris_cpu_percent", "iris_system_cpu_percent", "system_cpu_percent", "cpu_percent"]);
    const jobs = pickMetric(["iris_jobs", "iris_processes", "process_count", "iris_process_count"]);
    $("cpuValue").textContent = formatNumber(cpu, cpu === null ? "" : "%");
    $("jobsValue").textContent = formatNumber(jobs);
    const metricsReachable = state.sources.metrics && state.sources.metrics.status === "ok";
    const metricCopy = (value) => demo
      ? "Sample only · not live"
      : (!metricsReachable ? "Monitor metrics unavailable" : (value === null ? "Not exposed by this IRIS version" : "From IRIS monitor API"));
    $("cpuSub").textContent = metricCopy(cpu);
    $("jobsSub").textContent = metricCopy(jobs);

    const alertsAvailable = state.alerts !== null;
    $("alertsValue").textContent = alertsAvailable ? formatNumber(state.alerts.length) : "—";
    $("alertSub").textContent = demo
      ? "sample only · not live"
      : (!alertsAvailable ? "monitor alerts unavailable" : (state.alerts.length ? "active alerts returned" : "0 active alerts returned"));

    const security = summary && summary.security;
    const authText = demo
      ? "Demo only · session not checked"
      : (!security || security.authenticated === null
        ? "Session status unavailable"
        : (security.authenticated ? "Authenticated IRIS session" : "No authenticated session reported"));
    const exposureText = demo
      ? "No live IRIS security state was available to verify."
      : (!security || security.secretsExposed === null
        ? "Secret exposure status unavailable; verify the API configuration."
        : (security.secretsExposed
          ? "The API reports secret exposure; review before proceeding."
          : "The API reports no secret exposure; the cockpit does not request or render secrets."));
    $("securityBox").innerHTML = `<span class="security-icon">◉</span><div><strong>${esc(authText)}</strong><p>${esc(exposureText)}</p></div>`;
  }

  function renderSignals() {
    const demo = state.mode === "demo";
    const metricsReachable = state.sources.metrics && state.sources.metrics.status === "ok";
    const signals = [
      ["CPU utilization", pickMetric(["iris_cpu_percent", "iris_system_cpu_percent", "system_cpu_percent", "cpu_percent"]), "%"],
      ["Process count", pickMetric(["iris_jobs", "iris_processes", "process_count", "iris_process_count"]), ""],
      ["Global references", pickMetric(["iris_global_refs", "global_refs", "iris_global_references"]), ""]
    ];
    if (demo) state.metrics = demoMetrics;
    $("signalList").innerHTML = signals.map(([label, value, suffix]) => {
      const current = demo ? pickDemoMetric(label) : value;
      return `<div class="signal"><label>${esc(label)}</label><strong>${current === null ? "—" : esc(formatNumber(current, suffix))}</strong></div>`;
    }).join("");
    const status = $("metricsStatus");
    status.textContent = demo ? "DEMO" : (metricsReachable ? "LIVE" : "UNAVAILABLE");
    status.className = `source-badge ${demo ? "source-demo" : (metricsReachable ? "source-live" : "source-unavailable")}`;
    const sourceCopy = $("metricsSource");
    sourceCopy.textContent = demo ? "Sample values · not live" : (metricsReachable ? "IRIS monitor metrics" : "Monitor metrics unavailable");
  }

  function pickDemoMetric(label) {
    if (label === "CPU utilization") return demoMetrics.iris_cpu_percent;
    if (label === "Process count") return demoMetrics.iris_jobs;
    return demoMetrics.iris_global_refs;
  }

  function safeSpecPath(candidate) {
    if (typeof candidate !== "string" || !candidate.trim()) return null;
    try {
      const url = new URL(candidate, window.location.origin);
      if (url.origin !== window.location.origin) return null;
      if (!/^\/(?:api\/mgmnt(?:\/|$)|api\/monitor(?:\/|$)|rest\/irisops(?:\/|$))/.test(url.pathname)) return null;
      return url.pathname;
    } catch (_) {
      return null;
    }
  }

  function renderRest() {
    const list = Array.isArray(state.rest) ? state.rest : (state.mode === "demo" ? demoRest : null);
    if (list === null) {
      $("restCount").textContent = "Unavailable";
      $("restSource").textContent = "REST inventory could not be verified for this session.";
      $("restList").innerHTML = `<div class="empty">The management API did not return a usable service inventory.</div>`;
      return;
    }
    $("restCount").textContent = `${list.length} service${list.length === 1 ? "" : "s"}${state.mode === "demo" ? " · demo" : ""}`;
    $("restSource").textContent = state.mode === "demo" ? "Sample catalog · not live" : "Live inventory from /api/mgmnt/";
    if (!list.length) {
      $("restList").innerHTML = `<div class="empty">No REST services were returned for this session.</div>`;
      return;
    }
    $("restList").innerHTML = list.slice(0, 12).map((service) => {
      const row = isRecord(service) ? service : {};
      const name = boundedText(row.name || row.application, 120) || "Unnamed service";
      const namespace = boundedText(row.namespace || row.ns, 64) || "—";
      const app = boundedText(row.webApplications || row.webApplication || row.url, 160) || "management API";
      const spec = state.mode === "demo" ? null : safeSpecPath(row.swaggerSpec || row.spec);
      const link = spec
        ? `<a class="service-link" href="${esc(spec)}" target="_blank" rel="noopener noreferrer">OpenAPI ↗</a>`
        : `<span class="service-link service-link-disabled" aria-disabled="true">${state.mode === "demo" ? "Available inside IRIS" : "OpenAPI unavailable"}</span>`;
      return `<div class="service-row"><div><div class="service-name">${esc(name)}</div><div class="service-meta">${esc(namespace)} · ${esc(app)}</div></div>${link}</div>`;
    }).join("");
  }

  function summarizeUnavailableSources() {
    return Object.keys(state.sources)
      .filter((name) => state.sources[name].status !== "ok")
      .map((name) => sourceLabels[name]);
  }

  async function load() {
    const requestId = ++state.requestId;
    const refreshButton = $("refreshBtn");
    refreshButton.disabled = true;
    state.mode = "connecting";
    setModePill();
    setNativeLinks(false);
    setNotice("");
    try {
      const results = await Promise.allSettled([
        json("/rest/irisops/summary"),
        text("/api/monitor/metrics"),
        json("/api/monitor/alerts"),
        json("/api/mgmnt/")
      ]);
      if (requestId !== state.requestId) return;

      const [summary, metrics, alerts, rest] = results;
      const reachableCount = results.filter((result) => result.status === "fulfilled").length;
      state.sources = {
        summary: { status: "unavailable" },
        metrics: { status: "unavailable" },
        alerts: { status: "unavailable" },
        rest: { status: "unavailable" }
      };

      try {
        if (summary.status === "fulfilled") {
          state.summary = normalizeSummary(summary.value);
          state.sources.summary.status = "ok";
        } else state.summary = null;
      } catch (_) { state.summary = null; state.sources.summary.status = "invalid"; }

      if (metrics.status === "fulfilled") {
        state.metrics = parseOpenMetrics(metrics.value);
        state.sources.metrics.status = "ok";
      } else state.metrics = {};

      try {
        if (alerts.status === "fulfilled") {
          state.alerts = normalizeAlerts(alerts.value);
          state.sources.alerts.status = "ok";
        } else state.alerts = null;
      } catch (_) { state.alerts = null; state.sources.alerts.status = "invalid"; }

      try {
        if (rest.status === "fulfilled") {
          state.rest = normalizeRest(rest.value);
          state.sources.rest.status = "ok";
        } else state.rest = null;
      } catch (_) { state.rest = null; state.sources.rest.status = "invalid"; }

      if (reachableCount === 0) {
        state.mode = "demo";
        state.summary = demoSummary;
        state.metrics = demoMetrics;
        state.alerts = [];
        state.rest = demoRest;
      } else {
        state.mode = Object.values(state.sources).every((source) => source.status === "ok") ? "live" : "partial";
      }

      setModePill();
      setNativeLinks(state.mode !== "demo");
      if (state.mode === "demo") {
        setNotice("No live IRIS endpoint responded. Sample data is shown for exploration only; it is not instance telemetry.");
      } else if (state.mode === "partial") {
        const missing = summarizeUnavailableSources();
        setNotice(`Partial connection. Unavailable or invalid: ${missing.join(", ")}. Missing sources are not replaced with sample data.`);
      }
      renderSummary();
      renderSignals();
      renderRest();
      $("updatedAt").textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch (_) {
      if (requestId !== state.requestId) return;
      state.mode = "partial";
      state.summary = null;
      state.metrics = {};
      state.alerts = null;
      state.rest = null;
      state.sources = {
        summary: { status: "unavailable" }, metrics: { status: "unavailable" },
        alerts: { status: "unavailable" }, rest: { status: "unavailable" }
      };
      setModePill();
      setNativeLinks(false);
      setNotice("The dashboard could not finish loading. No sample values were substituted for an incomplete response.");
      renderSummary();
      renderSignals();
      renderRest();
    } finally {
      if (requestId === state.requestId) refreshButton.disabled = false;
    }
  }

  $("refreshBtn").addEventListener("click", load);
  load();
}());
