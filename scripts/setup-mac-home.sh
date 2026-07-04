#!/usr/bin/env bash
# Instalación única en Mac (sin Docker): PostgreSQL + Redis + pgvector vía Homebrew
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== Setup WikiBridge en Mac (Homebrew) ==="
echo ""

if ! command -v brew >/dev/null 2>&1; then
  echo "❌ Homebrew no está instalado."
  echo "   Instálalo desde https://brew.sh y vuelve a ejecutar este script."
  exit 1
fi

echo "⬇ Instalando PostgreSQL 16, Redis y pgvector (puede tardar unos minutos)..."
brew install postgresql@16 redis pgvector

# Añadir postgres al PATH (Apple Silicon y Intel)
for PG_BIN in /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
  if [[ -d "$PG_BIN" ]]; then
    export PATH="$PG_BIN:$PATH"
    break
  fi
done

echo "⬆ Arrancando servicios..."
brew services start postgresql@16
brew services start redis

echo "   Esperando PostgreSQL..."
for i in $(seq 1 30); do
  if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "❌ PostgreSQL no arrancó. Prueba: brew services restart postgresql@16"
  exit 1
fi

echo "⬆ Creando base de datos wikibridge..."
# Usuario y BD (idempotente)
psql postgres -tc "SELECT 1 FROM pg_roles WHERE rolname='wikibridge'" | grep -q 1 \
  || psql postgres -c "CREATE USER wikibridge WITH PASSWORD 'wikibridge' CREATEDB;"
psql postgres -tc "SELECT 1 FROM pg_database WHERE datname='wikibridge'" | grep -q 1 \
  || psql postgres -c "CREATE DATABASE wikibridge OWNER wikibridge;"
psql -d wikibridge -c "CREATE EXTENSION IF NOT EXISTS vector;"

# .env
if [[ ! -f .env ]]; then
  cp .env.home.example .env
  echo "✓ Creado .env"
fi
ln -sf "$ROOT/.env" "$ROOT/apps/api/.env"
ln -sf "$ROOT/.env" "$ROOT/apps/web/.env.local"

echo ""
echo "✓ PostgreSQL + Redis listos"
echo ""
echo "Siguiente paso:"
echo "  pip3 install -e \"apps/api/[dev]\"   # si no lo hiciste antes"
echo "  npm install                         # si no lo hiciste antes"
echo "  python3 scripts/seed_local_manuals.py # manuales de prueba"
echo "  ./scripts/start-all-home.sh         # arrancar todo"
echo ""
