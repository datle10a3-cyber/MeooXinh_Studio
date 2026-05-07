$ErrorActionPreference = "Stop"

$pgCtl = "C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe"
$dataDir = "E:\PostgreSQL\data-meoxinh"

if (!(Test-Path $pgCtl)) {
  throw "Không tìm thấy pg_ctl.exe tại $pgCtl"
}

if (!(Test-Path $dataDir)) {
  throw "Không tìm thấy data directory PostgreSQL tại $dataDir"
}

& $pgCtl status -D $dataDir *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Output "PostgreSQL chưa chạy."
  exit 0
}

& $pgCtl stop -D $dataDir -m fast
