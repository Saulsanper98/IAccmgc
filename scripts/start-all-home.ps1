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

# Puertos por defecto
$pgPort = 5433
$redisPort = 6380
$apiPort = 8000
$webPort = 3000

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

function Load-EnvPorts {
    if (-not (Test-Path ".env")) { return }
    Get-Content ".env" -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if ($line -match '^POSTGRES_PORT=(.+)$') { $script:pgPort = [int]$Matches[1].Trim() }
        if ($line -match '^REDIS_PORT=(.+)$') { $script:redisPort = [int]$Matches[1].Trim() }
        if ($line -match '^API_PORT=(.+)$') { $script:apiPort = [int]$Matches[1].Trim() }
        if ($line -match '^WEB_PORT=(.+)$') { $script:webPort = [int]$Matches[1].Trim() }
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
        [string]$Arguments,
        [string]$WorkDir
    )
    $logOut = Join-Path $LogDir "$Name.log"
    $logErr = Join-Path $LogDir "$Name.err"
    $proc = Start-Process `
        -FilePath $Exe `
        -ArgumentList $Arguments `
        -WorkingDirectory $WorkDir `
        -WindowStyle Hidden `
        -RedirectStandardOutput $logOut `
        -RedirectStandardError $logErr `
        -PassThru
    $proc.Id | Out-File -FilePath (Join-Path $PidDir "$Name.pid") -Encoding ascii -NoNewline
}

Write-Host "=== Arrancando WikiBridge en casa (Windows) ===" -ForegroundColor Cyan
Write-Host ""

Sync-Env
Load-EnvPorts

Write-Host "[INFO] Puertos: API=$apiPort  Web=$webPort  PG=$pgPort  Redis=$redisPort"

# Resolver python
$pythonExe = (Get-Command python -ErrorAction Stop).Source

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
Write-Host "[OK] PostgreSQL + Redis"

# Parar previos
$stopScript = Join-Path $Root "scripts\stop-all-home.ps1"
if (Test-Path $stopScript) {
    & $stopScript 2>$null
}

# API
$apiDir = Join-Path $Root "apps\api"
Start-DevProcess -Name "api" -Exe $pythonExe `
    -Arguments "-m uvicorn app.main:app --host 0.0.0.0 --port $apiPort --reload" `
    -WorkDir $apiDir
Write-Host "[OK] API -> http://localhost:${apiPort}"

# Worker
$env:PYTHONPATH = "$Root\apps\api;$Root\apps\worker"
Start-DevProcess -Name "worker" -Exe $pythonExe `
    -Arguments "-m arq worker.main.WorkerSettings" `
    -WorkDir $Root
Write-Host "[OK] Worker"

# Web (npx en Windows es un .cmd — hay que usar cmd.exe)
$webDir = Join-Path $Root "apps\web"
Start-DevProcess -Name "web" -Exe "cmd.exe" `
    -Arguments "/c npx next dev --port $webPort" `
    -WorkDir $webDir
Write-Host "[OK] Web -> http://localhost:${webPort}"

Start-Sleep -Seconds 8
Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Web:   http://localhost:${webPort}"
Write-Host "  API:   http://localhost:${apiPort}/api/health"
Write-Host "  Login: admin / admin"
Write-Host ""
Write-Host "  Chat:  Como hago un backup de servidores?"
Write-Host ""
Write-Host "  Logs:  Get-Content .dev\logs\api.log -Tail 20"
Write-Host "  Parar: .\scripts\stop-all-home.ps1"
Write-Host "==========================================" -ForegroundColor Green
