const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "web", "js", "management.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "web", "index.html"), "utf8");
const ids = [
  "adminStatus", "tab-apps", "tab-security", "tab-tasks", "tab-system", "tab-events",
  "view-apps", "view-security", "view-tasks", "view-system", "view-events", "webAppsCount",
  "webAppsTable", "appActionStatus", "rolesCount", "rolesTable", "usersCount", "usersTable", "x509Count", "x509Table",
  "oauthCount", "oauthTable", "walletCollection",
  "secretsTable", "taskManagerStatus", "nativeTaskLink", "tasksCount", "tasksTable", "upcomingTable",
  "systemCount", "systemSummary", "resourcesTable", "processCount", "processesTable", "alertsLogCount",
  "taskHistoryTable", "databasesCount", "databasesTable", "devicesCount", "devicesTable",
  "alertsTable", "auditTable", "taskActionStatus", "nativeLogsLink", "nativeSecurityLink"
];

function makeElement(id, attributes = {}) {
  const listeners = {};
  const classes = new Set();
  return {
    id,
    textContent: "",
    innerHTML: "",
    className: "",
    href: "",
    value: "",
    hidden: false,
    listeners,
    attributes: { ...attributes },
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    addEventListener(name, fn) { listeners[name] = fn; },
    getAttribute(name) { return this.attributes[name] || null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; if (name === "href") this.href = ""; },
    focus() {}
  };
}

const tabViews = ["view-apps", "view-security", "view-tasks", "view-system", "view-events"];

async function runManagement({ pathname = "/iris-ops-lens/", responses = {}, initialState = null, confirm = () => true } = {}) {
  const elements = Object.fromEntries(ids.map((id) => [id, makeElement(id, id.startsWith("tab-") ? {
    "data-view": `view-${id.slice(4)}`
  } : {})]));
  const tabs = tabViews.map((view) => makeElement(`tab-${view.slice(5)}`, { "data-view": view }));
  const requests = [];
  const windowListeners = {};
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    const response = responses[url] || {};
    if (response.status && response.status !== 200 && response.status !== 202) {
      return { ok: false, status: response.status, json: async () => ({}) };
    }
    return { ok: true, status: response.status || 200, json: async () => response.body === undefined ? response : response.body };
  };
  const window = {
    location: { pathname, origin: "https://iris.example" },
    __IRIS_OPS_STATE__: initialState,
    confirm,
    addEventListener(name, fn) { windowListeners[name] = fn; }
  };
  const context = vm.createContext({
    document: {
      getElementById: (id) => elements[id],
      querySelectorAll: () => tabs
    },
    window,
    fetch,
    AbortController,
    URL,
    encodeURIComponent,
    setTimeout,
    clearTimeout,
    Promise,
    Array,
    Object,
    String,
    Number,
    Math
  });
  vm.runInContext(source, context, { filename: "management.js" });
  await new Promise(setImmediate);
  await new Promise(setImmediate);
  return { elements, requests, tabs, windowListeners };
}

