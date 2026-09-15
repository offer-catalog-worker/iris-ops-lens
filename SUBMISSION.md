# Open Exchange submission card

This is the short, paste-ready information for the **Build Your Own Management Portal** contest application.

## App name

IRIS Ops Lens

## One-line description

A read-only operations cockpit that unifies IRIS health signals, monitor alerts, REST service discovery and a safe Task Manager hand-off.

## Detailed description

IRIS Ops Lens answers an operator's first five questions in one screen: is the instance healthy, what needs attention, which REST surfaces are deployed, how can an OpenAPI contract be inspected, and where should a privileged task change be made? It reads the native `/api/monitor/metrics`, `/api/monitor/alerts` and `/api/mgmnt/` APIs, then adds a minimal authenticated `/rest/irisops/summary` endpoint for runtime labels. Scheduling remains in the native Task Manager so IRIS roles and audit behavior stay authoritative. The UI has an explicit demo mode for static hosting and never presents demo values as live telemetry.

## Repository

https://github.com/offer-catalog-worker/iris-ops-lens

## Public demo

https://offer-catalog-worker.github.io/iris-ops-lens/

## Installation

1. Install Docker Desktop and make sure the `containers.intersystems.com/intersystems/iris-community:latest-em` image is available.
2. Run `docker compose build`.
3. Run `docker compose up -d`.
4. Open `http://localhost:52773/csp/irisops/index.html`.

## Judging highlights

- **Complexity:** combines three native IRIS management services with a CSP/REST module and graceful fallback behavior.
- **Clarity:** no dependency-heavy build step; the README, design note and API map explain the full path.
- **Developer experience:** one compose command, direct OpenAPI links and readable failure states.
- **Applicability:** useful on Community Edition and suitable as a low-risk starting point for production operators.
- **Usability:** focused cards, alert visibility, responsive layout and a deliberate read-only boundary.
