# IRIS Ops Lens

IRIS Ops Lens is a calm, read-only operations cockpit for InterSystems IRIS. It puts the signals an operator checks first—health, metrics, alerts, REST surfaces and a safe hand-off to Task Manager—into one small screen.

The app is intentionally conservative: it does not collect passwords, render secrets, or create privileged write endpoints. IRIS remains the source of truth for authentication, roles and task changes.

## What is included

- **Server snapshot** through a tiny authenticated ObjectScript REST class.
- **Health signals** from the native `/api/monitor/metrics` and `/api/monitor/alerts` services.
- **REST service catalog** from `/api/mgmnt/`, with one-click OpenAPI inspection.
- **Task hand-off** to the native Task Manager, preserving IRIS audit and role checks.
- **Demo mode** when the page is opened outside IRIS, so the interface remains explorable without pretending that demo values are live.
- **Docker Compose** packaging based on the IRIS Community Edition full-stack pattern.

## Run with Docker

Prerequisites:

- Docker Desktop (or Docker Engine with Compose v2)
- Access to the `intersystemsdc/iris-community` image

```bash
docker compose build
docker compose up -d
```

Open <http://localhost:52773/csp/irisops/index.html>. The first start may take a minute while IRIS imports the module. Stop it with `docker compose down`.

The image is configured for development. For a production deployment, keep passwords managed by IRIS and remove the development password-unexpiry line from `iris.script`.

## API map

| Lens area | IRIS source | Why it is safe |
| --- | --- | --- |
| Snapshot | `/rest/irisops/summary` | Returns identity and runtime labels only; `readOnly=1`, `secretsExposed=0` |
| Metrics | `/api/monitor/metrics` | Native OpenMetrics endpoint; values are parsed client-side |
| Alerts | `/api/monitor/alerts` | Native monitor service; no mutation |
| REST catalog | `/api/mgmnt/` | Native inventory and OpenAPI links |
| Task Manager | `/csp/sys/op/TaskManager.csp` | Privileged scheduling stays in the native UI |

The task API is documented by InterSystems as `%SYS.Task` and `%SYS.TaskSuper`; the cockpit links to the native manager instead of reimplementing privileged writes.

## Contest notes

This project is prepared for the InterSystems Programming Contest **Build Your Own Management Portal** (September 14–27, 2026). The contest asks for a functional GUI powered by IRIS management APIs, an open-source repository and an English README. Submission and judging remain subject to the organizer's official rules and eligibility checks.

Useful official references:

- [Contest announcement](https://community.intersystems.com/post/intersystems-programming-contest-build-your-own-management-portal)
- [/api/mgmnt endpoint reference](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls/framework-api/scbi/documatic/DocBook.UI.Page.cls?KEY=GREST_reference)
- [REST API for metrics](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls/framework-api/scbi/changes/DocBook.UI.Page.cls?KEY=GCM_rest)
- [Tasks and `%SYS.Task` APIs](https://docs.intersystems.com/irislatest/csp/docbook/DocBook.UI.Page.cls?KEY=ITECHREF_task)

## Development checks

The browser client is dependency-free. Run its syntax check from the repository root:

```bash
node --check web/js/app.js
```

IRIS class compilation and the Docker smoke test require an IRIS Community Edition runtime; the repository intentionally does not bundle a licensed runtime.

## License

MIT.