function liveData() {
  return {
    "/api/admin/v2/web-apps?maxRows=100": { result: { WebApplicationList: [{ Name: "/safe", Namespace: "USER", Enabled: true, Type: "REST" }] } },
    "/api/admin/v2/security/roles?maxRows=100": { result: { RoleList: [{ Name: "%Operator", Description: "Operator", EscalationOnly: false }] } },
    "/api/admin/v2/security/users?maxRows=100": { result: { UserList: [{ Name: "<img src=x>", Enabled: true, Type: "CSP", Namespace: "USER" }] } },
    "/api/admin/v2/wallet/collections?maxRows=100": { result: { WalletCollectionList: [{ Name: "Ops secrets", EditResource: "%Admin_Wallet" }] } },
    "/api/admin/v2/security/x509-credentials?maxRows=100": { result: [{ Alias: "service-cert", HasPrivateKey: true, OwnerList: ["operator"], PeerNames: ["iris.example"], PrivateKey: "must-not-render" }] },
    "/api/admin/v2/security/oauth2/client/server-definitions?maxRows=100": { result: [{ ID: "issuer-1", IssuerEndpoint: "https://issuer.example", ClientCount: 2, ResourceCount: 1 }] },
    "/api/admin/v2/security/oauth2/server/clients?maxRows=100": { result: [{ Name: "portal", ClientId: "client-1", ClientType: "confidential", Description: "Portal client", ClientSecret: "must-not-render-either" }] },
    "/api/admin/v2/tasks?maxRows=100": { result: { ScheduledTaskList: [{ Id: 12, Name: "Rotate", Namespace: "USER", Suspended: false }] } },
    "/api/admin/v2/task/upcoming?maxRows=20": { result: { UpcomingTasks: [{ Name: "Rotate", Namespace: "USER", Datetime: "2030-01-01" }] } },
    "/api/admin/v2/task/history?maxRows=50": { result: [{ Name: "Rotate", Status: "Success", Completed: "2030-01-01 00:00:00", Namespace: "USER", TaskId: 7 }] },
    "/api/admin/v2/task/manager": { result: { Enabled: true } },
    "/api/admin/v2/monitor/dashboard/main": { result: { Status: { Status: "Running", Uptime: "2 days" }, SystemUsage: { Processes: 7, CSPSessions: 2 }, Performance: { GlobalRefs: 42 } } },
    "/api/admin/v2/monitor/dashboard/system-resources": { result: { ResourceList: [{ Name: "USER", Seize: 1, Nseize: 2 }] } },
    "/api/admin/v2/database-dirs?maxRows=100": { result: [{ Directory: "/iris/user", Size: 10, MaxSize: "Unlimited", Status: "Mounted/RW", Encrypted: false, Resource: "%DB_USER" }] },
    "/api/admin/v2/devices?maxRows=100": { result: [{ Name: "console", PhysicalDevice: "CON", Type: "TRM", SubType: "Terminal", Description: "Operator console" }] },
    "/api/admin/v2/security/audit/records?maxRows=50": { result: { GUID: "audit-finished", State: "Finished", Result: [{ TimeStamp: "2030-01-01 00:00:00", EventSource: "%System", EventType: "Security", Event: "Login", Username: "operator", Description: "Authenticated", EventData: "secret-audit-payload" }] } },
    "/api/admin/v2/processes?maxRows=100": { result: { ProcessList: [{ Job: 12, Username: "operator", State: "Runnable", Nspace: "USER" }] } }
  };
}

test("static preview is clearly demo and makes no administrative API requests", async () => {
  const { elements, requests } = await runManagement();
  assert.equal(requests.length, 0);
  assert.equal(elements.adminStatus.textContent, "DEMO DATA");
  assert.match(elements.webAppsTable.innerHTML, /\/irisops/);
  assert.equal(elements.nativeTaskLink.href, "");
  assert.equal(elements.nativeTaskLink.attributes["aria-disabled"], "true");
  assert.match(elements.alertsTable.innerHTML, /Illustrative alert/);
});

