# Ejecuta la suite pytest del API dentro del contenedor Docker.
# Requiere API levantado con docker-compose.dev.yml (monta apps/api + tests).
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$PytestArgs
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Compose = @(
    "-f", (Join-Path $Root "infra\docker-compose.yml"),
    "-f", (Join-Path $Root "infra\docker-compose.dev.yml")
)

$pytestCmd = 'pip install -q ".[dev]" && python -m pytest tests'
if ($PytestArgs.Count -gt 0) {
    $escaped = ($PytestArgs | ForEach-Object { $_ -replace "'", "'\\''" }) -join ' '
    $pytestCmd += " $escaped"
}

docker compose @Compose exec -T api sh -c $pytestCmd
