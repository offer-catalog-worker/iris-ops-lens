/// Read-only JSON endpoints used by the IRIS Ops Lens UI.
///
/// The UI reads the built-in /api/mgmnt and /api/monitor services directly.
/// This small endpoint provides a safe, authenticated server snapshot without
/// exposing passwords, secrets, or configuration values.
Class IRISOps.REST Extends %CSP.REST
{

Parameter HandleCorsRequest = 1;
Parameter CONTENTTYPE = "application/json";

XData UrlMap [ XMLNamespace = "http://www.intersystems.com/urlmap" ]
{
<Routes>
  <Route Url="/summary" Method="GET" Call="Summary" />
  <Route Url="/about" Method="GET" Call="About" />
</Routes>
}

ClassMethod Summary() As %Status
{
  Set result = {}
  Do result.%Set("product", $ZVERSION)
  Do result.%Set("namespace", $NAMESPACE)
  Do result.%Set("user", $USERNAME)
  Do result.%Set("job", $JOB)
  Do result.%Set("roles", $ROLES)
  Do result.%Set("horolog", $HOROLOG)
  Do result.%Set("readOnly", 1)
  Set security = {}
  Do security.%Set("authenticated", $S($USERNAME'="":1,0))
  Do security.%Set("secretsExposed", 0)
  Do result.%Set("security", security)
  Write result.%ToJSON()
  Quit $$$OK
}

ClassMethod About() As %Status
{
  Set result = {
    "name": "IRIS Ops Lens",
    "version": "0.1.0",
    "mode": "read-only",
    "nativeApis": ["/api/monitor/metrics", "/api/monitor/alerts", "/api/mgmnt/", "/api/mgmnt/v2/"],
    "taskApi": "%SYS.Task / %SYS.TaskSuper"
  }
  Write result.%ToJSON()
  Quit $$$OK
}

}
