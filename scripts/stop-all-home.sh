#!/usr/bin/env bash
# Para todos los servicios arrancados con start-all-home.sh
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$ROOT/.dev/pids"

stop_pid() {
  local name="$1"
  local file="$PID_DIR/${name}.pid"
  if [[ -f "$file" ]]; then
    local pid
    pid=$(cat "$file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      echo "✓ $name detenido (PID $pid)"
    fi
    rm -f "$file"
  fi
}

stop_pid api
stop_pid worker
stop_pid web
echo "Listo."
