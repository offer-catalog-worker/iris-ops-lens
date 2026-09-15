$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$required = @(
  "module.xml",
  "Dockerfile",
  "docker-compose.yml",
  "Installer.cls",
  "iris.script",
  "src/cls/IRISOps/REST.cls",
  "tests/iris-smoke.script",
  "tests/management.test.cjs",
  "web/index.html",
  "web/css/app.css",
  "web/css/workspace.css",
  "web/js/app.js",
  "web/js/management.js",
  "README.md"
)
foreach ($file in $required) {
  $path = Join-Path $root $file
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing required file: $file" }
}
node --check (Join-Path $root "web/js/app.js")
node --check (Join-Path $root "web/js/management.js")
node --test (Join-Path $root "tests/app.test.cjs") (Join-Path $root "tests/management.test.cjs")
if ($LASTEXITCODE -ne 0) { throw "Browser behavior tests failed." }
Write-Output "IRIS Ops Lens smoke checks passed."
