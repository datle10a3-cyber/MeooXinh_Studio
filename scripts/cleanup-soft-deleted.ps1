$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$days = if ($env:CLEANUP_DELETED_AFTER_DAYS) { [int]$env:CLEANUP_DELETED_AFTER_DAYS } else { 365 }

Set-Location $repoRoot

Write-Output "Don du lieu da xoa mem cu hon $days ngay..."
$env:SOFT_DELETE_CLEANUP_DAYS = [string]$days
node scripts/cleanup-soft-deleted.js