test("IRIS-hosted view requests inventories with the existing session and escapes data", async () => {
  const { elements, requests } = await runManagement({
    pathname: "/csp/irisops/index.html",
    responses: liveData(),
    initialState: { mode: "live", alerts: [] }
  });
  assert.equal(requests.length, 17);
  assert.equal(requests.find((entry) => entry.url.includes("/security/audit/records")).options.method, "POST");
  assert.equal(requests.every((entry) => entry.options.credentials === "same-origin"), true);
  assert.equal(requests.some((entry) => entry.url.includes("/task/run?") || entry.url.includes("/task/suspend?") || entry.url.includes("/task/resume?")), false);
  assert.equal(elements.adminStatus.textContent, "LIVE · IRIS APIs");
  assert.match(elements.webAppsTable.innerHTML, /\/safe/);
  assert.match(elements.webAppsTable.innerHTML, /data-app-action="toggle"/);
  assert.match(elements.webAppsTable.innerHTML, />Disable</);
  assert.match(elements.usersTable.innerHTML, /&lt;img src=x&gt;/);
  assert.doesNotMatch(elements.usersTable.innerHTML, /<img src=x>/);
  assert.equal(elements.nativeTaskLink.href, "/csp/sys/op/TaskManager.csp");
  assert.match(elements.systemSummary.innerHTML, /2 days/);
  assert.match(elements.x509Table.innerHTML, /service-cert/);
  assert.doesNotMatch(elements.x509Table.innerHTML, /must-not-render/);
  assert.match(elements.oauthTable.innerHTML, /issuer-1/);
  assert.match(elements.oauthTable.innerHTML, /client-1/);
  assert.doesNotMatch(elements.oauthTable.innerHTML, /must-not-render/);
  assert.match(elements.databasesTable.innerHTML, /\/iris\/user/);
  assert.match(elements.devicesTable.innerHTML, /Operator console/);
  assert.match(elements.taskHistoryTable.innerHTML, /Success/);
  assert.match(elements.tasksTable.innerHTML, /data-task-action="run"/);
  assert.match(elements.tasksTable.innerHTML, /data-task-action="suspend"/);
  assert.match(elements.auditTable.innerHTML, /Authenticated/);
  assert.doesNotMatch(elements.auditTable.innerHTML, /secret-audit-payload/);
  assert.match(elements.alertsTable.innerHTML, /No records were returned/);
});

test("web-app toggle requires confirmation and changes only the Enabled field after a fresh GET", async () => {
  const responses = {
    ...liveData(),
    "/api/admin/v2/web-app?name=%2Fsafe": { result: { Path: "/safe", NameSpace: "USER", Enabled: true, Type: 1, DispatchClass: "Example.REST" } }
  };
  const { elements, requests } = await runManagement({ pathname: "/csp/irisops/", responses });
  const button = { dataset: { appAction: "toggle", appName: "/safe", currentEnabled: "true" }, disabled: false };
  await elements.webAppsTable.listeners.click({ target: { closest: () => button } });
  const detail = requests.find((entry) => entry.url === "/api/admin/v2/web-app?name=%2Fsafe");
  const update = requests.find((entry) => entry.url === "/api/admin/v2/web-app?name=%2Fsafe" && entry.options.method === "PUT");
  assert.ok(detail);
  assert.equal(detail.options.method, "GET");
  assert.ok(update);
  const application = JSON.parse(update.options.body);
  assert.equal(application.Path, "/safe");
  assert.equal(application.Enabled, false);
  assert.equal(application.DispatchClass, "Example.REST");
  assert.match(elements.appActionStatus.textContent, /Application inventory refreshed/);
});

test("web-app toggle sends no update when IRIS refuses the definition read", async () => {
  const responses = {
    ...liveData(),
    "/api/admin/v2/web-app?name=%2Fsafe": { status: 403 }
  };
  const { elements, requests } = await runManagement({ pathname: "/csp/irisops/", responses });
  const button = { dataset: { appAction: "toggle", appName: "/safe", currentEnabled: "true" }, disabled: false };
  await elements.webAppsTable.listeners.click({ target: { closest: () => button } });
  assert.equal(requests.some((entry) => entry.url === "/api/admin/v2/web-app?name=%2Fsafe" && entry.options.method === "PUT"), false);
  assert.match(elements.appActionStatus.textContent, /denied access/);
});

test("canceling web-app confirmation sends no administrative write or detail fetch", async () => {
  const { elements, requests } = await runManagement({
    pathname: "/csp/irisops/",
    responses: liveData(),
    confirm: () => false
  });
  const button = { dataset: { appAction: "toggle", appName: "/safe", currentEnabled: "true" }, disabled: false };
  await elements.webAppsTable.listeners.click({ target: { closest: () => button } });
  assert.equal(requests.some((entry) => entry.url.includes("/api/admin/v2/web-app?name=")), false);
  assert.equal(requests.some((entry) => entry.url === "/api/admin/v2/web-app?name=%2Fsafe" && entry.options.method === "PUT"), false);
});

