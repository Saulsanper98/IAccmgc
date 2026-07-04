#Requires -Version 5.1
<#
.SYNOPSIS
  Para API, worker y web arrancados con start-all-home.ps1
#>
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PidDir = Join-Path $Root ".dev\pids"

foreach ($name in @("api", "worker", "web")) {
    $file = Join-Path $PidDir "$name.pid"
    if (Test-Path $file) {
        $procId = (Get-Content $file -Raw).Trim()
        try {
            Stop-Process -Id ([int]$procId) -Force -ErrorAction Stop
            Write-Host "[OK] $name detenido (PID $procId)"
        } catch {
            Write-Host "[WARN] $name ya no estaba corriendo"
        }
        Remove-Item $file -Force
    }
}
Write-Host "Listo."
