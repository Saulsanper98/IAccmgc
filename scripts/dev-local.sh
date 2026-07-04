#!/usr/bin/env bash
# Arranque local de WikiBridge (sin Docker)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="$HOME/.local/bin:$PATH"

if [[ ! -f .env ]]; then
  echo "Copia .env.example a .env y ajusta los valores."
  exit 1
fi

# Symlink para que pydantic encuentre .env desde apps/api
ln -sf "$ROOT/.env" "$ROOT/apps/api/.env"
# Next.js carga .env.local desde apps/web
ln -sf "$ROOT/.env" "$ROOT/apps/web/.env.local"

echo "==> Migraciones"
cd apps/api && alembic upgrade head && cd "$ROOT"

echo "==> Seed de manuales de ejemplo"
python3 scripts/seed_local_manuals.py

echo ""
echo "Servicios listos para arrancar en terminales separadas:"
echo "  1. ollama serve"
echo "  2. cd apps/api && uvicorn app.main:app --reload --port 8000"
echo "  3. PYTHONPATH=apps/api:apps/worker arq worker.main.WorkerSettings"
echo "  4. INTERNAL_API_URL=http://localhost:8000 npm run dev:web"
echo ""
echo "Web: http://localhost:3000  (admin / admin)"
echo "Ver docs/desarrollo-offline.md para más detalle."
