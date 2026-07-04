#Requires -Version 5.1
<#
.SYNOPSIS
  Carga los 4 manuales de prueba en la base de datos (requiere Ollama + bge-m3).
.EXAMPLE
  .\scripts\seed-home.ps1
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host "=== Cargar manuales de prueba ===" -ForegroundColor Cyan
Write-Host ""

# Ollama
try {
    Invoke-WebRequest -Uri "http://127.0.0.1:11434/api/tags" -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host "[OK] Ollama responde"
} catch {
    Write-Host "[ERROR] Ollama no responde. Abre la app Ollama en Windows." -ForegroundColor Red
    exit 1
}

# .env sincronizado
if (-not (Test-Path ".env")) {
    Copy-Item ".env.home.example" ".env"
}
Copy-Item -Force ".env" "apps\api\.env"
Copy-Item -Force ".env" "apps\web\.env.local"

Write-Host ">> Generando embeddings con bge-m3 (tarda ~1 min)..."
python scripts/seed_local_manuals.py
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Fallo el seed. Comprueba que tienes el modelo bge-m3 en Ollama." -ForegroundColor Red
    Write-Host "        En Ollama descarga: bge-m3" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[OK] 4 manuales indexados." -ForegroundColor Green
Write-Host "     Reinicia la API si estaba corriendo: .\scripts\stop-all-home.ps1 && .\scripts\start-all-home.ps1"
Write-Host "     Luego prueba el chat: http://localhost:3000/chat"
