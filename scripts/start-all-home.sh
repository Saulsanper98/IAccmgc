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

# PostgreSQL de Homebrew en Mac
for PG_BIN in /opt/homebrew/opt/postgresql@16/bin /usr/local/opt/postgresql@16/bin; do
  if [[ -d "$PG_BIN" ]]; then
    export PATH="$PG_BIN:$PATH"
    break
  fi
done

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
port_open() {
  local port="$1"
  if command -v nc >/dev/null 2>&1; then
    nc -z localhost "$port" 2>/dev/null
  else
    (echo >/dev/tcp/localhost/"$port") 2>/dev/null
  fi
}

pg_ok=false
redis_ok=false
if command -v pg_isready >/dev/null 2>&1 && pg_isready -h localhost -p "${POSTGRES_PORT:-5432}" >/dev/null 2>&1; then
  pg_ok=true
elif port_open "${POSTGRES_PORT:-5432}"; then
  pg_ok=true
fi
if port_open "${REDIS_PORT:-6379}"; then
  redis_ok=true
fi

if [[ "$pg_ok" == false || "$redis_ok" == false ]]; then
  started=false

  # Intentar Homebrew services (Mac sin Docker)
  if command -v brew >/dev/null 2>&1; then
    echo "⬆ Intentando arrancar PostgreSQL + Redis con Homebrew..."
    brew services start postgresql@16 2>/dev/null || true
    brew services start redis 2>/dev/null || true
    sleep 4
    pg_isready -h localhost -p "${POSTGRES_PORT:-5432}" >/dev/null 2>&1 && pg_ok=true || pg_ok=false
    port_open "${REDIS_PORT:-6379}" && redis_ok=true || redis_ok=false
    [[ "$pg_ok" == true && "$redis_ok" == true ]] && started=true
  fi

  # Intentar Docker
  if [[ "$started" == false && ( "$pg_ok" == false || "$redis_ok" == false ) ]]; then
    if command -v docker >/dev/null 2>&1; then
      echo "⬆ Levantando PostgreSQL + Redis con Docker..."
      docker compose -f infra/docker-compose.home.yml --env-file .env up -d
      sleep 5
      pg_ok=false; redis_ok=false
      port_open "${POSTGRES_PORT:-5432}" && pg_ok=true
      port_open "${REDIS_PORT:-6379}" && redis_ok=true
    fi
  fi

  if [[ "$pg_ok" == false || "$redis_ok" == false ]]; then
    echo "❌ PostgreSQL o Redis no están disponibles."
    echo ""
    echo "   Ejecuta primero (solo una vez):"
    echo "     ./scripts/setup-mac-home.sh"
    echo ""
    echo "   Eso instala PostgreSQL + Redis con Homebrew (sin Docker)."
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
if ! command -v uvicorn >/dev/null 2>&1; then
  echo "❌ uvicorn no encontrado. Ejecuta: pip3 install -e \"apps/api/[dev]\""
  exit 1
fi
nohup uvicorn app.main:app --host 0.0.0.0 --port "${API_PORT:-8000}" --reload \
  > "$LOG_DIR/api.log" 2>&1 &
echo $! > "$PID_DIR/api.pid"
echo "✓ API arrancada → http://localhost:${API_PORT:-8000}  (log: .dev/logs/api.log)"

# ── 7. Worker ──
cd "$ROOT"
export PYTHONPATH="$ROOT/apps/api:$ROOT/apps/worker"
if command -v arq >/dev/null 2>&1; then
  nohup arq worker.main.WorkerSettings \
    > "$LOG_DIR/worker.log" 2>&1 &
  echo $! > "$PID_DIR/worker.pid"
  echo "✓ Worker arrancado  (log: .dev/logs/worker.log)"
else
  echo "⚠ Worker omitido (arq no instalado). El chat funciona igual."
fi

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
