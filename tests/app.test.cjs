const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "web", "js", "app.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(__dirname, "..", "web", "index.html"), "utf8");
const restSource = fs.readFileSync(path.join(__dirname, "..", "src", "cls", "IRISOps", "REST.cls"), "utf8");
const installerScript = fs.readFileSync(path.join(__dirname, "..", "iris.script"), "utf8");
const moduleManifest = fs.readFileSync(path.join(__dirname, "..", "module.xml"), "utf8");
const ids = [
  "modePill", "refreshBtn", "notice", "instanceValue", "instanceSub", "cpuValue", "cpuSub",
  "jobsValue", "jobsSub", "alertsValue", "alertSub", "securityBox", "signalList",
  "metricsStatus", "metricsSource", "restCount", "restSource", "restList", "updatedAt",
  "rawMetricsLink", "securityPortalLink", "taskManagerLink"
];

function element(id) {
  const classes = new Set();
  const listeners = {};
  return {
    id,
    textContent: "",
    innerHTML: "",
    className: "",
    disabled: false,
    href: "",
    attributes: {},
    listeners,
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains(name) { return classes.has(name); }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) {
      delete this.attributes[name];
      if (name === "href") this.href = "";
    },
    addEventListener(name, handler) { listeners[name] = handler; }
  };
}

async function startApp(responses) {
  const elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
  const requests = [];
  const fetch = async (url) => {
    requests.push(url);
    const response = responses[url];
    if (response instanceof Error) throw response;
    if (response && response.__httpStatus) {
      return { ok: false, status: response.__httpStatus, json: async () => ({}), text: async () => "" };
    }
    if (response && response.__invalidJson) {
      return { ok: true, status: 200, json: async () => { throw new SyntaxError("invalid JSON"); }, text: async () => "" };
    }
    return {
      ok: true,
      status: 200,
      json: async () => response,
      text: async () => response
    };
  };
  const context = vm.createContext({
    document: { getElementById: (id) => elements[id] },
    window: { location: { origin: "https://iris.example" } },
    fetch,
    AbortController,
    URL,
    setTimeout,
    clearTimeout,
    Date,
    Number,
    Math,
    String,
    Object,
    Array,
    Boolean,
    Promise
  });
  vm.runInContext(source, context, { filename: "app.js" });
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  return { elements, requests };
}

function liveResponses(overrides = {}) {
  return {
    "/rest/irisops/summary": {
      product: "InterSystems IRIS Community Edition",
      namespace: "USER",
      security: { authenticated: true, secretsExposed: false }
    },
    "/api/monitor/metrics": "# HELP iris_cpu_percent CPU\niris_cpu_percent 23.25\niris_jobs 0\niris_global_refs 1234 1726351234\n",
    "/api/monitor/alerts": { alerts: [] },
    "/api/mgmnt/": { services: [{
      name: "%Api.Mgmnt.v2", namespace: "%SYS", webApplications: "/api/mgmnt",
      swaggerSpec: "/api/mgmnt/v2/%25SYS/%Api.Mgmnt.v2"
    }] },
    ...overrides
  };
}

