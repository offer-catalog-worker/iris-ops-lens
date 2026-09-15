# Design note: an operator's first five minutes

The idea behind IRIS Ops Lens is simple: an operator should be able to answer four questions without opening a dozen Management Portal pages:

1. **Is the instance healthy?** The summary cards and native monitor metrics answer this first.
2. **What changed or needs attention?** Monitor alerts, task history and permission-gated audit records surface operational signals.
3. **Which administration surfaces exist?** The workspace inventories web apps, roles, users, wallets, X.509 credentials, OAuth, tasks, databases, devices and processes alongside REST/OpenAPI contracts.
4. **What can I change here safely?** Web-app enablement and task run/suspend/resume actions require a fresh read and explicit confirmation; other privileged configuration hands off to the native UI.

The cockpit is read-first, not an autonomous administrator. It sends no state-changing request on load, uses only the logged-in same-origin IRIS session, preserves IRIS permission checks, and never reads wallet values or key material. Task-definition, user, role, certificate, OAuth and device editing remain in the native portal until their schemas can be validated against a live supported IRIS instance.

## Runtime behavior

When hosted by IRIS at `/csp/irisops`, the browser calls same-origin native APIs and renders live values. When opened as a static file or GitHub Pages demo, requests fail cleanly and the UI switches to clearly labelled demo values. Demo values are never presented as server telemetry.

## Future extension points

- Add task-definition and permission editing after validating complete update schemas on a live supported IRIS instance.
- Add create/edit flows for OAuth, X.509 and wallet metadata only after verifying the credential-field and secret-handling contracts.
- Add namespace filtering using the existing `/api/mgmnt/v2/:namespace/` endpoint.
- Extend subsystem-log coverage only through documented, permission-protected IRIS APIs.
