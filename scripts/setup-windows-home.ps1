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

Write-Host "=== Setup WikiBridge en Windows (casa) ===" -ForegroundColor Cyan
Write-Host ""

# Docker
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "[ERROR] Docker no encontrado. Instala Docker Desktop:" -ForegroundColor Red
    Write-Host "        https://www.docker.com/products/docker-desktop/" -ForegroundColor Yellow
    exit 1
}
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker Desktop no esta corriendo. Abrelo y espera a que inicie." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Docker"

# .env
if (-not (Test-Path ".env")) {
    Copy-Item ".env.home.example" ".env"
    Write-Host "[OK] Creado .env desde .env.home.example"
}
Copy-Item -Force ".env" "apps\api\.env"
Copy-Item -Force ".env" "apps\web\.env.local"
Write-Host "[OK] .env copiado a apps/api y apps/web"

# PostgreSQL + Redis
Write-Host ">> Levantando PostgreSQL + Redis..."
docker compose -f infra/docker-compose.home.yml --env-file .env up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] docker compose fallo" -ForegroundColor Red
    exit 1
}
Start-Sleep -Seconds 6
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
Write-Host "  Ollama: modelos phi3:mini y bge-m3"
Write-Host "==========================================" -ForegroundColor Green