test("keeps JavaScript-to-HTML targets in sync and avoids sensitive server fields", () => {
  const referencedIds = [...source.matchAll(/\$\("([^"]+)"\)/g)].map((match) => match[1]);
  for (const id of new Set(referencedIds)) {
    assert.match(htmlSource, new RegExp(`\\bid=["']${id}["']`), `Missing HTML element with id=${id}`);
  }
  for (const id of ["rawMetricsLink", "securityPortalLink", "taskManagerLink"]) {
    assert.doesNotMatch(htmlSource.match(new RegExp(`<a\\b[^>]*id="${id}"[^>]*>`))[0], /\bhref=/i);
  }
  assert.match(restSource, /\$S\(\$USERNAME'="":1,1:0\)/);
  assert.match(restSource, /%Set\("readOnly",\s*1,\s*"boolean"\)/);
  assert.match(restSource, /%Set\("authenticated",\s*\$S\(\$USERNAME'="":1,1:0\),\s*"boolean"\)/);
  assert.match(restSource, /%Set\("secretsExposed",\s*0,\s*"boolean"\)/);
  assert.doesNotMatch(restSource, /Method="(?:POST|PUT|DELETE|PATCH)"/i);
  assert.doesNotMatch(restSource, /result\.%Set\("(?:user|job|roles|horolog|password|token|secret)/i);
  assert.doesNotMatch(installerScript, /UnExpireUserPasswords/i);
  assert.match(installerScript, /If 'sc Write \$SYSTEM\.Status\.GetErrorText\(sc\), ! Halt 1/);
  assert.doesNotMatch(installerScript, /\$\$\$ISERR/i);
  assert.match(installerScript, /Set version = "0\.10\.9"/);
  assert.match(installerScript, /Set request\.Https = 1/);
  assert.match(installerScript, /Set sc = request\.Get\("\/packages\/zpm\//);
  assert.match(installerScript, /\$SYSTEM\.OBJ\.LoadStream\(request\.HttpResponse\.Data, "c"\)/);
  assert.doesNotMatch(installerScript, /zpm .*":1:1/i);
  const namespacePosition = installerScript.indexOf('zn "IRISOPS"');
  const versionPosition = installerScript.indexOf('Set version = "0.10.9"');
  const installIPMPosition = installerScript.indexOf('$SYSTEM.OBJ.LoadStream');
  const loadModulePosition = installerScript.indexOf('zpm "load ');
  assert.ok(
    namespacePosition >= 0 && versionPosition > namespacePosition &&
    installIPMPosition > versionPosition && loadModulePosition > installIPMPosition,
    "IPM must be bootstrapped in the target namespace before loading the module"
  );
  assert.match(moduleManifest, /Directory="\{\$cspdir\}\/irisops"[^>]*Path="\/web"/);
  assert.doesNotMatch(moduleManifest, /SourcePath=/i);
});

test("shows live data without substituting sample values", async () => {
  const { elements, requests } = await startApp(liveResponses());
  assert.equal(elements.modePill.textContent, "LIVE DATA");
  assert.equal(elements.instanceValue.textContent, "USER");
  assert.equal(elements.cpuValue.textContent, "23.3%");
  assert.equal(elements.jobsValue.textContent, "0");
  assert.equal(elements.alertsValue.textContent, "0");
  assert.equal(elements.metricsStatus.textContent, "LIVE");
  assert.equal(elements.taskManagerLink.href, "/csp/sys/op/TaskManager.csp");
  assert.equal(elements.taskManagerLink.attributes["aria-disabled"], undefined);
  assert.match(elements.restList.innerHTML, /href="\/api\/mgmnt\/v2/);
  assert.equal(requests.length, 4);
});

test("marks partial connections and never fills failed sources with demo values", async () => {
  const responses = liveResponses({
    "/rest/irisops/summary": new Error("offline"),
    "/api/monitor/alerts": new Error("offline"),
    "/api/mgmnt/": { services: [{
      name: "<img src=x onerror=alert(1)>", namespace: "%SYS", webApplications: "/api/mgmnt",
      swaggerSpec: "javascript:alert(1)"
    }] }
  });
  const { elements } = await startApp(responses);
  assert.equal(elements.modePill.textContent, "PARTIAL DATA");
  assert.equal(elements.instanceValue.textContent, "Unavailable");
  assert.equal(elements.cpuValue.textContent, "23.3%");
  assert.equal(elements.jobsValue.textContent, "0");
  assert.equal(elements.alertsValue.textContent, "—");
  assert.equal(elements.restCount.textContent, "1 service");
  assert.match(elements.notice.textContent, /not replaced with sample data/);
  assert.match(elements.restList.innerHTML, /&lt;img/);
  assert.doesNotMatch(elements.restList.innerHTML, /<img|href="javascript:/i);
  assert.match(elements.restList.innerHTML, /OpenAPI unavailable/);
  assert.equal(elements.rawMetricsLink.href, "/api/monitor/metrics");
});

test("uses clearly labelled demo data only when no endpoint responds", async () => {
  const responses = Object.fromEntries([
    "/rest/irisops/summary", "/api/monitor/metrics", "/api/monitor/alerts", "/api/mgmnt/"
  ].map((url) => [url, new Error("offline")]));
  const { elements } = await startApp(responses);
  assert.equal(elements.modePill.textContent, "DEMO DATA");
  assert.equal(elements.instanceValue.textContent, "IRISOPS");
  assert.equal(elements.cpuValue.textContent, "21%");
  assert.equal(elements.jobsValue.textContent, "6");
  assert.equal(elements.alertsValue.textContent, "0");
  assert.equal(elements.metricsStatus.textContent, "DEMO");
  assert.match(elements.notice.textContent, /Sample data is shown for exploration only/);
  assert.match(elements.restCount.textContent, /demo/);
  assert.match(elements.securityBox.innerHTML, /Demo only · session not checked/);
  assert.match(elements.securityBox.innerHTML, /No live IRIS security state was available to verify/);
  assert.doesNotMatch(elements.securityBox.innerHTML, /Authenticated IRIS session|reports no secret exposure/);
  assert.equal(elements.taskManagerLink.href, "");
  assert.equal(elements.taskManagerLink.attributes["aria-disabled"], "true");
  assert.match(elements.taskManagerLink.textContent, /IRIS only/);
  assert.doesNotMatch(elements.restList.innerHTML, /<a\b/);
  assert.match(elements.restList.innerHTML, /Available inside IRIS/);
});

test("rejects cross-origin OpenAPI links and treats non-boolean security flags as unknown", async () => {
  const { elements } = await startApp(liveResponses({
    "/rest/irisops/summary": {
      product: "IRIS", namespace: "USER",
      security: { authenticated: "false", secretsExposed: "true" }
    },
    "/api/mgmnt/": { services: [{
      name: "Remote", namespace: "%SYS", webApplications: "/api/mgmnt",
      swaggerSpec: "https://evil.example/api/mgmnt/openapi.json"
    }] }
  }));
  assert.equal(elements.modePill.textContent, "LIVE DATA");
  assert.doesNotMatch(elements.securityBox.innerHTML, /Authenticated IRIS session|secret exposure/);
  assert.doesNotMatch(elements.restList.innerHTML, /href="https:\/\/evil\.example/);
  assert.match(elements.restList.innerHTML, /OpenAPI unavailable/);
});

test("does not turn unknown security flags into reassuring false values", async () => {
  const { elements } = await startApp(liveResponses({
    "/rest/irisops/summary": {
      product: "IRIS", namespace: "USER",
      security: { authenticated: "false", secretsExposed: "false" }
    }
  }));
  assert.match(elements.securityBox.innerHTML, /Session status unavailable/);
  assert.match(elements.securityBox.innerHTML, /Secret exposure status unavailable/);
  assert.doesNotMatch(elements.securityBox.innerHTML, /No authenticated session reported|reports no secret exposure/);
});

test("treats successful HTTP responses with malformed JSON as partial, not live", async () => {
  const { elements } = await startApp(liveResponses({
    "/rest/irisops/summary": { __invalidJson: true },
    "/api/monitor/alerts": { __httpStatus: 502 }
  }));
  assert.equal(elements.modePill.textContent, "PARTIAL DATA");
  assert.equal(elements.instanceValue.textContent, "Unavailable");
  assert.equal(elements.alertsValue.textContent, "—");
  assert.match(elements.notice.textContent, /Unavailable or invalid/);
});

test("rejects hostile OpenAPI targets and strips untrusted query parameters", async () => {
  const candidates = [
    "//evil.example/api/mgmnt/spec.json",
    "/api/mgmnt/../../evil/spec.json",
    "/api/mgmnt/spec.json?next=https://evil.example"
  ];
  const { elements } = await startApp(liveResponses({
    "/api/mgmnt/": { services: candidates.map((swaggerSpec, index) => ({
      name: `Service ${index + 1}`, namespace: "%SYS", swaggerSpec
    })) }
  }));
  assert.equal((elements.restList.innerHTML.match(/OpenAPI unavailable/g) || []).length, 2);
  assert.match(elements.restList.innerHTML, /href="\/api\/mgmnt\/spec\.json"/);
  assert.doesNotMatch(elements.restList.innerHTML, /href="\/api\/mgmnt\/spec\.json\?/);
});

test("renders missing metrics as unavailable instead of fabricated zeroes", async () => {
  const { elements } = await startApp(liveResponses({
    "/api/monitor/metrics": "# no supported metrics are exposed\n"
  }));
  assert.equal(elements.modePill.textContent, "LIVE DATA");
  assert.equal(elements.cpuValue.textContent, "—");
  assert.equal(elements.jobsValue.textContent, "—");
  assert.match(elements.cpuSub.textContent, /Not exposed by this IRIS version/);
});
