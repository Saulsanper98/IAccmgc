# WikiBridge — Estado de la aplicación y hoja de ruta

> **Organización:** CCMGC · Equipo de Sistemas  
> **Última actualización:** julio 2026  
> **Entorno objetivo:** 100 % on-premise, inferencia local vía Ollama (CPU)

---

## 1. Qué es WikiBridge

WikiBridge es la capa operativa sobre Wiki.js: convierte documentación estática en conocimiento accionable para el equipo de Sistemas. No sustituye la wiki; la **indexa**, la **consulta**, la **vigila** y la **operacionaliza**.

Tres pilares del producto:

| Pilar | Qué resuelve | Ruta principal |
|-------|----------------|----------------|
| **Chat RAG** | Respuestas en español con citas a páginas wiki | `/chat` |
| **Salud documental** | Obsolescencia, enlaces rotos, contradicciones, páginas huérfanas | `/salud` |
| **Runbooks** | Procedimientos como checklists ejecutables con trazabilidad | `/runbooks` |

Complementos transversales: **ingesta** desde Wiki.js, **panel de administración**, **instrucciones persistentes** del asistente y **circuito de aprendizaje** (Q&A validados a partir del feedback del chat).

---

## 2. Estado actual — resumen ejecutivo

La aplicación está **operativa en entorno Docker** (`web` :3000, `api` :8000) con autenticación local de desarrollo y conexión a Ollama + Wiki.js reales del CCMGC.

| Área | Estado | Notas |
|------|--------|-------|
| Infraestructura (compose, Postgres, Redis, worker) | ✅ En producción interna | Ver `infra/docker-compose.yml` |
| Ingesta Wiki.js → chunks + embeddings | ✅ | Sync manual e incremental desde Admin |
| Chat RAG (SSE, citas, historial) | ✅ | Búsqueda híbrida pgvector + tsvector + RRF |
| Instrucciones del asistente (usuario + equipo) | ✅ | Inyectadas en system prompt |
| Feedback 👍/👎 y Q&A validados | ✅ | Flujo completo admin + badge en chat |
| Salud documental (5 detectores) | ✅ | Escaneo manual y vía worker |
| Runbooks (editor, ejecución, sesiones) | ✅ | Generación asistida desde páginas wiki |
| Auth LDAP (API) | ✅ Implementado | NextAuth + ruta `/auth/ldap`; prod según despliegue |
| Auth local (dev) | ✅ | `AUTH_MODE=local` |
| UI / design system | ✅ Maduro | Tokens, shell, chat, admin, accesibilidad base |
| Tests API automatizados | ✅ 69 tests | `infra/scripts/run-api-tests.ps1` |
| Tests frontend automatizados | ⚠️ Solo lint + tsc + build | Sin suite unitaria de componentes |
| Drift vs infraestructura real (Fase B) | 📋 Solo diseño | Ver `docs/fase-b-drift.md` |

---

## 3. Arquitectura en una página

```
Usuario → Next.js 15 (apps/web)
            ↳ proxies REST/SSE + NextAuth
          FastAPI (apps/api)
            ↳ PostgreSQL 16 + pgvector + tsvector (es)
            ↳ Redis (cache embeddings, cola arq)
            ↳ Ollama (chat + embeddings, fuera del compose)
          Worker arq (apps/worker)
            ↳ ingesta, sync incremental programada, health scan
          Wiki.js GraphQL (solo ingesta)
```

Decisiones clave (detalle en `docs/architecture.md`):

- **Monorepo** `apps/` + `packages/shared`
- **Sin LangChain**: RAG propio, depurable
- **SSE obligatorio** en chat (latencia CPU)
- **Modelos por defecto:** `qwen2.5` (chat), `bge-m3` 1024d (embeddings)
- **Roles:** `admin`, `editor`, `lector` — validados en API

---

## 4. Módulos implementados

### 4.1 Ingesta y administración

- Sincronización **completa** e **incremental** desde Wiki.js.
- Chunking ~300–600 tokens con solapamiento; embeddings en worker.
- Panel **Admin** (`/admin`): trabajos recientes, páginas indexadas, acciones de sync.
- API: `/api/admin/ingest/*`

### 4.2 Chat RAG

**Backend**

- Conversaciones CRUD, streaming SSE por mensaje.
- Búsqueda híbrida semántica + léxica (RRF), cache Redis de embeddings de consulta.
- Rutas especiales sin LLM completo:
  - **Diario del día** (detección de fecha/departamento en la pregunta).
  - Consultas sobre **última ingesta**.
