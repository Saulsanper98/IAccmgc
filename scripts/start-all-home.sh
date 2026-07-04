#!/usr/bin/env bash
# Arranca TODO en casa con un solo comando (API, worker, web + BD si hace falta)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEV_DIR="$ROOT/.dev"
LOG_DIR="$DEV_DIR/logs"
PID_DIR="$DEV_DIR/pids"
mkdir -p "$LOG_DIR" "$PID_DIR"

export PATH="$HOME/.local/bin:$PATH"

# ── 1. .env y symlinks ──
if [[ ! -f .env ]]; then
  cp .env.home.example .env
  echo "✓ Creado .env desde .env.home.example"
fi
ln -sf "$ROOT/.env" "$ROOT/apps/api/.env"
ln -sf "$ROOT/.env" "$ROOT/apps/web/.env.local"

set -a
# shellcheck disable=SC1091
source .env
set +a

echo "=== Arrancando WikiBridge en casa ==="
echo ""

# ── 2. Ollama ──
if ! curl -sf "${OLLAMA_BASE_URL:-http://127.0.0.1:11434}/api/tags" >/dev/null 2>&1; then
  echo "❌ Ollama no responde. Abre la app Ollama (icono en la barra de menú)."
  exit 1
fi
echo "✓ Ollama"

# ── 3. PostgreSQL + Redis ──
pg_ok=false
redis_ok=false
curl -sf "http://localhost:${POSTGRES_PORT:-5432}" >/dev/null 2>&1 || true
if command -v pg_isready >/dev/null 2>&1 && pg_isready -h localhost -p "${POSTGRES_PORT:-5432}" >/dev/null 2>&1; then
  pg_ok=true
elif nc -z localhost "${POSTGRES_PORT:-5432}" 2>/dev/null; then
  pg_ok=true
fi
if nc -z localhost "${REDIS_PORT:-6379}" 2>/dev/null || redis-cli -p "${REDIS_PORT:-6379}" ping >/dev/null 2>&1; then
  redis_ok=true
fi

if [[ "$pg_ok" == false || "$redis_ok" == false ]]; then
  if command -v docker >/dev/null 2>&1; then
    echo "⬆ Levantando PostgreSQL + Redis con Docker..."
    docker compose -f infra/docker-compose.home.yml --env-file .env up -d
    echo "   Esperando BD..."
    sleep 5
  else
    echo "❌ PostgreSQL o Redis no responden y Docker no está instalado."
    echo "   Instala Docker Desktop o PostgreSQL+Redis localmente."
    exit 1
  fi
fi
echo "✓ PostgreSQL + Redis"

# ── 4. Migraciones (primera vez) ──
if command -v alembic >/dev/null 2>&1 || [[ -x "$HOME/.local/bin/alembic" ]]; then
  (cd apps/api && alembic upgrade head) 2>/dev/null && echo "✓ Migraciones" || true
fi

# ── 5. Detener procesos previos si existen ──
"$ROOT/scripts/stop-all-home.sh" 2>/dev/null || true

# ── 6. API ──
cd "$ROOT/apps/api"
nohup uvicorn app.main:app --host 0.0.0.0 --port "${API_PORT:-8000}" --reload \
  > "$LOG_DIR/api.log" 2>&1 &
echo $! > "$PID_DIR/api.pid"
echo "✓ API arrancada → http://localhost:${API_PORT:-8000}  (log: .dev/logs/api.log)"

# ── 7. Worker ──
cd "$ROOT"
export PYTHONPATH="$ROOT/apps/api:$ROOT/apps/worker"
nohup arq worker.main.WorkerSettings \
  > "$LOG_DIR/worker.log" 2>&1 &
echo $! > "$PID_DIR/worker.pid"
echo "✓ Worker arrancado  (log: .dev/logs/worker.log)"

# ── 8. Web ──
cd "$ROOT"
nohup npm run dev:web \
  > "$LOG_DIR/web.log" 2>&1 &
echo $! > "$PID_DIR/web.pid"
echo "✓ Web arrancada → http://localhost:${WEB_PORT:-3000}  (log: .dev/logs/web.log)"

sleep 4
echo ""
echo "══════════════════════════════════════════"
echo "  Web:  http://localhost:${WEB_PORT:-3000}"
echo "  API:  http://localhost:${API_PORT:-8000}/api/health"
echo "  Login: admin / admin"
echo ""
echo "  Chat: pregunta por backup, VPN, red..."
echo ""
echo "  Ver logs:  tail -f .dev/logs/api.log"
echo "  Parar todo: ./scripts/stop-all-home.sh"
echo "══════════════════════════════════════════"
