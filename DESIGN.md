# Design note: an operator's first five minutes

The idea behind IRIS Ops Lens is simple: an operator should be able to answer four questions without opening a dozen Management Portal pages:

1. **Is the instance healthy?** The summary cards and native monitor metrics answer this first.
2. **What changed or needs attention?** The alert count and signal list keep the monitor stream visible.
3. **Which REST surfaces exist?** The service catalog reads the native management inventory and exposes each OpenAPI contract.
4. **Where do I make a privileged change?** The Task Manager hand-off intentionally returns to the native UI, where IRIS roles and audit behavior remain in control.

The cockpit is deliberately read-only. A dashboard that silently reimplements security-sensitive operations is risky; a dashboard that makes the safe next action obvious is useful. This is why the app includes a real authenticated server snapshot while leaving scheduling and security changes to IRIS.

## Runtime behavior

When hosted by IRIS at `/csp/irisops`, the browser calls same-origin native APIs and renders live values. When opened as a static file or GitHub Pages demo, requests fail cleanly and the UI switches to clearly labelled demo values. Demo values are never presented as server telemetry.

## Future extension points

- Add a `%SYS.Task` read-only adapter after validating the exact Task Manager schema on the target IRIS version.
- Add namespace filtering using the existing `/api/mgmnt/v2/:namespace/` endpoint.
- Add optional alert acknowledgement only behind an explicit, role-protected IRIS service.
