#Requires -Version 5.1
<#
.SYNOPSIS
  Descarga modelos Ollama necesarios para WikiBridge en casa (via API HTTP).
.EXAMPLE
  .\scripts\pull-ollama-models.ps1
#>
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$OllamaUrl = "http://127.0.0.1:11434"
$ChatModel = "phi3:mini"
$EmbedModel = "bge-m3"

if (Test-Path ".env") {
    Get-Content ".env" -Encoding UTF8 | ForEach-Object {
        if ($_ -match '^OLLAMA_BASE_URL=(.+)$') { $OllamaUrl = $Matches[1].Trim().TrimEnd('/') }
        if ($_ -match '^CHAT_MODEL=(.+)$') { $ChatModel = $Matches[1].Trim() }
        if ($_ -match '^EMBEDDING_MODEL=(.+)$') { $EmbedModel = $Matches[1].Trim() }
    }
}

Write-Host "=== Descargar modelos Ollama ===" -ForegroundColor Cyan
Write-Host "URL: $OllamaUrl"
Write-Host ""

# Comprobar Ollama
try {
    $tags = Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -Method Get -TimeoutSec 5
} catch {
    Write-Host "[ERROR] Ollama no responde. Abre la app Ollama en Windows." -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Ollama responde"

function Test-ModelInstalled([string]$Name, $Models) {
    $base = $Name.Split(':')[0]
    foreach ($m in $Models) {
        if ($m.name -eq $Name -or $m.name.Split(':')[0] -eq $base) { return $true }
    }
    return $false
}

function Pull-OllamaModel([string]$Name) {
    Write-Host ""
    Write-Host ">> Descargando $Name (puede tardar varios minutos)..." -ForegroundColor Yellow
    $body = @{ name = $Name } | ConvertTo-Json
    try {
        $response = Invoke-WebRequest -Uri "$OllamaUrl/api/pull" -Method Post `
            -Body $body -ContentType "application/json" -TimeoutSec 3600
        $lines = $response.Content -split "`n"
        foreach ($line in $lines) {
            if (-not $line.Trim()) { continue }
            try {
                $chunk = $line | ConvertFrom-Json
                $status = $chunk.status
                if ($status -match "pulling|downloading") {
                    if ($chunk.total) {
                        $pct = [math]::Floor($chunk.completed / $chunk.total * 100)
                        Write-Host "   $status ${pct}%" -NoNewline "`r"
                    }
                }
            } catch {}
        }
        Write-Host ""
        Write-Host "[OK] $Name instalado" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] No se pudo descargar $Name : $_" -ForegroundColor Red
        exit 1
    }
}

$installed = $tags.models

if (-not (Test-ModelInstalled $ChatModel $installed)) {
    Pull-OllamaModel $ChatModel
} else {
    Write-Host "[OK] Chat $ChatModel ya instalado"
}

if (-not (Test-ModelInstalled $EmbedModel $installed)) {
    Pull-OllamaModel $EmbedModel
} else {
    Write-Host "[OK] Embeddings $EmbedModel ya instalado"
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "  Modelos listos. Siguiente paso:"
Write-Host "    .\scripts\seed-home.ps1"
Write-Host "==========================================" -ForegroundColor Green
