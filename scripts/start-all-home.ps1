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

function Invoke-Docker {
    param([string[]]$DockerArgs)
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    & docker @DockerArgs 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    return $code
}

function Sync-Env {
    if (-not (Test-Path ".env")) {
        Copy-Item ".env.home.example" ".env"
        Write-Host "[OK] Creado .env"
    }
    Copy-Item -Force ".env" "apps\api\.env"
    Copy-Item -Force ".env" "apps\web\.env.local"
}

function Read-EnvPorts {
    $script:pgPort = 5433
    $script:redisPort = 6380
    $script:apiPort = 8000
    $script:webPort = 3000
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^POSTGRES_PORT=(.+)$') { $script:pgPort = [int]$Matches[1] }
        if ($_ -match '^REDIS_PORT=(.+)$') { $script:redisPort = [int]$Matches[1] }
        if ($_ -match '^API_PORT=(.+)$') { $script:apiPort = [int]$Matches[1] }
        if ($_ -match '^WEB_PORT=(.+)$') { $script:webPort = [int]$Matches[1] }
    }
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
Read-EnvPorts

# Ollama
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 3 | Out-Null
    Write-Host "[OK] Ollama"
} catch {
    Write-Host "[ERROR] Ollama no responde. Abre la app Ollama en Windows." -ForegroundColor Red
    exit 1
}

# Docker BD
if (-not (Test-PortOpen $pgPort) -or -not (Test-PortOpen $redisPort)) {
    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-Host ">> Levantando PostgreSQL + Redis..."
        Invoke-Docker -DockerArgs @("compose", "-f", "infra/docker-compose.home.yml", "--env-file", ".env", "up", "-d") | Out-Null
        Start-Sleep -Seconds 6
    }
}
if (-not (Test-PortOpen $pgPort)) {
    Write-Host "[ERROR] PostgreSQL no responde en puerto $pgPort. Ejecuta: .\scripts\setup-windows-home.ps1" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] PostgreSQL + Redis (puertos $pgPort / $redisPort)"

# Parar previos
$stopScript = Join-Path $Root "scripts\stop-all-home.ps1"
if (Test-Path $stopScript) {
    & $stopScript 2>$null
}

# API
Start-DevProcess -Name "api" -Exe "python" -Args @(
    "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "$apiPort", "--reload"
) -WorkDir (Join-Path $Root "apps\api") | Out-Null
Write-Host "[OK] API -> http://localhost:${apiPort}  (log: .dev\logs\api.log)"

# Worker
$env:PYTHONPATH = "$Root\apps\api;$Root\apps\worker"
if (Get-Command arq -ErrorAction SilentlyContinue) {
    Start-DevProcess -Name "worker" -Exe "arq" -Args @("worker.main.WorkerSettings") | Out-Null
    Write-Host "[OK] Worker  (log: .dev\logs\worker.log)"
} else {
    Write-Host "[WARN] Worker omitido (arq no instalado). El chat funciona igual."
}

# Web
Start-DevProcess -Name "web" -Exe "npx" -Args @(
    "next", "dev", "--port", "$webPort"
) -WorkDir (Join-Path $Root "apps\web") | Out-Null
Write-Host "[OK] Web -> http://localhost:${webPort}  (log: .dev\logs\web.log)"

Start-Sleep -Seconds 6
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Web:   http://localhost:${webPort}"
Write-Host "  API:   http://localhost:${apiPort}/api/health"
Write-Host "  Login: admin / admin"
Write-Host ""
Write-Host "  Chat:  Como hago un backup de servidores?"
Write-Host ""
Write-Host "  Parar: .\scripts\stop-all-home.ps1"
Write-Host "==========================================" -ForegroundColor Green
