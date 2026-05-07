param(
  [string]$Time = "02:00",
  [int]$KeepDays = 90,
  [int]$KeepCount = 90
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$taskName = "MeoXinhStudioDailyPostgresBackup"
$scriptPath = Join-Path $repoRoot "scripts\backup-postgres.ps1"
$argument = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -KeepDays $KeepDays -KeepCount $KeepCount"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At ([DateTime]::ParseExact($Time, "HH:mm", $null))
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Backup PostgreSQL hang ngay cho Meo Xinh Studio" -Force | Out-Null

Write-Output "Da cai backup tu dong hang ngay luc $Time. Task: $taskName"
Write-Output "Thu muc backup: $(Join-Path $repoRoot 'backups')"
