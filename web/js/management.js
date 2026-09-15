(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const isIrisHost = /^\/csp\/irisops(?:\/|$)/i.test(window.location.pathname || "");
  const apiRoot = "/api/admin/v2";
  const tabs = Array.from(document.querySelectorAll("[role='tab'][data-view]"));
  let collections = [];
  let secretRequest = 0;

  const demo = {
    apps: [
      { Name: "/irisops", Namespace: "IRISOPS", Enabled: true, Type: "CSP", Resource: "%Development", DispatchClass: "IRISOps.REST" },
      { Name: "/api/monitor", Namespace: "%SYS", Enabled: true, Type: "REST", Resource: "%Monitor", DispatchClass: "%Api.Monitor" }
    ],
    roles: [{ Name: "%Operator", Description: "Sample role", EscalationOnly: false }],
    users: [{ Name: "demo.operator", Enabled: true, Type: "CSP", Namespace: "USER" }],
    x509: [{ Alias: "demo-service", HasPrivateKey: true, OwnerList: ["demo.operator"], PeerNames: ["example.invalid"] }],
    oauth: [{ Source: "Authorization server", Name: "demo-idp", Endpoint: "https://example.invalid/issuer", Clients: "Sample only" }],
    tasks: [{ Name: "Nightly cleanup", Namespace: "USER", Type: "Task", Suspended: false, NextScheduled: "Sample schedule" }],
    upcoming: [{ Name: "Nightly cleanup", Namespace: "USER", Datetime: "Sample run time", Suspended: false }],
    taskHistory: [{ Name: "Nightly cleanup", Status: "Sample only", Completed: "Sample timestamp", Namespace: "USER" }],
    databases: [{ Name: "USER", Directory: "Sample directory", Size: "Sample only", Status: "Mounted/RW", Encrypted: false }],
    devices: [{ Name: "console", PhysicalDevice: "Sample device", Type: "TRM", Description: "Illustrative inventory" }],
    processes: [{ Job: "42", Username: "demo.operator", State: "Runnable", Nspace: "USER", CPUTime: "00:00:02", ElapsedTime: "00:00:08" }],
    alerts: [{ time: "Sample only", severity: "Info", message: "Illustrative alert; not sourced from an IRIS instance." }],
    audit: [{ TimeStamp: "Sample only", EventSource: "Demo", EventType: "Info", Event: "Example", Username: "demo.operator", Description: "Illustrative audit row." }]
  };

  function esc(value) {
    return String(value == null || value === "" ? "—" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function unwrap(value) {
    let current = value;
    for (let index = 0; index < 3 && current && !Array.isArray(current); index += 1) {
      if (Object.prototype.hasOwnProperty.call(current, "result")) current = current.result;
      else break;
    }
    return current;
  }

  function rowsOf(value, keys) {
    const root = unwrap(value);
    if (Array.isArray(root)) return root;
    if (!root || typeof root !== "object") return [];
    for (const key of keys) {
      if (Array.isArray(root[key])) return root[key];
    }
    return [];
  }

  function rowsFromResult(result, keys) {
    if (!result || result.status !== "ok") return [];
    const root = unwrap(result.value);
    if (Array.isArray(root)) return root;
    if (root && typeof root === "object") {
      for (const key of keys) {
        if (Array.isArray(root[key])) return root[key];
      }
    }
    result.status = "unavailable";
    return [];
  }

  function val(row, keys) {
    if (!row || typeof row !== "object") return "—";
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        const value = row[key];
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (Array.isArray(value)) return value.join(", ");
        return value;
      }
    }
    return "—";
  }

  function setBadge(id, text, state) {
    const node = $(id);
    if (!node) return;
    node.textContent = text;
    const badgeState = state === "ok" ? "source-live"
      : (state === "demo" ? "source-demo"
        : (state === "partial" ? "source-pending" : "source-unavailable"));
    node.className = `source-badge ${badgeState}`;
  }

  function renderTable(id, countId, status, data, columns, limit) {
    const host = $(id);
    const count = $(countId);
    if (!host) return;
    if (status !== "ok" && status !== "demo") {
      if (count) count.textContent = status === "denied" ? "Permission required" : "Unavailable";
      const copy = status === "denied"
        ? "Your current IRIS session does not have permission to read this inventory."
        : (status === "pending"
          ? "The audit query is still running. Refresh to check again."
          : "This endpoint is unavailable in this IRIS version or session.");
      host.innerHTML = `<div class="empty-state">${copy}</div>`;
      return;
    }
    const list = Array.isArray(data) ? data : [];
    if (count) count.textContent = `${list.length} record${list.length === 1 ? "" : "s"}${status === "demo" ? " · demo" : ""}`;
    if (!list.length) {
      host.innerHTML = `<div class="empty-state">No records were returned for this session.</div>`;
      return;
    }
    const visible = list.slice(0, limit || 50);
    host.innerHTML = `<div class="table-scroll"><table><thead><tr>${columns.map((column) => `<th scope="col">${esc(column.label)}</th>`).join("")}</tr></thead><tbody>${visible.map((row) => `<tr>${columns.map((column) => `<td>${esc(column.read(row))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function booleanField(row, keys) {
    if (!row || typeof row !== "object") return null;
    for (const key of keys) {
      const value = row[key];
      if (typeof value === "boolean") return value;
      if (value === 1 || value === 0) return value === 1;
      if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (["true", "yes", "1"].includes(normalized)) return true;
        if (["false", "no", "0"].includes(normalized)) return false;
      }
    }
    return null;
  }

  function renderWebApps(status, list) {
    const host = $("webAppsTable");
    const count = $("webAppsCount");
    if (!host) return;
    if (status !== "ok" && status !== "demo") {
      renderTable("webAppsTable", "webAppsCount", status, [], [], 100);
      return;
    }
    const rows = Array.isArray(list) ? list : [];
    if (count) count.textContent = `${rows.length} application${rows.length === 1 ? "" : "s"}${status === "demo" ? " · demo" : ""}`;
    if (!rows.length) {
      host.innerHTML = `<div class="empty-state">No web applications were returned for this session.</div>`;
      return;
    }
    const canControl = isIrisHost && status === "ok";
    host.innerHTML = `<div class="table-scroll"><table><thead><tr><th scope="col">Web application</th><th scope="col">Namespace</th><th scope="col">Enabled</th><th scope="col">Type</th><th scope="col">Resource</th><th scope="col">Dispatch class</th>${canControl ? "<th scope=\"col\">Actions</th>" : ""}</tr></thead><tbody>${rows.slice(0, 100).map((row) => {
      const name = val(row, ["Name", "Path", "name", "path"]);
      const enabled = booleanField(row, ["Enabled", "enabled"]);
      const controls = canControl && enabled !== null && name !== "—"
        ? `<td class="task-actions"><button class="task-action" type="button" data-app-action="toggle" data-app-name="${esc(name)}" data-current-enabled="${enabled ? "true" : "false"}">${enabled ? "Disable" : "Enable"}</button></td>`
        : (canControl ? "<td>Definition unavailable</td>" : "");
      return `<tr><td>${esc(name)}</td><td>${esc(val(row, ["Namespace", "NameSpace", "namespace"]))}</td><td>${esc(enabled === null ? "Unknown" : (enabled ? "Yes" : "No"))}</td><td>${esc(val(row, ["Type", "type"]))}</td><td>${esc(val(row, ["Resource", "resource"]))}</td><td>${esc(val(row, ["DispatchClass", "dispatchClass"]))}</td>${controls}</tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function bindAppActions() {
    const host = $("webAppsTable");
    if (!host || host.__irisOpsBound) return;
    host.__irisOpsBound = true;
    host.addEventListener("click", async (event) => {
      const button = event.target && typeof event.target.closest === "function"
        ? event.target.closest("button[data-app-action]")
        : null;
      if (!button || !isIrisHost || button.dataset.appAction !== "toggle") return;
      const name = button.dataset.appName || "";
      const desired = button.dataset.currentEnabled !== "true";
      if (!name) return;
      const confirmation = desired
        ? `Enable web application “${name}”? This changes its exposure on the IRIS instance.`
        : `Disable web application “${name}”? Requests to this application may stop working.`;
      if (typeof window.confirm !== "function" || !window.confirm(confirmation)) return;
      button.disabled = true;
      const status = $("appActionStatus");
      if (status) status.textContent = `Loading the current definition for ${name}…`;
      const detail = await request(`${apiRoot}/web-app?name=${encodeURIComponent(name)}`);
      if (detail.status !== "ok" || !detail.value || typeof detail.value !== "object" || Array.isArray(detail.value)) {
        if (status) status.textContent = detail.status === "denied"
          ? "IRIS denied access to this web-application definition."
          : "Could not load the current definition; no change was sent.";
        button.disabled = false;
        return;
      }
      const application = { ...detail.value };
      const enabledKey = Object.prototype.hasOwnProperty.call(application, "Enabled") ? "Enabled"
        : (Object.prototype.hasOwnProperty.call(application, "enabled") ? "enabled" : null);
      if (!enabledKey || !Object.prototype.hasOwnProperty.call(application, "Path") && !Object.prototype.hasOwnProperty.call(application, "path")) {
        if (status) status.textContent = "IRIS returned an incomplete definition; no change was sent.";
        button.disabled = false;
        return;
      }
      application[enabledKey] = desired;
      const result = await request(`${apiRoot}/web-app?name=${encodeURIComponent(name)}`, "PUT", application);
      if (result.status !== "ok") {
        if (status) status.textContent = result.status === "denied"
          ? "IRIS denied this change for the current session."
          : "IRIS rejected the change; inspect the native Security portal and refresh.";
        button.disabled = false;
        return;
      }
      if (status) status.textContent = "IRIS accepted the change. Refreshing the application inventory…";
      await loadLive();
      if (status) status.textContent = "Application inventory refreshed.";
    });
  }

  function renderAlerts(state) {
    const isDemo = state && state.mode === "demo";
    const alerts = isDemo ? demo.alerts : (state && Array.isArray(state.alerts) ? state.alerts : null);
    if (alerts === null) {
      renderTable("alertsTable", "alertsLogCount", "unavailable", [], [], 20);
      return;
    }
    renderTable("alertsTable", "alertsLogCount", isDemo ? "demo" : "ok", alerts, [
      { label: "Time", read: (row) => val(row, ["time", "Time", "datetime", "DateTime", "timestamp"]) },
      { label: "Severity", read: (row) => val(row, ["severity", "Severity", "level", "Level"]) },
      { label: "Alert", read: (row) => val(row, ["message", "Message", "text", "Text", "description", "Description"]) }
    ], 20);
  }

  function setNativeLinks(enabled) {
    const links = [
      ["nativeTaskLink", "/csp/sys/op/TaskManager.csp", "Open native Task Manager", "IRIS only · native Task Manager"],
      ["nativeLogsLink", "/csp/sys/op/", "Open native system logs", "IRIS only · system logs"],
      ["nativeSecurityLink", "/csp/sys/sec/", "Open native security portal", "IRIS only · security portal"]
    ];
    for (const [id, path, activeText, disabledText] of links) {
      const link = $(id);
      if (!link) continue;
      link.textContent = enabled ? activeText : disabledText;
      if (enabled) {
        link.href = path;
        link.removeAttribute("aria-disabled");
      } else {
        link.removeAttribute("href");
        link.setAttribute("aria-disabled", "true");
      }
    }
  }

  function activateTab(tab) {
    const panelId = tab && tab.getAttribute("data-view");
    for (const item of tabs) {
      const active = item === tab;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-selected", active ? "true" : "false");
      const panel = $(item.getAttribute("data-view"));
      if (panel) {
        panel.hidden = !active;
        panel.classList.toggle("is-active", active);
      }
    }
    if (tab && panelId) tab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => activateTab(tab));
    tab.addEventListener("keydown", (event) => {
      const index = tabs.indexOf(tab);
      let next = null;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
      else if (event.key === "ArrowLeft") next = tabs[(index - 1 + tabs.length) % tabs.length];
      else if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[tabs.length - 1];
      if (next) {
        event.preventDefault();
        activateTab(next);
      }
    });
  }

  async function request(path, method, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const headers = { Accept: "application/json" };
      const options = {
        method: method || "GET",
        headers,
        credentials: "same-origin",
        signal: controller.signal
      };
      if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(body);
      }
      const response = await fetch(path, {
        ...options
      });
      if (!response.ok) {
        return { status: response.status === 401 || response.status === 403 ? "denied" : "unavailable", value: null };
      }
      return { status: "ok", value: unwrap(await response.json()) };
    } catch (_) {
      return { status: "unavailable", value: null };
    } finally {
      clearTimeout(timer);
    }
  }

  function resultState(result) {
    return result && result.status ? result.status : "unavailable";
  }

  function renderTasks(status, list) {
    const host = $("tasksTable");
    const count = $("tasksCount");
    if (!host) return;
    if (status !== "ok" && status !== "demo") {
      renderTable("tasksTable", "tasksCount", status, [], [], 100);
      return;
    }
    const rows = Array.isArray(list) ? list : [];
    if (count) count.textContent = `${rows.length} task${rows.length === 1 ? "" : "s"}${status === "demo" ? " · demo" : ""}`;
    if (!rows.length) {
      host.innerHTML = `<div class="empty-state">No scheduled tasks were returned for this session.</div>`;
      return;
    }
    const canControl = isIrisHost && status === "ok";
    host.innerHTML = `<div class="table-scroll"><table><thead><tr><th scope="col">Task</th><th scope="col">Namespace</th><th scope="col">Type</th><th scope="col">Suspended</th><th scope="col">Next scheduled</th><th scope="col">Last finished</th>${canControl ? "<th scope=\"col\">Actions</th>" : ""}</tr></thead><tbody>${rows.slice(0, 100).map((row) => {
      const id = Number(val(row, ["Id", "ID", "TaskId", "id"]));
      const hasId = Number.isSafeInteger(id) && id > 0;
      const name = val(row, ["Name", "name"]);
      const suspended = booleanField(row, ["Suspended", "suspended"]);
      const suspendedLabel = suspended === null ? "Unknown" : (suspended ? "Yes" : "No");
      const controls = canControl && hasId && suspended !== null
        ? `<td class="task-actions"><button class="task-action" type="button" data-task-action="run" data-task-id="${id}" data-task-name="${esc(name)}">Run now</button><button class="task-action" type="button" data-task-action="${suspended ? "resume" : "suspend"}" data-task-id="${id}" data-task-name="${esc(name)}">${suspended ? "Resume" : "Suspend"}</button></td>`
        : (canControl ? "<td>Native Task Manager</td>" : "");
      return `<tr><td>${esc(name)}</td><td>${esc(val(row, ["Namespace", "NameSpace", "namespace"]))}</td><td>${esc(val(row, ["Type", "type"]))}</td><td>${esc(suspendedLabel)}</td><td>${esc(val(row, ["NextScheduled", "nextScheduled"]))}</td><td>${esc(val(row, ["LastFinished", "lastFinished"]))}</td>${controls}</tr>`;
    }).join("")}</tbody></table></div>`;
  }

  function bindTaskActions() {
    const host = $("tasksTable");
    if (!host || host.__irisOpsBound) return;
    host.__irisOpsBound = true;
    host.addEventListener("click", async (event) => {
      const button = event.target && typeof event.target.closest === "function"
        ? event.target.closest("button[data-task-action]")
        : null;
      if (!button || !isIrisHost) return;
      const action = button.dataset.taskAction;
      const taskId = Number(button.dataset.taskId);
      const taskName = button.dataset.taskName || "this task";
      if (!["run", "suspend", "resume"].includes(action) || !Number.isSafeInteger(taskId) || taskId < 1) return;
      const confirmation = action === "run"
        ? `Run “${taskName}” now? This starts the configured task immediately.`
        : `${action === "suspend" ? "Suspend" : "Resume"} “${taskName}”?`;
      if (typeof window.confirm !== "function" || !window.confirm(confirmation)) return;
      button.disabled = true;
      const status = $("taskActionStatus");
      if (status) status.textContent = `${action === "run" ? "Starting" : action === "suspend" ? "Suspending" : "Resuming"} ${taskName}…`;
      const path = `${apiRoot}/task/${action}?id=${encodeURIComponent(taskId)}`;
      const body = action === "run" ? { RunNow: true } : (action === "suspend" ? { LeaveInQueue: true } : undefined);
      const result = await request(path, "POST", body);
      if (result.status !== "ok") {
        if (status) status.textContent = result.status === "denied"
          ? "IRIS denied this task action for the current session."
          : "IRIS could not complete the task action; inspect the native Task Manager and refresh.";
        button.disabled = false;
        return;
      }
      if (status) status.textContent = "IRIS accepted the request. Refreshing the task inventory…";
      await loadLive();
      if (status) status.textContent = "Task inventory refreshed. Check the status and execution history above.";
    });
  }

  function renderCollectionOptions(result) {
    const select = $("walletCollection");
    if (!select) return;
    collections = result.status === "ok" ? rowsOf(result.value, ["WalletCollectionList", "Collections", "collections"]) : [];
    if (result.status !== "ok") {
      select.innerHTML = `<option value="">${result.status === "denied" ? "Permission required" : "Collections unavailable"}</option>`;
      renderTable("secretsTable", null, result.status, [], [], 100);
      return;
    }
    select.innerHTML = `<option value="">Choose a collection</option>${collections.map((row) => {
      const name = String(val(row, ["Name", "name", "Collection"]));
      return `<option value="${esc(name)}">${esc(name)}</option>`;
    }).join("")}`;
    if (!collections.length) renderTable("secretsTable", null, "ok", [], [], 100);
    else loadSecrets("");
  }

  async function loadSecrets(collection) {
    const requestId = ++secretRequest;
    if (!collection) {
      renderTable("secretsTable", null, "ok", [], [], 100);
      return;
    }
    const path = `${apiRoot}/wallet/secrets?collection=${encodeURIComponent(collection)}&maxRows=100`;
    const result = await request(path);
    if (requestId !== secretRequest) return;
    const list = result.status === "ok" ? rowsOf(result.value, ["WalletSecretList", "Secrets", "secrets"]) : [];
    renderTable("secretsTable", null, result.status, list, [
      { label: "Secret name", read: (row) => val(row, ["Name", "name"]) },
      { label: "Implementation type", read: (row) => val(row, ["Type", "type"]) }
    ], 100);
  }

  function showSummary(root, resourceRows, status, resourcesStatus) {
    const host = $("systemSummary");
    const count = $("systemCount");
    if (!host) return;
    if (status !== "ok" && status !== "demo") {
      if (count) count.textContent = status === "denied" ? "Permission required" : "Unavailable";
      host.innerHTML = `<div class="empty-state">System dashboard unavailable to this session.</div>`;
      return;
    }
    const statusBlock = root && (root.Status || root.status || {});
    const usage = root && (root.SystemUsage || root.systemUsage || {});
    const performance = root && (root.Performance || root.performance || {});
    const cells = [
      ["Status", val(statusBlock, ["Status", "InstanceStatus", "status"])],
      ["Uptime", val(statusBlock, ["Uptime", "UpTime", "uptime"])],
      ["Processes", val(usage, ["Processes", "ProcessCount", "processes"])],
      ["CSP sessions", val(usage, ["CSPSessions", "CspSessions", "cspSessions"])],
      ["Global references", val(performance, ["GlobalRefs", "GlobalReferences", "globalRefs"])],
      ["Databases", resourcesStatus === "ok" || resourcesStatus === "demo" ? resourceRows.length : "—"]
    ];
    if (count) count.textContent = `${status === "demo" ? "sample" : "IRIS"} · read-only`;
    host.innerHTML = cells.map(([label, value]) => `<div class="summary-tile"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${status === "demo" ? "Sample only · not live" : "SysAdmin API"}</small></div>`).join("");
  }

  function renderDemo() {
    setBadge("adminStatus", "DEMO DATA", "demo");
    setBadge("taskManagerStatus", "DEMO", "demo");
    setNativeLinks(false);
    renderWebApps("demo", demo.apps);
    renderTable("rolesTable", "rolesCount", "demo", demo.roles, [
      { label: "Role", read: (row) => val(row, ["Name"]) },
      { label: "Description", read: (row) => val(row, ["Description"]) },
      { label: "Escalation only", read: (row) => val(row, ["EscalationOnly"]) }
    ]);
    renderTable("usersTable", "usersCount", "demo", demo.users, [
      { label: "Username", read: (row) => val(row, ["Name"]) },
      { label: "Enabled", read: (row) => val(row, ["Enabled"]) },
      { label: "Type", read: (row) => val(row, ["Type"]) },
      { label: "Namespace", read: (row) => val(row, ["Namespace"]) }
    ]);
    renderTable("x509Table", "x509Count", "demo", demo.x509, [
      { label: "Alias", read: (row) => val(row, ["Alias"]) },
      { label: "Private key present", read: (row) => val(row, ["HasPrivateKey"]) },
      { label: "Owners", read: (row) => val(row, ["OwnerList"]) },
      { label: "Peer names", read: (row) => val(row, ["PeerNames"]) }
    ]);
    renderTable("oauthTable", "oauthCount", "demo", demo.oauth, [
      { label: "Source", read: (row) => val(row, ["Source"]) },
      { label: "Configuration", read: (row) => val(row, ["Name"]) },
      { label: "Endpoint / client", read: (row) => val(row, ["Endpoint"]) },
      { label: "Details", read: (row) => val(row, ["Clients"]) }
    ]);
    const select = $("walletCollection");
    if (select) select.innerHTML = `<option value="">Demo · secret values not shown</option>`;
    renderTable("secretsTable", null, "demo", [{ Name: "sample-api-key", Type: "Environment" }], [
      { label: "Secret name", read: (row) => val(row, ["Name"]) },
      { label: "Implementation type", read: (row) => val(row, ["Type"]) }
    ]);
    renderTasks("demo", demo.tasks);
    renderTable("upcomingTable", null, "demo", demo.upcoming, [
      { label: "Task", read: (row) => val(row, ["Name"]) },
      { label: "Namespace", read: (row) => val(row, ["Namespace"]) },
      { label: "Next run", read: (row) => val(row, ["Datetime"]) },
      { label: "Suspended", read: (row) => val(row, ["Suspended"]) }
    ]);
    renderTable("taskHistoryTable", null, "demo", demo.taskHistory, [
      { label: "Task", read: (row) => val(row, ["Name"]) },
      { label: "Status", read: (row) => val(row, ["Status"]) },
      { label: "Completed", read: (row) => val(row, ["Completed"]) },
      { label: "Namespace", read: (row) => val(row, ["Namespace"]) }
    ], 50);
    showSummary({ Status: { Status: "Illustrative" }, SystemUsage: {}, Performance: {} }, [], "demo");
    renderTable("resourcesTable", null, "demo", [], [], 100);
    renderTable("databasesTable", "databasesCount", "demo", demo.databases, [
      { label: "Database", read: (row) => val(row, ["Name"]) },
      { label: "Directory", read: (row) => val(row, ["Directory"]) },
      { label: "Size (MB)", read: (row) => val(row, ["Size"]) },
      { label: "Status", read: (row) => val(row, ["Status"]) },
      { label: "Encrypted", read: (row) => val(row, ["Encrypted"]) }
    ]);
    renderTable("devicesTable", "devicesCount", "demo", demo.devices, [
      { label: "Device", read: (row) => val(row, ["Name"]) },
      { label: "Physical device", read: (row) => val(row, ["PhysicalDevice"]) },
      { label: "Type", read: (row) => val(row, ["Type"]) },
      { label: "Description", read: (row) => val(row, ["Description"]) }
    ]);
    renderTable("processesTable", "processCount", "demo", demo.processes, [
      { label: "Job", read: (row) => val(row, ["Job"]) },
      { label: "User", read: (row) => val(row, ["Username"]) },
      { label: "State", read: (row) => val(row, ["State"]) },
      { label: "Namespace", read: (row) => val(row, ["Nspace"]) },
      { label: "CPU", read: (row) => val(row, ["CPUTime"]) },
      { label: "Elapsed", read: (row) => val(row, ["ElapsedTime"]) }
    ]);
    renderAlerts({ mode: "demo", alerts: demo.alerts });
    renderTable("auditTable", null, "demo", demo.audit, [
      { label: "Time", read: (row) => val(row, ["TimeStamp"]) },
      { label: "Source", read: (row) => val(row, ["EventSource"]) },
      { label: "Type", read: (row) => val(row, ["EventType"]) },
      { label: "Event", read: (row) => val(row, ["Event"]) },
      { label: "User", read: (row) => val(row, ["Username"]) },
      { label: "Description", read: (row) => val(row, ["Description"]) }
    ], 50);
  }

  async function loadAuditRecords() {
    let task = await request(`${apiRoot}/security/audit/records?maxRows=50`, "POST");
    if (task.status !== "ok") return { status: task.status, rows: [] };
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const value = task.value;
      const state = String(val(value, ["State", "state"])).toLowerCase();
      if (state === "finished") {
        return { status: "ok", rows: rowsOf(value.Result || value.result, ["AuditRecordList", "Records", "records"]) };
      }
      if (state === "failed" || state === "canceled") return { status: "unavailable", rows: [] };
      const guid = val(value, ["GUID", "Guid", "guid"]);
      if (guid === "—") return { status: "unavailable", rows: [] };
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
      task = await request(`${apiRoot}/async-result?id=${encodeURIComponent(guid)}`);
      if (task.status !== "ok") return { status: task.status, rows: [] };
    }
    return { status: "pending", rows: [] };
  }

  async function loadLive() {
    const requests = {
      apps: request(`${apiRoot}/web-apps?maxRows=100`),
      roles: request(`${apiRoot}/security/roles?maxRows=100`),
      users: request(`${apiRoot}/security/users?maxRows=100`),
      wallets: request(`${apiRoot}/wallet/collections?maxRows=100`),
      x509: request(`${apiRoot}/security/x509-credentials?maxRows=100`),
      oauthServers: request(`${apiRoot}/security/oauth2/client/server-definitions?maxRows=100`),
      oauthClients: request(`${apiRoot}/security/oauth2/server/clients?maxRows=100`),
      tasks: request(`${apiRoot}/tasks?maxRows=100`),
      upcoming: request(`${apiRoot}/task/upcoming?maxRows=20`),
      taskHistory: request(`${apiRoot}/task/history?maxRows=50`),
      manager: request(`${apiRoot}/task/manager`),
      dashboard: request(`${apiRoot}/monitor/dashboard/main`),
      resources: request(`${apiRoot}/monitor/dashboard/system-resources`),
      databases: request(`${apiRoot}/database-dirs?maxRows=100`),
      devices: request(`${apiRoot}/devices?maxRows=100`),
      processes: request(`${apiRoot}/processes?maxRows=100`)
    };
    const entries = await Promise.all([
      ...Object.entries(requests).map(async ([key, promise]) => [key, await promise]),
      loadAuditRecords().then((value) => ["audit", value])
    ]);
    const data = Object.fromEntries(entries);
    const rowKeys = {
      apps: ["WebApplicationList", "WebApplications", "applications"],
      roles: ["RoleList", "Roles", "roles"],
      users: ["UserList", "Users", "users"],
      wallets: ["WalletCollectionList", "Collections", "collections"],
      x509: ["X509CredentialsList", "Credentials", "credentials"],
      oauthServers: ["OAuth2AuthorizationServerList", "Servers", "servers"],
      oauthClients: ["OAuth2ServerClientList", "Clients", "clients"],
      tasks: ["ScheduledTaskList", "TaskList", "Tasks", "tasks"],
      upcoming: ["UpcomingTaskList", "UpcomingTasks", "upcomingTasks"],
      taskHistory: ["TaskHistory", "TaskHistoryList", "History", "history"],
      resources: ["ResourceList", "SystemResources", "Resources", "resources"],
      databases: ["LocalDatabaseList", "DatabaseList", "Databases", "databases"],
      devices: ["DeviceList", "Devices", "devices"],
      processes: ["ProcessList", "Processes", "processes"]
    };
    for (const [key, keys] of Object.entries(rowKeys)) data[key].rows = rowsFromResult(data[key], keys);
    for (const key of ["dashboard", "manager"]) {
      if (data[key].status === "ok" && (!data[key].value || typeof data[key].value !== "object")) {
        data[key].status = "unavailable";
      }
    }
    const results = Object.values(data);
    const okCount = results.filter((result) => result.status === "ok").length;
    const deniedCount = results.filter((result) => result.status === "denied").length;
    const overall = okCount === results.length ? "ok" : (okCount ? "partial" : (deniedCount ? "denied" : "unavailable"));
    setBadge("adminStatus", overall === "ok" ? "LIVE · IRIS APIs" : (overall === "partial" ? "PARTIAL ACCESS" : (overall === "denied" ? "PERMISSION REQUIRED" : "UNAVAILABLE")), overall);
    setBadge("taskManagerStatus", data.manager.status === "ok" ? "API AVAILABLE" : (data.manager.status === "denied" ? "PERMISSION REQUIRED" : "NATIVE HAND-OFF"), data.manager.status);
    setNativeLinks(true);

    renderWebApps(data.apps.status, data.apps.rows);
    renderTable("rolesTable", "rolesCount", data.roles.status, data.roles.rows, [
      { label: "Role", read: (row) => val(row, ["Name", "name"]) },
      { label: "Description", read: (row) => val(row, ["Description", "description"]) },
      { label: "Escalation only", read: (row) => val(row, ["EscalationOnly", "escalationOnly"]) }
    ]);
    renderTable("usersTable", "usersCount", data.users.status, data.users.rows, [
      { label: "Username", read: (row) => val(row, ["Name", "name"]) },
      { label: "Enabled", read: (row) => val(row, ["Enabled", "enabled"]) },
      { label: "Type", read: (row) => val(row, ["Type", "type"]) },
      { label: "Namespace", read: (row) => val(row, ["Namespace", "namespace"]) }
    ]);
    renderTable("x509Table", "x509Count", data.x509.status, data.x509.rows, [
      { label: "Alias", read: (row) => val(row, ["Alias", "Name", "alias"]) },
      { label: "Private key present", read: (row) => val(row, ["HasPrivateKey", "hasPrivateKey"]) },
      { label: "Owners", read: (row) => val(row, ["OwnerList", "ownerList"]) },
      { label: "Peer names", read: (row) => val(row, ["PeerNames", "peerNames"]) }
    ], 50);
    const oauthRows = [
      ...data.oauthServers.rows.map((row) => ({
        Source: "Authorization server",
        Name: val(row, ["ID", "Name", "name"]),
        Endpoint: val(row, ["IssuerEndpoint", "issuerEndpoint"]),
        Details: `${val(row, ["ClientCount", "clientCount"])} clients · ${val(row, ["ResourceCount", "resourceCount"])} resources`
      })),
      ...data.oauthClients.rows.map((row) => ({
        Source: "Registered client",
        Name: val(row, ["Name", "name"]),
        Endpoint: val(row, ["ClientId", "ClientID", "clientId"]),
        Details: `${val(row, ["ClientType", "clientType"])} · ${val(row, ["Description", "description"])}`
      }))
    ];
    const oauthAvailable = data.oauthServers.status === "ok" || data.oauthClients.status === "ok";
    const oauthDenied = data.oauthServers.status === "denied" || data.oauthClients.status === "denied";
    if ($("oauthCount")) $("oauthCount").textContent = `${oauthRows.length} records · ${[data.oauthServers, data.oauthClients].filter((item) => item.status === "ok").length}/2 sources`;
    renderTable("oauthTable", null, oauthAvailable ? "ok" : (oauthDenied ? "denied" : "unavailable"), oauthRows, [
      { label: "Kind", read: (row) => row.Source },
      { label: "Name", read: (row) => row.Name },
      { label: "Endpoint / client ID", read: (row) => row.Endpoint },
      { label: "Details", read: (row) => row.Details }
    ], 100);
    renderCollectionOptions(data.wallets);
    renderTasks(data.tasks.status, data.tasks.rows);
    renderTable("upcomingTable", null, data.upcoming.status, data.upcoming.rows, [
      { label: "Task", read: (row) => val(row, ["Name", "name"]) },
      { label: "Namespace", read: (row) => val(row, ["Namespace", "namespace"]) },
      { label: "Next run", read: (row) => val(row, ["Datetime", "DateTime", "datetime"]) },
      { label: "Suspended", read: (row) => val(row, ["Suspended", "suspended"]) }
    ], 20);
    renderTable("taskHistoryTable", null, data.taskHistory.status, data.taskHistory.rows, [
      { label: "Task", read: (row) => val(row, ["Name", "name"]) },
      { label: "Status", read: (row) => val(row, ["Status", "status"]) },
      { label: "Completed", read: (row) => val(row, ["Completed", "LogDatetime", "completed"]) },
      { label: "Namespace", read: (row) => val(row, ["Namespace", "namespace"]) },
      { label: "Job", read: (row) => val(row, ["JobNumber", "TaskId", "Pid"]) }
    ], 50);

    const resourceRows = data.resources.rows;
    showSummary(data.dashboard.value, resourceRows, data.dashboard.status, data.resources.status);
    renderTable("resourcesTable", null, data.resources.status, resourceRows, [
      { label: "Resource / database", read: (row) => val(row, ["Name", "Database", "Resource", "name"]) },
      { label: "Seize", read: (row) => val(row, ["Seize", "seize"]) },
      { label: "Non-seize", read: (row) => val(row, ["Nseize", "NonSeize", "nseize"]) },
      { label: "Available", read: (row) => val(row, ["Aseize", "Available", "aseize"]) },
      { label: "Buffered", read: (row) => val(row, ["Bseize", "Buffered", "bseize"]) },
      { label: "Busy", read: (row) => val(row, ["BusySet", "Busy", "busySet"]) }
    ], 100);
    renderTable("databasesTable", "databasesCount", data.databases.status, data.databases.rows, [
      { label: "Database", read: (row) => val(row, ["Name", "Directory", "Resource", "name"]) },
      { label: "Directory", read: (row) => val(row, ["Directory", "directory"]) },
      { label: "Size (MB)", read: (row) => val(row, ["Size", "size"]) },
      { label: "Max (MB)", read: (row) => val(row, ["MaxSize", "maxSize"]) },
      { label: "Status", read: (row) => val(row, ["Status", "status"]) },
      { label: "Encrypted", read: (row) => val(row, ["Encrypted", "encrypted"]) }
    ], 100);
    renderTable("devicesTable", "devicesCount", data.devices.status, data.devices.rows, [
      { label: "Device", read: (row) => val(row, ["Name", "name"]) },
      { label: "Physical device", read: (row) => val(row, ["PhysicalDevice", "physicalDevice"]) },
      { label: "Type", read: (row) => val(row, ["Type", "type"]) },
      { label: "Subtype", read: (row) => val(row, ["SubType", "Subtype", "subType"]) },
      { label: "Description", read: (row) => val(row, ["Description", "description"]) }
    ], 100);
    renderTable("processesTable", "processCount", data.processes.status, data.processes.rows, [
      { label: "Job", read: (row) => val(row, ["Job", "job"]) },
      { label: "User", read: (row) => val(row, ["Username", "User", "username"]) },
      { label: "State", read: (row) => val(row, ["State", "state"]) },
      { label: "Namespace", read: (row) => val(row, ["Nspace", "Namespace", "namespace"]) },
      { label: "CPU", read: (row) => val(row, ["CPUTime", "CpuTime", "cpuTime"]) },
      { label: "Elapsed", read: (row) => val(row, ["ElapsedTime", "elapsedTime"]) }
    ], 100);

    const appState = window.__IRIS_OPS_STATE__ || { mode: "connecting", alerts: null };
    renderAlerts(appState);
    renderTable("auditTable", null, data.audit.status, data.audit.rows, [
      { label: "Time", read: (row) => val(row, ["TimeStamp", "UTCTimeStamp", "timestamp"]) },
      { label: "Source", read: (row) => val(row, ["EventSource", "eventSource"]) },
      { label: "Type", read: (row) => val(row, ["EventType", "eventType"]) },
      { label: "Event", read: (row) => val(row, ["Event", "event"]) },
      { label: "User", read: (row) => val(row, ["Username", "username"]) },
      { label: "Description", read: (row) => val(row, ["Description", "description"]) }
    ], 50);
    const select = $("walletCollection");
    if (select && !select.__irisOpsBound) {
      select.__irisOpsBound = true;
      select.addEventListener("change", () => loadSecrets(select.value));
    }
    bindTaskActions();
    bindAppActions();
    return data;
  }

  if (isIrisHost) {
    loadLive();
    if (typeof window.addEventListener === "function") {
      window.addEventListener("irisops:update", (event) => renderAlerts(event.detail));
    }
  } else {
    renderDemo();
  }
}());
