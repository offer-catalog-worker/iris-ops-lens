$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$required = @(
  "module.xml",
  "Dockerfile",
  "docker-compose.yml",
  "Installer.cls",
  "iris.script",
  "src/cls/IRISOps/REST.cls",
  "web/index.html",
  "web/css/app.css",
  "web/js/app.js",
  "README.md"
)
foreach ($file in $required) {
  $path = Join-Path $root $file
  if (-not (Test-Path -LiteralPath $path)) { throw "Missing required file: $file" }
}
node --check (Join-Path $root "web/js/app.js")
Write-Output "IRIS Ops Lens smoke checks passed."
