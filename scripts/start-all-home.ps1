#Requires -Version 5.1
<#
.SYNOPSIS
  Arranca API, worker y web en Windows (casa).
.EXAMPLE
  .\scripts\start-all-home.ps1
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$DevDir = Join-Path $Root ".dev"
$LogDir = Join-Path $DevDir "logs"
$PidDir = Join-Path $DevDir "pids"
New-Item -ItemType Directory -Force -Path $LogDir, $PidDir | Out-Null

function Sync-Env {
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.home.example" ".env"
        Write-Host "✓ Creado .env"
    }
    Copy-Item -Force ".env" "apps\api\.env"
    Copy-Item -Force ".env" "apps\web\.env.local"
}

function Test-PortOpen([int]$Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Start-DevProcess {
    param(
        [string]$Name,
        [string]$Exe,
        [string[]]$Args,
        [string]$WorkDir = $Root
    )
    $logOut = Join-Path $LogDir "$Name.log"
    $logErr = Join-Path $LogDir "$Name.err"
    $proc = Start-Process -FilePath $Exe -ArgumentList $Args `
        -WorkingDirectory $WorkDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $logOut `
        -RedirectStandardError $logErr `
        -PassThru
    $proc.Id | Out-File -FilePath (Join-Path $PidDir "$Name.pid") -Encoding ascii -NoNewline
    return $proc
}

Write-Host "=== Arrancando WikiBridge en casa (Windows) ===" -ForegroundColor Cyan
Write-Host ""

Sync-Env

# Ollama
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 3 | Out-Null
    Write-Host "✓ Ollama"
} catch {
    Write-Host "❌ Ollama no responde. Abre la app Ollama en Windows." -ForegroundColor Red
    exit 1
}

# Docker BD
if (-not (Test-PortOpen 5432) -or -not (Test-PortOpen 6379)) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host "⬆ Levantando PostgreSQL + Redis..."
        docker compose -f infra/docker-compose.home.yml --env-file .env up -d
        Start-Sleep -Seconds 5
    }
}
if (-not (Test-PortOpen 5432)) {
    Write-Host "❌ PostgreSQL no responde. Ejecuta primero: .\scripts\setup-windows-home.ps1" -ForegroundColor Red
    exit 1
}
Write-Host "✓ PostgreSQL + Redis"

# Parar previos
& (Join-Path $Root "scripts\stop-all-home.ps1") 2>$null

# API
Start-DevProcess -Name "api" -Exe "python" -Args @(
    "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"
) -WorkDir (Join-Path $Root "apps\api") | Out-Null
Write-Host "✓ API → http://localhost:8000  (log: .dev\logs\api.log)"

# Worker
$env:PYTHONPATH = "$Root\apps\api;$Root\apps\worker"
if (Get-Command arq -ErrorAction SilentlyContinue) {
    Start-DevProcess -Name "worker" -Exe "arq" -Args @("worker.main.WorkerSettings") | Out-Null
    Write-Host "✓ Worker  (log: .dev\logs\worker.log)"
} else {
    Write-Host "⚠ Worker omitido (arq no instalado). El chat funciona igual."
}

# Web — npm necesita cmd en Windows
Start-DevProcess -Name "web" -Exe "npm" -Args @("run", "dev:web") | Out-Null
Write-Host "✓ Web → http://localhost:3000  (log: .dev\logs\web.log)"

Start-Sleep -Seconds 6
Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
Write-Host "  Web:   http://localhost:3000"
Write-Host "  API:   http://localhost:8000/api/health"
Write-Host "  Login: admin / admin"
Write-Host ""
Write-Host "  Chat:  ¿Cómo hago un backup de servidores?"
Write-Host ""
Write-Host "  Parar: .\scripts\stop-all-home.ps1"
Write-Host "══════════════════════════════════════════" -ForegroundColor Green
