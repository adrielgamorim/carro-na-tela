# Schedules the daily catalog update (npm run daily) in the Windows Task
# Scheduler for the current user. Run again to change the time.
#
#   powershell -ExecutionPolicy Bypass -File scripts/schedule-daily.ps1 [-At 01:00]
#   npm run unschedule:daily   (or: ... schedule-daily.ps1 -Remove)
#
# If the computer is off at that time, the task runs as soon as it is on again.
# Output: logs/daily-<date>.log.

param(
  [string]$At = "01:00",
  [switch]$Remove
)

$ErrorActionPreference = "Stop"
$taskName = "Carro na tela - catalogo diario"

if ($Remove) {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  Write-Output "Tarefa '$taskName' removida."
  exit 0
}

$project = Split-Path -Parent $PSScriptRoot
$node = (Get-Command node).Source

$action = New-ScheduledTaskAction -Execute $node `
  -Argument "scripts/catalog/daily.ts" -WorkingDirectory $project
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Hours 12) -MultipleInstances IgnoreNew `
  -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
  -Settings $settings -Description "crawl:fipe + build:catalog ($project)" -Force | Out-Null

Write-Output "Tarefa '$taskName' agendada todo dia as $At (node: $node)."
Write-Output "Rodar agora: Start-ScheduledTask -TaskName '$taskName'"
