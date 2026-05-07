param(
  [string]$BaseUrl = $env:SMOKE_BASE_URL,
  [string]$Email = $env:SMOKE_EMAIL,
  [string]$Password = $env:SMOKE_PASSWORD,
  [string]$WriteMode = $env:SMOKE_WRITE
)

$ErrorActionPreference = "Stop"

if ($BaseUrl) { $env:SMOKE_BASE_URL = $BaseUrl }
if ($Email) { $env:SMOKE_EMAIL = $Email }
if ($Password) { $env:SMOKE_PASSWORD = $Password }
if ($WriteMode) { $env:SMOKE_WRITE = $WriteMode }

node scripts/smoke-tests.js
