#!/usr/bin/env bash
# Arranque rápido para probar WikiBridge en casa (sin afectar Docker del trabajo)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="$HOME/.local/bin:$PATH"

if [[ ! -f .env ]]; then
  echo "❌ No existe .env — copia .env.example y ajusta para localhost."
  exit 1
fi

# Asegurar que web y API lean el mismo .env
ln -sf "$ROOT/.env" "$ROOT/apps/api/.env"
ln -sf "$ROOT/.env" "$ROOT/apps/web/.env.local"

echo "✓ Symlinks de .env creados"
echo ""
echo "Arranca estos servicios (si no están ya corriendo):"
echo "  1. ollama serve"
echo "  2. cd apps/api && uvicorn app.main:app --reload --port 8000"
echo "  3. PYTHONPATH=apps/api:apps/worker arq worker.main.WorkerSettings"
echo "  4. npm run dev:web"
echo ""
echo "Web: http://localhost:3000  (admin / admin)"
echo "Chat: pregunta por backup, VPN, red interna, etc."
