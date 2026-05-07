param(
  [int]$KeepDays = 90,
  [int]$KeepCount = 90
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backupDir = Join-Path $repoRoot "backups"
$pgDump = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $backupDir "meo-xinh-postgres-$stamp.dump"

if (-not (Test-Path $pgDump)) {
  throw "Khong tim thay pg_dump tai $pgDump. Kiem tra lai duong dan cai PostgreSQL."
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = "Meoxinh_08012006"

try {
  & $pgDump `
    --host "localhost" `
    --port "5432" `
    --username "postgres" `
    --dbname "meo_xinh_studio" `
    --format "custom" `
    --file $backupFile

  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump that bai voi ma loi $LASTEXITCODE."
  }

  Write-Output "Da tao backup PostgreSQL: $backupFile"

  $cutoff = (Get-Date).AddDays(-1 * [Math]::Max(1, $KeepDays))
  Get-ChildItem -Path $backupDir -Filter "meo-xinh-postgres-*.dump" -File |
    Where-Object { $_.LastWriteTime -lt $cutoff } |
    Remove-Item -Force

  $allBackups = Get-ChildItem -Path $backupDir -Filter "meo-xinh-postgres-*.dump" -File |
    Sort-Object LastWriteTime -Descending
  if ($allBackups.Count -gt $KeepCount) {
    $allBackups | Select-Object -Skip $KeepCount | Remove-Item -Force
  }

  Write-Output "Da don backup cu. Giu toi da $KeepCount ban va $KeepDays ngay gan nhat."
} finally {
  $env:PGPASSWORD = $previousPassword
}
