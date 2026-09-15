# Open Exchange submission card

This is the short, paste-ready information for the **Build Your Own Management Portal** contest application.

## App name

IRIS Ops Lens

## One-line description

A read-first management cockpit for IRIS health, REST surfaces, access and credential metadata, scheduled work, storage, devices, processes and logs, with confirmed controls for web-app availability and task actions.

## Detailed description

IRIS Ops Lens brings native monitor signals and the SysAdmin inventory APIs into a focused management workspace: web applications and REST/OpenAPI, roles and users, wallet metadata, X.509 and OAuth inventories, tasks and history, system resources, databases, devices, processes, monitor alerts and asynchronous audit records. Operators can enable/disable a web application or run/suspend/resume a scheduled task; each action requires explicit confirmation and is authorized and audited by IRIS. Secret values and audit payload fields are deliberately omitted. Other privileged configuration remains in the native portal until its full write contract has been validated against a live supported IRIS instance. The static demo uses labelled sample data and sends no administrative requests.

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

- **Complexity:** combines native monitor, management and SysAdmin APIs, including asynchronous audit export, with a CSP/REST module and explicit operational controls.
- **Clarity:** no dependency-heavy build step; the README, design note and API map explain the full path.
- **Developer experience:** one compose command, direct OpenAPI links and readable failure states.
- **Applicability:** useful on Community Edition and suitable as a low-risk starting point for production operators.
- **Usability:** focused work areas, responsive tables, truthful permission/error states and confirmation-gated controls.
