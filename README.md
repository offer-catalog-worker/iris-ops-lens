# IRIS Ops Lens

IRIS Ops Lens is a read-first management cockpit for InterSystems IRIS. It brings health signals, REST surfaces, web applications, access metadata, scheduled work, resources, processes, devices, databases and logs into one operator workspace.

The app does not collect passwords or render secret values. Its only in-app state-changing controls enable/disable a web application and run, suspend or resume a scheduled task. Each requires a fresh read where applicable, an explicit confirmation, and the current IRIS session; IRIS remains the source of truth for authorization and auditing. Other privileged configuration stays in the native portal.

## What is included

- **Server snapshot** through a tiny authenticated ObjectScript REST class.
- **Health signals** from the native `/api/monitor/metrics` and `/api/monitor/alerts` services.
- **REST service catalog** from `/api/mgmnt/`, with one-click OpenAPI inspection.
- **Management inventory** for web applications, roles, users, scheduled tasks and their history, system resources, databases, devices, X.509 credentials and OAuth configurations through the authenticated SysAdmin API.
- **Security and operations logs** combine monitor alerts, task history and a bounded audit-record query. Audit export is polled through the current user's own asynchronous task and renders a deliberate metadata allowlist rather than event payloads, roles or user-info fields.
- **Wallet metadata** limited to collection names and secret names/types. The wallet listing endpoint does not return secret values; the UI does not call a value-retrieval operation.
- **Task hand-off** to the native Task Manager, preserving IRIS audit and role checks.
- **Permission-aware views** that distinguish unavailable endpoints and denied access from empty results; no role elevation is attempted and no action is automated.
- **Guardrailed operations** for enabling/disabling a web application and running, suspending or resuming a scheduled task. These controls are hidden in static demo mode, do nothing on page load, require explicit confirmation, and preserve native IRIS permission checks.
- **Demo mode** when the page is opened outside IRIS, so the interface remains explorable without pretending that demo values are live.
- **Truthful connection states** distinguish live, partial, and demo data; a failed API never gets silently replaced with sample values while the screen claims to be connected.
- **Safe OpenAPI links** accept only same-origin IRIS management paths returned by the service catalog.
- **Docker Compose** packaging based on the IRIS Community Edition full-stack pattern.

## Run with Docker

Prerequisites:

- Docker Desktop (or Docker Engine with Compose v2)
- Access to the public `containers.intersystems.com/intersystems/iris-community:latest-em` image

```bash
docker compose build
docker compose up -d
```

Open <http://localhost:52773/csp/irisops/index.html>. The first start may take a minute while IRIS imports the module. Stop it with `docker compose down`.

The installer does not change password-expiration settings or any existing user account. Apply your normal IRIS authentication, authorization, and deployment hardening before exposing an instance beyond localhost.

## API map

| Lens area | IRIS source | Why it is safe |
| --- | --- | --- |
| Snapshot | `/rest/irisops/summary` | Returns identity and runtime labels only; `readOnly=1`, `secretsExposed=0` |
| Metrics | `/api/monitor/metrics` | Native OpenMetrics endpoint; values are parsed client-side |
| Alerts | `/api/monitor/alerts` | Native monitor service; no mutation |
| REST catalog | `/api/mgmnt/` | Native inventory and OpenAPI links |
| Web apps, roles, users, wallet metadata, X.509 and OAuth inventories | `/api/admin/v2/web-apps`, `/security/roles`, `/security/users`, `/wallet/collections`, `/wallet/secrets`, `/security/x509-credentials`, `/security/oauth2/*` | Authenticated same-origin reads; the only web-app write changes `Enabled` on a freshly fetched definition after confirmation; wallet and credential views omit secret/private-key values |
| Scheduled work, history, dashboard, databases, devices, processes | `/api/admin/v2/tasks`, `/task/upcoming`, `/task/history`, `/monitor/dashboard/*`, `/database-dirs`, `/devices`, `/processes` | Authenticated same-origin reads; task run/suspend/resume are separate user-confirmed operations; task-definition editing remains in native Task Manager |
| Security audit | `/api/admin/v2/security/audit/records`, `/async-result` | Permission-gated query limited to 50 rows; asynchronous polling stays in the current IRIS session and displays an allowlist of non-payload fields |
| Task Manager | `/csp/sys/op/TaskManager.csp` | Privileged scheduling stays in the native UI |

The task API is documented by InterSystems as `%SYS.Task` and `%SYS.TaskSuper`; the cockpit links to the native manager instead of reimplementing privileged writes. All management requests reuse the current same-origin IRIS session, so an authorized operator sees only what their IRIS permissions allow. The snapshot response contains runtime labels only and does not return the current username or role list. Opening the static demo outside an IRIS-hosted path makes no administrative API requests and uses clearly labelled sample data.

## Contest notes

This project is prepared for the InterSystems Programming Contest **Build Your Own Management Portal** (September 14–27, 2026). The contest asks for a functional GUI powered by IRIS management APIs, an open-source repository and an English README. Submission and judging remain subject to the organizer's official rules and eligibility checks.

Useful official references:

- [Contest announcement](https://community.intersystems.com/post/intersystems-programming-contest-build-your-own-management-portal)
- [/api/mgmnt endpoint reference](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls/framework-api/scbi/documatic/DocBook.UI.Page.cls?KEY=GREST_reference)
- [REST API for metrics](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls/framework-api/scbi/changes/DocBook.UI.Page.cls?KEY=GCM_rest)
- [Tasks and `%SYS.Task` APIs](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=ITECHREF_task)

The [submitted product idea](https://ideas.intersystems.com/ideas/DPI-I-1022) and the reasoning behind the confirmation-gated action boundary are documented in [DESIGN.md](DESIGN.md).
The paste-ready contest application copy is in [SUBMISSION.md](SUBMISSION.md).

## Development checks

The browser client is dependency-free. Run its syntax and behavior checks from the repository root:

```bash
node --check web/js/app.js
node --check web/js/management.js
node --test
```

The behavior suite covers full-live, partial, and fully offline states, malformed responses, untrusted catalog content, missing metrics, security-flag validation, permission failures, safe wallet and certificate metadata rendering, asynchronous audit-record polling, and the rule that static demo mode sends no administrative API requests. GitHub Actions runs these checks, compiles/installs the module in IRIS Community Edition, verifies that the live summary emits typed JSON booleans, and requests the installed cockpit over HTTP before publishing the demo site. `tests/smoke.ps1` runs the browser checks on Windows.

## License

MIT.