- **Instrucciones** personales y de equipo en system prompt (`005_chat_instructions`).
- **Feedback** `up`/`down` con corrección opcional → promoción a Q&A pendiente.
- **Q&A validados** (`006_validated_qa`): embedding + verificador LLM; modo **direct** (default) devuelve la respuesta almacenada sin generación LLM; modo **inject** (legacy) la inyecta en el system prompt; metadata persistida en mensajes (`used_validated_qa`).

**Frontend**

- Workspace de chat con sidebar de historial, streaming, citas, export Markdown.
- Feedback inline (👍 confirmación sutil; 👎 panel + corrección).
- Badge **«✓ Respuesta validada por el equipo · {fecha}»** en mensajes que usan Q&A validado.
- Modal de instrucciones del asistente (equipo / personales).
- Shell lateral **inteligente**: contraído por defecto, se expande al pasar el ratón.

### 4.3 Salud documental

Detectores activos:

| Detector | Qué detecta |
|----------|-------------|
| `age` | Páginas sin actualizar |
| `broken_links` | Enlaces rotos internos/externos |
| `orphan` | Páginas sin enlaces entrantes |
| `contradiction` | Posibles contradicciones entre chunks |
| `version_citation` | Referencias a versiones obsoletas |

UI en `/salud`: score, findings, triaje (resolver/descartar), escaneo bajo demanda.

### 4.4 Runbooks

- Creación desde página wiki, editor, publicación.
- Ejecución paso a paso con sesiones, undo y finish.
- Rutas API bajo `/api/runbooks/*` y UI en `/runbooks`.

### 4.5 Conocimiento validado (admin)

- Pestañas **Pendientes / Validados / Rechazados**.
- Editar pregunta y respuesta, validar, rechazar, eliminar (con confirmación).
- Contador de pendientes en navegación Admin (sidebar expandido).
- Proxies Next.js: `/api/admin/validated-qa/*`

**Convención de formato en `answer`:** el chat renderiza la respuesta con Markdown GFM (`react-markdown` + `remark-gfm`). No hay sanitizado previo del texto; los mensajes del asistente pasan tal cual al parser. Implicaciones para curación:

- `_texto_` / `*texto*` → cursiva (rompe nombres como `zabbix-release_*.deb`).
- Saltos de línea simples dentro de un párrafo se colapsan.
- Listas numeradas `1.` + bloques ` ``` ` en la misma respuesta: remark puede indentar el fence y tratar líneas siguientes como código; preferir **`**Paso N.**`** en lugar de `1.`.
- Bloques ` ```bash ` → texto literal, botón copiar, sin parsing markdown interno.
- Solo editar `question` (no `answer`) recalcula `question_embedding`; cambiar el `answer` no afecta al match vectorial.

Regla operativa: **comandos y fragmentos con `_`, `*`, rutas o varias líneas → siempre en bloques de código fenced.**

---

## 5. Modelo de datos (migraciones)

| Migración | Contenido |
|-----------|-----------|
| `001_initial_ingest` | Páginas, chunks, vectores, trabajos de ingesta |
| `002_chat` | Conversaciones, mensajes, feedback legacy |
| `003_health` | Findings de salud documental |
| `004_runbooks` | Runbooks, pasos, sesiones |
| `005_chat_instructions` | Instrucciones usuario/equipo |
| `006_validated_qa` | `qa_feedback`, `validated_qa`, `used_validated_qa` en mensajes |

---

## 6. Calidad y operación

### Tests backend

```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml up -d api
.\infra\scripts\run-api-tests.ps1
```

Resultado esperado: **69 tests passed**.

### Frontend

```bash
npm run lint --workspace=apps/web
npx tsc --noEmit -p apps/web
npm run build:web
```

Documentación de desarrollo: `docs/development.md`.

### Despliegue habitual

```bash
docker compose -f infra/docker-compose.yml up --build -d
```

Variables críticas en `.env`: `OLLAMA_BASE_URL`, `WIKIJS_*`, `AUTH_SECRET`, `INTERNAL_SERVICE_TOKEN`.

---

## 7. Hacia dónde vamos

### 7.1 Corto plazo (consolidación)

