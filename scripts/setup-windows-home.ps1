#Requires -Version 5.1
<#
.SYNOPSIS
  Instalacion unica en Windows (casa): Docker PostgreSQL+Redis, deps, migraciones y manuales.
.EXAMPLE
  .\scripts\setup-windows-home.ps1
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Invoke-Docker {
    param([string[]]$DockerArgs)
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    & docker @DockerArgs 2>&1 | Out-Null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    return $code
}

function Test-PortInUse([int]$Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $Port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Find-FreePort([int[]]$Candidates) {
    foreach ($p in $Candidates) {
        if (-not (Test-PortInUse $p)) { return $p }
    }
    return $null
}

function Set-EnvValue([string]$Key, [string]$Value) {
    $lines = Get-Content ".env"
    $found = $false
    $newLines = foreach ($line in $lines) {
        if ($line -match "^$([regex]::Escape($Key))=") {
            $found = $true
            "$Key=$Value"
        } else {
            $line
        }
    }
    if (-not $found) { $newLines += "$Key=$Value" }
    $newLines | Set-Content ".env" -Encoding utf8
}

Write-Host "=== Setup WikiBridge en Windows (casa) ===" -ForegroundColor Cyan
Write-Host ""

# Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker no encontrado. Instala Docker Desktop:" -ForegroundColor Red
    Write-Host "        https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}
if ((Invoke-Docker -DockerArgs @("info")) -ne 0) {
    Write-Host "[ERROR] Docker Desktop no esta corriendo." -ForegroundColor Red
    Write-Host "        1. Abre Docker Desktop desde el menu Inicio" -ForegroundColor Yellow
    Write-Host "        2. Espera a que diga 'Docker Desktop is running'" -ForegroundColor Yellow
    Write-Host "        3. Vuelve a ejecutar: .\scripts\setup-windows-home.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Docker"

# .env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.home.example" ".env"
    Write-Host "[OK] Creado .env desde .env.home.example"
}

# Buscar puertos libres (evita conflictos con otros servicios del PC)
$pgPort = Find-FreePort @(5433, 5434, 5435, 5440)
$redisPort = Find-FreePort @(6380, 6381, 6382, 6390)
$apiPort = Find-FreePort @(8000, 8001, 8002, 8080)
$webPort = Find-FreePort @(3000, 3002, 3003, 3010)

if (-not $pgPort -or -not $redisPort) {
    Write-Host "[ERROR] No hay puertos libres para PostgreSQL o Redis." -ForegroundColor Red
    exit 1
}
if (-not $apiPort -or -not $webPort) {
    Write-Host "[ERROR] No hay puertos libres para API (8000) o Web (3000)." -ForegroundColor Red
    exit 1
}

Set-EnvValue "POSTGRES_PORT" "$pgPort"
Set-EnvValue "DATABASE_URL" "postgresql+asyncpg://wikibridge:wikibridge@localhost:${pgPort}/wikibridge"
Set-EnvValue "REDIS_PORT" "$redisPort"
Set-EnvValue "REDIS_URL" "redis://localhost:${redisPort}/0"
Set-EnvValue "API_PORT" "$apiPort"
Set-EnvValue "WEB_PORT" "$webPort"
Set-EnvValue "INTERNAL_API_URL" "http://localhost:${apiPort}"

Copy-Item -Force ".env" "apps\api\.env"
Copy-Item -Force ".env" "apps\web\.env.local"
Write-Host "[OK] Puertos: PostgreSQL=$pgPort  Redis=$redisPort  API=$apiPort  Web=$webPort"

# Limpiar intento fallido previo
Invoke-Docker -DockerArgs @("compose", "-f", "infra/docker-compose.home.yml", "--env-file", ".env", "down") | Out-Null

# PostgreSQL + Redis
Write-Host ">> Levantando PostgreSQL + Redis..."
if ((Invoke-Docker -DockerArgs @("compose", "-f", "infra/docker-compose.home.yml", "--env-file", ".env", "up", "-d")) -ne 0) {
    Write-Host "[ERROR] docker compose fallo. Revisa que los puertos $pgPort y $redisPort esten libres." -ForegroundColor Red
    exit 1
}
Start-Sleep -Seconds 8
Write-Host "[OK] PostgreSQL + Redis"

# Node
if (-not (Test-Path "node_modules")) {
    Write-Host ">> npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) { exit 1 }
}
Write-Host "[OK] Node.js deps"

# Python
Write-Host ">> pip install (API)..."
python -m pip install -e "apps/api/[dev]"
if ($LASTEXITCODE -ne 0) { exit 1 }
Write-Host "[OK] Python deps"

# Migraciones
Push-Location apps/api
python -m alembic upgrade head
if ($LASTEXITCODE -ne 0) {
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "[OK] Migraciones"

# Manuales de prueba
Write-Host ">> Cargando manuales de prueba (requiere Ollama + bge-m3)..."
$ollamaOk = $false
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 3
    if ($r.StatusCode -eq 200) { $ollamaOk = $true }
} catch {}

if ($ollamaOk) {
    python scripts/seed_local_manuals.py
    if ($LASTEXITCODE -ne 0) { exit 1 }
    Write-Host "[OK] Manuales cargados"
} else {
    Write-Host "[WARN] Ollama no responde - abre la app Ollama y ejecuta:" -ForegroundColor Yellow
    Write-Host "       python scripts/seed_local_manuals.py" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Setup completo. Arranca la app con:"
Write-Host "    .\scripts\start-all-home.ps1"
Write-Host ""
Write-Host "  Web: http://localhost:${webPort}  (admin / admin)"
Write-Host "  Ollama: modelos phi3:mini y bge-m3"
Write-Host "==========================================" -ForegroundColor Green