test("task controls are inert until confirmed and then use the documented same-origin action API", async () => {
  const { elements, requests } = await runManagement({
    pathname: "/csp/irisops/index.html",
    responses: liveData(),
    initialState: { mode: "live", alerts: [] }
  });
  const runButton = {
    dataset: { taskAction: "run", taskId: "12", taskName: "Rotate" },
    disabled: false
  };
  await elements.tasksTable.listeners.click({ target: { closest: () => runButton } });
  const action = requests.find((entry) => entry.url === "/api/admin/v2/task/run?id=12");
  assert.ok(action);
  assert.equal(action.options.method, "POST");
  assert.equal(action.options.credentials, "same-origin");
  assert.deepEqual(JSON.parse(action.options.body), { RunNow: true });
  assert.match(elements.taskActionStatus.textContent, /Task inventory refreshed/);
});

test("audit record query polls its own async task and renders only approved metadata", async () => {
  const responses = {
    ...liveData(),
    "/api/admin/v2/security/audit/records?maxRows=50": { status: 202, body: { result: { GUID: "audit-123", State: "Queued" } } },
    "/api/admin/v2/async-result?id=audit-123": { result: { GUID: "audit-123", State: "Finished", Result: [{ TimeStamp: "2030-01-01", Event: "PasswordChange", Username: "operator", Description: "Changed credentials", Roles: "secret-role-data" }] } }
  };
  const { elements, requests } = await runManagement({ pathname: "/csp/irisops/", responses });
  await new Promise((resolve) => setTimeout(resolve, 350));
  assert.ok(requests.some((entry) => entry.url === "/api/admin/v2/async-result?id=audit-123"));
  assert.match(elements.auditTable.innerHTML, /PasswordChange/);
  assert.match(elements.auditTable.innerHTML, /Changed credentials/);
  assert.doesNotMatch(elements.auditTable.innerHTML, /secret-role-data/);
});

test("wallet renders metadata only and encodes the collection before requesting secrets", async () => {
  const responses = {
    ...liveData(),
    "/api/admin/v2/wallet/secrets?collection=Ops%20%26%20secrets&maxRows=100": {
      result: { WalletSecretList: [{ Name: "PAYMENT_TOKEN", Type: "Environment", Value: "never-render-this" }] }
    }
  };
  const { elements, requests } = await runManagement({ pathname: "/csp/irisops/", responses });
  const select = elements.walletCollection;
  select.value = "Ops & secrets";
  await select.listeners.change();
  const secretRequest = requests.find((entry) => entry.url.includes("/wallet/secrets?"));
  assert.ok(secretRequest);
  assert.match(secretRequest.url, /collection=Ops%20%26%20secrets/);
  assert.match(elements.secretsTable.innerHTML, /PAYMENT_TOKEN/);
  assert.match(elements.secretsTable.innerHTML, /Environment/);
  assert.doesNotMatch(elements.secretsTable.innerHTML, /never-render-this/);
});

test("permission failures remain visible instead of being shown as empty or live data", async () => {
  const responses = liveData();
  responses["/api/admin/v2/security/users?maxRows=100"] = { status: 403 };
  const { elements } = await runManagement({ pathname: "/csp/irisops/", responses });
  assert.equal(elements.adminStatus.textContent, "PARTIAL ACCESS");
  assert.match(elements.adminStatus.className, /source-pending/);
  assert.equal(elements.usersCount.textContent, "Permission required");
  assert.match(elements.usersTable.innerHTML, /does not have permission/);
});

test("unrecognized JSON shapes are unavailable, not counted as live inventory", async () => {
  const responses = liveData();
  responses["/api/admin/v2/security/users?maxRows=100"] = { result: { Unexpected: [] } };
  const { elements } = await runManagement({ pathname: "/csp/irisops/", responses });
  assert.equal(elements.adminStatus.textContent, "PARTIAL ACCESS");
  assert.equal(elements.usersCount.textContent, "Unavailable");
  assert.match(elements.usersTable.innerHTML, /endpoint is unavailable/);
});

test("management script targets exist in the HTML", () => {
  for (const match of source.matchAll(/\$\("([^"]+)"\)/g)) {
    assert.match(html, new RegExp(`\\bid=["']${match[1]}["']`), `Missing HTML element id=${match[1]}`);
  }
});