| Objetivo | Motivo |
|----------|--------|
| Despliegue LDAP en producción | Sustituir credenciales locales; alinear roles AD |
| Ampliar corpus indexado y revisar chunks | Mejor recall en preguntas operativas |
| Curación activa de Q&A validados | El circuito de aprendizaje solo aporta valor con entradas revisadas |
| Monitorización básica (logs, health) | Ollama lento o caído es el cuello de botella habitual en CPU |
| Documentar runbook de operación | Backup PG, rotación logs, actualización modelos Ollama |

### 7.2 Medio plazo (Fase B — drift de infraestructura)

Diseño en `docs/fase-b-drift.md`, **sin implementar**:

- Interfaz `InfraProvider` (LDAP, DNS, GLPI) read-only.
- Detector que contrasta IPs, hostnames y grupos AD citados en la wiki con la realidad.
- Findings de tipo `infra_drift` en el módulo de salud.

Beneficio: detectar documentación que describe servidores, DNS o permisos que ya no existen.

### 7.3 Medio plazo (producto)

| Línea | Descripción |
|-------|-------------|
| **Mejoras RAG** | Re-ranking, caché de respuestas, límites adaptativos por tipo de pregunta |
| **Runbooks ↔ chat** | Sugerir runbook desde una respuesta; enlazar pasos a páginas wiki |
| **Salud proactiva** | Notificaciones / informes periódicos de findings críticos |
| **OpenAPI → TypeScript** | Cliente tipado en `packages/shared` desde el esquema FastAPI |
| **Tests E2E** | Playwright sobre flujos chat + admin + salud |

### 7.4 Largo plazo (opcional)

- GPU en VM Ollama para modelos mayores (`7b`/`8b` con mejor latencia).
- Integración GLPI / inventario para enriquecer runbooks y drift.
- Multi-tenant ligero si otros equipos del CCMGC adoptan la wiki.

---

## 8. Deuda técnica y límites conocidos

| Tema | Situación |
|------|-----------|
| Tests frontend | No hay unit tests de React; regresiones visuales se detectan manualmente |
| Imagen Docker API | `tests/` no van en imagen prod; hace falta override dev para pytest |
| Latencia en CPU | Respuestas largas; SSE mitiga pero no elimina la espera |
| Verificador Q&A | Depende del LLM local; umbrales en `validated_qa_recall_threshold` |
| Modo direct Q&A | No aplica instrucciones 005 ni historial (respuesta enlatada deliberada); usar `VALIDATED_QA_MODE=inject` para rollback |
| Sidebar contraído | Badge de pendientes Admin solo visible con menú expandido (comportamiento aceptado) |
| Tabla `feedback` legacy | Mantenida; flujo nuevo usa `qa_feedback` |

---

## 9. Mapa de documentación del repo

| Documento | Contenido |
|-----------|-----------|
| `README.md` | Arranque rápido, modelos Ollama, compose |
| `docs/architecture.md` | Decisiones técnicas y diagramas |
| `docs/development.md` | Tests reproducibles, dev local |
| `docs/wikijs-api.md` | Exploración API GraphQL Wiki.js |
| `docs/fase-b-drift.md` | Diseño drift infraestructura |
| `docs/manual-de-uso.md` | **Manual de uso y mantenimiento** (operación diaria, BD, incidencias) |
| `docs/estado-y-roadmap.md` | Estado funcional y hoja de ruta (este documento) |

---

## 10. Criterio de “hecho” por fase histórica

| Fase | Entregable | Estado |
|------|------------|--------|
| 0 | Monorepo, compose, tokens UI, arquitectura | ✅ |
| 1 | Ingesta Wiki.js, worker, admin básico | ✅ |
| 2 | Chat RAG, auth, roles | ✅ |
| 3 | Salud documental | ✅ |
| 4 | Runbooks | ✅ |
| 5 | UX chat (streaming, citas, historial, accesibilidad) | ✅ |
| 6 | LDAP, instrucciones, diseño Fase B | ✅ (diseño B pendiente de código) |
| 7 | Circuito Q&A validados (backend + admin + badge) | ✅ |
| 8 | Drift infra + cliente OpenAPI + E2E | 🔜 Roadmap |

---

*WikiBridge no es un chatbot genérico: es la interfaz operativa entre la wiki del CCMGC y el día a día del equipo de Sistemas. La prioridad siguiente es consolidar en producción lo ya construido y alimentar el circuito de Q&A validados con correcciones reales del equipo.*
