$ErrorActionPreference = "Stop"

$pgCtl = "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"
$pgIsReady = "C:\Program Files\PostgreSQL\16\bin\pg_isready.exe"
$dataDir = "E:\PostgreSQL\data-meoxinh"
$logDir = Join-Path (Resolve-Path (Join-Path $PSScriptRoot "..")).Path "logs"
$logFile = Join-Path $logDir "postgresql-meoxinh.log"
$pidFile = Join-Path $dataDir "postmaster.pid"

function Test-PostgresReady {
  if (!(Test-Path $pgIsReady)) {
    return $false
  }

  & $pgIsReady -h localhost -p 5432 *> $null
  return $LASTEXITCODE -eq 0
}

function Remove-StalePidFile {
  if (!(Test-Path $pidFile)) {
    return
  }

  if (Test-PostgresReady) {
    return
  }

  $pidLine = Get-Content $pidFile -TotalCount 1 -ErrorAction SilentlyContinue
  $postgresPid = 0
  [void][int]::TryParse($pidLine, [ref]$postgresPid)
  $process = if ($postgresPid -gt 0) { Get-Process -Id $postgresPid -ErrorAction SilentlyContinue } else { $null }

  if ($null -eq $process) {
    Remove-Item -LiteralPath $pidFile -Force
    Write-Output "Da don file khoa PostgreSQL cu bi ket."
  }
}

if (!(Test-Path $pgCtl)) {
  throw "Khong tim thay pg_ctl.exe tai $pgCtl"
}

if (!(Test-Path $dataDir)) {
  throw "Khong tim thay thu muc du lieu PostgreSQL tai $dataDir"
}

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

if (Test-PostgresReady) {
  Write-Output "PostgreSQL dang chay."
  exit 0
}

Remove-StalePidFile

& $pgCtl status -D $dataDir *> $null
if ($LASTEXITCODE -eq 0) {
  Write-Output "PostgreSQL dang chay."
  exit 0
}

& $pgCtl start -D $dataDir -l $logFile
if ($LASTEXITCODE -ne 0) {
  throw "Khong khoi dong duoc PostgreSQL. Hay kiem tra log tai $logFile"
}

for ($i = 0; $i -lt 20; $i++) {
  if (Test-PostgresReady) {
    Write-Output "PostgreSQL da san sang."
    exit 0
  }
  Start-Sleep -Milliseconds 500
}

throw "PostgreSQL da start nhung chua san sang o localhost:5432. Hay kiem tra log tai $logFile"
