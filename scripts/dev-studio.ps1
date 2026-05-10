$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "start-postgres.ps1")
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
npx next dev --webpack -H 0.0.0.0
