# Desarrollo y tests

## Tests del API (Docker, recomendado)

La imagen de producción (`infra/Dockerfile.api`) **no incluye** `tests/` — solo copia `app/`, `alembic/` y `pyproject.toml`. Las suites registradas en Fases 2–2.5 se ejecutaron siempre **dentro del contenedor API** copiando tests a `/tmp/api-tests` con `docker cp` e instalando pytest a mano (`pip install pytest pytest-asyncio httpx`). No hubo volumen en compose ni cambio de Dockerfile; el atajo manual era reproducible pero frágil (se pierde tras `docker compose build` si no se vuelve a copiar).

### Camino reproducible (override de desarrollo)

Monta `apps/api` completo (código + tests) en el contenedor:

```bash
# Levantar stack con volumen de desarrollo en API
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d api

# Suite completa
./infra/scripts/run-api-tests.sh

# Windows (PowerShell)
.\infra\scripts\run-api-tests.ps1

# Equivalente manual
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml exec api \
  sh -c 'pip install -q ".[dev]" && python -m pytest tests -q'
```

El script instala dependencias de desarrollo (`pytest`, `pytest-asyncio`, etc.) en el contenedor y ejecuta `pytest` sobre `apps/api/tests` montado en `/app/apps/api/tests`.

### Atajo legacy (sin volumen)

Útil si solo levantaste el compose base:

```bash
docker cp apps/api/tests/. infra-api-1:/tmp/api-tests/
docker compose -f infra/docker-compose.yml exec api \
  sh -c 'pip install -q pytest pytest-asyncio httpx && python -m pytest /tmp/api-tests -q'
```

## Tests del frontend (Next.js)

Desde la raíz del monorepo:

```bash
npm install
npm run lint --workspace=apps/web
npx tsc --noEmit -p apps/web
npm run build:web
```

No hay suite de tests unitarios de frontend en el proyecto actualmente.

## Desarrollo local sin Docker

El entorno Windows/Linux local **no** tiene las dependencias del API instaladas por defecto (`ldap3`, etc.). Preferir Docker para backend y tests. Para frontend, `npm run dev:web` es suficiente.
