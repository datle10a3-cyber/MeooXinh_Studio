param(
  [Parameter(Mandatory = $true)]
  [int]$Year,

  [Parameter(Mandatory = $true)]
  [string]$StudioId
)

$ErrorActionPreference = "Stop"

node scripts/archive-year.js $Year $StudioId
