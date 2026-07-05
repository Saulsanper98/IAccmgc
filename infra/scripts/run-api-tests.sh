#!/usr/bin/env sh
# Ejecuta la suite pytest del API dentro del contenedor Docker.
# Requiere API levantado con docker-compose.dev.yml (monta apps/api + tests).
set -e

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
COMPOSE="docker compose -f ${ROOT}/infra/docker-compose.yml -f ${ROOT}/infra/docker-compose.dev.yml"

${COMPOSE} exec -T api sh -c 'pip install -q ".[dev]" && python -m pytest tests "$@"' -- "$@"
