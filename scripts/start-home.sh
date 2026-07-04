#!/usr/bin/env bash
# Arranque rápido para probar WikiBridge en casa (sin afectar Docker del trabajo)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="$HOME/.local/bin:$PATH"

if [[ ! -f .env ]]; then
  if [[ -f .env.home.example ]]; then
    cp .env.home.example .env
    echo "✓ Creado .env desde .env.home.example (solo para casa, no se sube a git)"
  else
    echo "❌ No existe .env ni .env.home.example"
    exit 1
  fi
fi

# Asegurar que web y API lean el mismo .env
ln -sf "$ROOT/.env" "$ROOT/apps/api/.env"
ln -sf "$ROOT/.env" "$ROOT/apps/web/.env.local"

echo "✓ Symlinks de .env creados"
echo ""
echo "Arranque automático (recomendado):"
echo "  ./scripts/start-all-home.sh"
echo ""
echo "O manualmente — arranca estos servicios (cada uno en una terminal):"
echo "  1. ollama serve"
echo "  2. cd apps/api && uvicorn app.main:app --reload --port 8000"
echo "  3. PYTHONPATH=apps/api:apps/worker arq worker.main.WorkerSettings"
echo "  4. npm run dev:web"
echo ""
echo "Primera vez — cargar manuales de prueba:"
echo "  python3 scripts/seed_local_manuals.py"
echo ""
echo "Web: http://localhost:3000  (admin / admin)"
echo "Chat: pregunta por backup, VPN, red interna, etc."
