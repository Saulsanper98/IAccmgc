# Desarrollo offline (sin Wiki.js)

Guía para probar WikiBridge cuando no tienes acceso a la red corporativa ni a la instancia de Wiki.js.

## Requisitos

- Node.js 20+
- Python 3.12+
- PostgreSQL 16 con extensión `pgvector`
- Redis 7
- Ollama con modelos `bge-m3` y `qwen2.5:3b-instruct`

## Arranque rápido

```bash
# 1. Copiar configuración local
cp .env.example .env
# Editar .env: DATABASE_URL, REDIS_URL, OLLAMA_BASE_URL e INTERNAL_API_URL apuntando a localhost
# IMPORTANTE: INTERNAL_SERVICE_TOKEN debe ser el mismo en web y API (valor dev: wikibridge-internal-dev-token)

# 2. Setup (symlinks + migraciones + seed)
./scripts/dev-local.sh
ollama serve
cd apps/api && uvicorn app.main:app --reload --port 8000
PYTHONPATH=apps/api:apps/worker arq worker.main.WorkerSettings
npm run dev:web
# (Next.js lee .env.local — el script dev-local.sh crea el symlink automáticamente)
```

## Acceso

| Recurso | URL | Credenciales |
|---------|-----|--------------|
| Web | http://localhost:3000 | admin / admin |
| API health | http://localhost:8000/api/health | — |
| Admin ingesta | http://localhost:3000/admin | admin / admin |

## Manuales de ejemplo incluidos

El script `scripts/seed_local_manuals.py` carga 4 páginas ficticias de CCMGC:

| Página | Ruta wiki | Tags |
|--------|-----------|------|
| Procedimiento de backup de servidores | `sistemas/procedimientos/backup-servidores` | procedimiento, backup |
| Configuración de red interna | `sistemas/referencias/configuracion-red` | referencia, red, dns |
| Guía de acceso VPN | `sistemas/guias/acceso-vpn` | guia, vpn |
| Runbook: Reinicio de servicios | `sistemas/runbooks/reinicio-servicios` | runbook, incidentes |

Los archivos markdown están en `scripts/fixtures/manuals/`. Puedes editarlos y volver a ejecutar el seed:

```bash
python scripts/seed_local_manuals.py          # actualiza cambios
python scripts/seed_local_manuals.py --clear  # borra y recarga
```

## Qué probar sin Wiki.js

### Chat RAG
Preguntas sugeridas:
- "¿Cómo hago un backup de servidores?"
- "¿Cuáles son las subredes de la red interna?"
- "¿Cómo me conecto a la VPN?"
- "¿Cómo reinicio Wiki.js?"

### Salud documental
En `/salud` → **Escanear ahora**. Los detectores analizarán los manuales seed (enlaces internos, antigüedad, etc.).

### Runbooks
1. Ir a `/runbooks`
2. Crear runbook desde la página "Runbook: Reinicio de servicios críticos"
3. Publicar y ejecutar el checklist

### Admin
En `/admin` verás las 4 páginas indexadas. La sincronización con Wiki.js fallará sin red — es normal.

## Cuando vuelvas a la oficina

1. Configura `WIKIJS_URL` y `WIKIJS_API_KEY` en `.env`
2. Desde `/admin` → **Sincronización completa**
3. Las páginas reales de Wiki.js reemplazarán o convivirán con las seed (IDs negativos vs positivos)

## Notas

- Las páginas seed usan `wikijs_page_id` negativos (-1 a -4) para no colisionar con IDs reales de Wiki.js.
- Los enlaces en los manuales apuntan a rutas ficticias (`*.ejemplo.interno`) — útiles para probar detectores de enlaces rotos.
- Sin Ollama, el chat y los embeddings no funcionarán; el resto de la UI sí carga.

## Error "No autorizado" en Admin / Salud / Runbooks

La web y la API comparten un token interno (`INTERNAL_SERVICE_TOKEN`). Si no coinciden, verás `{"detail":"No autorizado"}`.

**Solución:**
1. En tu `.env` raíz, asegúrate de tener: `INTERNAL_SERVICE_TOKEN=wikibridge-internal-dev-token`
2. Ejecuta `./scripts/dev-local.sh` (crea symlinks para que web y API lean el mismo `.env`)
3. Reinicia el servidor web (`npm run dev:web`)
