# WikiBridge — Manual de uso y mantenimiento

> **Para quién es este documento:** cualquier persona del equipo de Sistemas (CCMGC) que deba **usar**, **supervisar** o **mantener** WikiBridge sin ser desarrollador.  
> **Última actualización:** julio 2026

---

## Índice

1. [Qué es WikiBridge](#1-qué-es-wikibridge)
2. [Acceso diario](#2-acceso-diario)
3. [Arrancar, parar y reiniciar](#3-arrancar-parar-y-reiniciar)
4. [Chat — consultar la wiki](#4-chat--consultar-la-wiki)
5. [Admin — ingesta y Q&A validados](#5-admin--ingesta-y-qa-validados)
6. [Salud documental](#6-salud-documental)
7. [Runbooks](#7-runbooks)
8. [Base de datos — ver y consultar](#8-base-de-datos--ver-y-consultar)
9. [Copias de seguridad](#9-copias-de-seguridad)
10. [Archivo de configuración (.env)](#10-archivo-de-configuración-env)
11. [Problemas frecuentes](#11-problemas-frecuentes)
12. [Cuándo pedir ayuda técnica](#12-cuándo-pedir-ayuda-técnica)
13. [Glosario](#13-glosario)

---

## 1. Qué es WikiBridge

WikiBridge **no sustituye** a Wiki.js. Es una capa encima que:

| Función | Qué hace en la práctica |
|---------|-------------------------|
| **Chat** | Preguntas en español con respuestas citando páginas de la wiki |
| **Salud** | Detecta documentación obsoleta, enlaces rotos, contradicciones… |
| **Runbooks** | Convierte procedimientos en checklists ejecutables |
| **Aprendizaje** | Las correcciones del equipo (👎) pueden convertirse en respuestas validadas |

**Componentes que no se ven pero deben estar activos:**

```
Navegador  →  WikiBridge (web :3000)
                 ↳ API (:8000)
                 ↳ PostgreSQL (datos)
                 ↳ Redis (cola y caché)
                 ↳ Worker (sync incremental programada, escaneos)
              Ollama (IA, en otra máquina/VM)
              Wiki.js (origen de la documentación)
```

---

## 2. Acceso diario

### URLs habituales

| Qué | URL |
|-----|-----|
| **Aplicación** | http://localhost:3000 |
| **Login** | http://localhost:3000/login |
| **Chat** | http://localhost:3000/chat |
| **Admin** | http://localhost:3000/admin |
| **Salud** | http://localhost:3000/salud |
| **Runbooks** | http://localhost:3000/runbooks |
| **Estado API** | http://localhost:8000/api/health |

> En producción interna sustituye `localhost` por el hostname del servidor donde corre Docker.

### Inicio de sesión

- **Modo desarrollo / pruebas** (`AUTH_MODE=local` en `.env`): usuario y contraseña definidos en `.env` (por defecto `admin` / `admin`).
- **Modo producción** (`AUTH_MODE=ldap`): usuario y contraseña de **Active Directory**.

### Roles

| Rol | Puede |
|-----|-------|
| **admin** | Todo: admin, ingesta, validar Q&A, escaneos de salud |
| **editor** | Chat, runbooks, feedback; según despliegue |
| **lector** | Consultar chat y runbooks |

---

## 3. Arrancar, parar y reiniciar

### Requisitos en el servidor

1. **Docker Desktop** (Windows) o Docker Engine (Linux) en ejecución.
2. **Ollama** accesible desde el contenedor API (URL en `.env` → `OLLAMA_BASE_URL`).
3. Archivo **`.env`** en la raíz del proyecto (copiado de `.env.example`).

### Comandos básicos (PowerShell)

Abre PowerShell y ve a la carpeta del proyecto:

```powershell
cd C:\Users\TécnicoSistemas\Projects\wikibridge
```

| Acción | Comando |
|--------|---------|
| **Levantar todo** | `docker compose -f infra/docker-compose.yml up -d` |
| **Levantar y reconstruir** (tras actualizar código) | `docker compose -f infra/docker-compose.yml up -d --build` |
| **Ver estado** | `docker compose -f infra/docker-compose.yml ps` |
| **Parar** | `docker compose -f infra/docker-compose.yml stop` |
| **Parar y eliminar contenedores** | `docker compose -f infra/docker-compose.yml down` |
| **Ver logs de un servicio** | `docker compose -f infra/docker-compose.yml logs api --tail 50` |
| **Reiniciar solo la web** | `docker compose -f infra/docker-compose.yml restart web` |
| **Reiniciar solo la API** | `docker compose -f infra/docker-compose.yml restart api` |

### Qué debe aparecer en `docker compose ps`

| Servicio | Estado esperado |
|----------|-----------------|
| `web` | Up, puerto `3000` |
| `api` | Up, puerto `8000` |
| `postgres` | Up (healthy), puerto host p. ej. `5434` |
| `redis` | Up (healthy) |
| `worker` | Up |

### Tras cambiar código de la interfaz

```powershell
docker compose -f infra/docker-compose.yml build web
docker compose -f infra/docker-compose.yml up -d --force-recreate web
```

### Tras cambiar código del backend

```powershell
docker compose -f infra/docker-compose.yml build api worker
docker compose -f infra/docker-compose.yml up -d --force-recreate api worker
```

### Comprobar que todo responde

```powershell
curl http://localhost:8000/api/health
```

Respuesta esperada: JSON con `"status": "ok"` o `"degraded"` si Ollama no responde (el chat fallará hasta que Ollama vuelva).

---

## 4. Chat — consultar la wiki

### Uso normal

1. Entra en **Chat** desde el menú lateral.
2. Escribe una pregunta sobre la documentación indexada.
3. Espera la respuesta (en CPU puede tardar **varios segundos o minutos**).
4. Revisa las **fuentes** bajo la respuesta (enlaces a páginas wiki o «Respuesta validada por el equipo»).

### Historial

- Icono de **historial** (cabecera del chat) → lista de conversaciones anteriores.
- **Nueva conversación:** botón «+» o enlace «Nueva» en el sidebar.
- **Eliminar:** icono papelera → confirmar. La conversación se borra de la base de datos.
- **Renombrar:** icono lápiz en el sidebar.

### Feedback 👍 / 👎

| Acción | Efecto |
|--------|--------|
| **👍** | Registra que la respuesta fue útil |
| **👎** | Abre panel para escribir la **respuesta correcta**; crea entrada **pendiente** en Admin |

**Importante:** un 👎 con corrección es la forma de enseñar al sistema. Escribe la respuesta tal como debería haber sido (con comandos en bloques de código si aplica).

### Badge «Respuesta validada por el equipo»

Aparece cuando la pregunta coincide con un **Q&A validado** en Admin. La respuesta es la text almacenada por el equipo (modo *direct*), no una invención del modelo.

### Instrucciones del asistente

En el chat, botón de **instrucciones**:

- **Personales:** preferencias tuyas (tono, brevedad…).
- **Equipo:** reglas para todos (solo admin las edita).

> Las instrucciones **no** se aplican cuando la respuesta viene de un Q&A validado en modo *direct*.

---

## 5. Admin — ingesta y Q&A validados

Ruta: **http://localhost:3000/admin** (solo **admin**).

### 5.1 Ingesta desde Wiki.js

La wiki debe estar configurada en `.env` (`WIKIJS_URL`, `WIKIJS_API_KEY`).

| Botón | Cuándo usarlo |
|-------|---------------|
| **Sync incremental** | Uso diario: solo páginas modificadas desde la última sync |
| **Sync completa** | Primera vez, tras cambios masivos en la wiki, o si el índice parece desactualizado |

**Qué ocurre:** el worker descarga páginas, las trocea en fragmentos (*chunks*), genera embeddings con Ollama y las guarda en PostgreSQL.

**Indicadores:**

- Tabla de **trabajos recientes** (estado: pending / running / completed / failed).
- Contador de **páginas indexadas**.

Si un trabajo queda en **failed**, revisa logs del worker:

```powershell
docker compose -f infra/docker-compose.yml logs worker --tail 100
```

Causas habituales: Wiki.js caído, API key incorrecta, Ollama no responde.

### 5.2 Q&A validados (circuito de aprendizaje)

Pestañas en Admin:

| Pestaña | Contenido |
|---------|-----------|
| **Pendientes** | Correcciones enviadas con 👎; revisar y validar o rechazar |
| **Validados** | Respuestas oficiales del equipo ya activas en el chat |
| **Rechazados** | Entradas descartadas |

#### Flujo recomendado (rotación semanal)

1. Revisar **Pendientes** cada semana.
2. Abrir cada entrada: leer pregunta, respuesta original del sistema y **corrección** del compañero.
3. Editar pregunta/respuesta si hace falta (formato markdown; comandos en bloques ` ```bash `).
4. Pulsar **Validar** → pasa a *Validados* y empieza a usarse en el chat.
5. O **Rechazar** si la corrección no es fiable.

#### Formato de respuestas validadas

El chat renderiza markdown. Reglas para quien cura respuestas:

- Comandos con `_`, `*` o varias líneas → **siempre** en bloque:

  ````markdown
  ```bash
  wget https://ejemplo.com/paquete_1.0_all.deb
  sudo dpkg -i paquete_*.deb
  ```
  ````

- Usar **`**1. Paso…**`** en lugar de listas `1.` junto a bloques de código (evita render roto).
- Solo cambiar la **pregunta** recalcula el embedding de búsqueda; cambiar la **respuesta** no.

Modo de respuesta (`VALIDATED_QA_MODE` en `.env`):

| Valor | Comportamiento |
|-------|----------------|
| `direct` (default) | Devuelve la respuesta almacenada tal cual |
| `inject` | Inyecta en el prompt del LLM (legacy; puede mezclar con wiki) |

---

## 6. Salud documental

Ruta: **http://localhost:3000/salud**

### Qué detecta

| Tipo | Significado |
|------|-------------|
| Obsolescencia | Páginas sin actualizar mucho tiempo |
| Enlaces rotos | Links que ya no funcionan |
| Huérfanas | Páginas sin enlaces entrantes |
| Contradicciones | Posible información contradictoria entre páginas |
| Versiones citadas | Referencias a versiones antiguas de software |

### Uso

1. Pulsar **Escanear** (dispara análisis; puede tardar).
2. Revisar **findings** por severidad.
3. Para cada hallazgo: **Resolver** (ya corregido en wiki) o **Descartar** (falso positivo).

El worker también puede lanzar escaneos programados según configuración.

---

## 7. Runbooks

Ruta: **http://localhost:3000/runbooks**

- **Listado:** runbooks publicados.
- **Crear desde página wiki:** genera borrador a partir de documentación existente.
- **Editor:** pasos, publicación.
- **Ejecutar:** checklist paso a paso con sesión trazable (quién marcó qué y cuándo).

Los runbooks son independientes del chat; comparten la misma autenticación.

---

## 8. Base de datos — ver y consultar

PostgreSQL guarda conversaciones, mensajes, chunks, Q&A validados, findings, etc.

**No tiene URL web.** Se accede con un cliente SQL o terminal.

### Opción A — DBeaver (recomendada, interfaz gráfica)

1. Instalar [DBeaver Community](https://dbeaver.io/download/) (gratis).
2. **Nueva conexión** → **PostgreSQL**.
3. Datos de conexión:

   | Campo | Valor |
   |-------|-------|
   | Host | `localhost` (o IP del servidor) |
   | Puerto | `5434` por defecto* |
   | Base de datos | `wikibridge` |
   | Usuario | `wikibridge` |
   | Contraseña | `wikibridge` |

   \* El puerto host está en `POSTGRES_HOST_PORT` del `.env`. Compruébalo con:

   ```powershell
   docker compose -f infra/docker-compose.yml ps postgres
   ```

   Busca `0.0.0.0:XXXX->5432/tcp` — usa **XXXX**.

4. **Probar conexión** → **Finalizar**.
5. Navegar: `wikibridge` → `Esquemas` → `public` → `Tablas`.
6. Clic derecho en tabla → **Ver datos**.

#### Tablas más útiles

| Tabla | Contiene |
|-------|----------|
| `conversations` | Chats (id, título, usuario, fechas) |
| `messages` | Mensajes user/assistant |
| `validated_qa` | Q&A validados (pregunta, answer, status) |
| `qa_feedback` | Feedback 👍/👎 |
| `wiki_pages` | Páginas indexadas de Wiki.js |
| `chunks` | Fragmentos con embeddings |
| `health_findings` | Hallazgos de salud documental |
| `ingest_jobs` | Historial de sincronizaciones |

#### Consultas de ejemplo

```sql
-- Últimas conversaciones
SELECT id, user_id, title, updated_at
FROM conversations
ORDER BY updated_at DESC
LIMIT 20;

-- Q&A validados activos
SELECT id, question, status, updated_at
FROM validated_qa
WHERE status = 'validated';

-- Cuántas páginas indexadas
SELECT COUNT(*) FROM wiki_pages WHERE is_deleted = false;
```

### Opción B — Terminal (sin instalar DBeaver)

```powershell
cd C:\Users\TécnicoSistemas\Projects\wikibridge
docker compose -f infra/docker-compose.yml exec postgres psql -U wikibridge -d wikibridge
```

Comandos dentro de `psql`:

| Comando | Acción |
|---------|--------|
| `\dt` | Listar tablas |
| `\d messages` | Estructura de una tabla |
| `\q` | Salir |

---

## 9. Copias de seguridad

Lo crítico es el volumen Docker **`postgres_data`** (toda la base de datos).

### Backup manual (PowerShell)

```powershell
docker compose -f infra/docker-compose.yml exec -T postgres `
  pg_dump -U wikibridge wikibridge > backup_wikibridge_$(Get-Date -Format yyyyMMdd).sql
```

### Restaurar (solo si sabes lo que haces)

```powershell
Get-Content backup_wikibridge_20260705.sql | docker compose -f infra/docker-compose.yml exec -T postgres psql -U wikibridge wikibridge
```

> Antes de restaurar en producción, para servicios y haz backup del estado actual.

**Frecuencia recomendada:** backup diario automatizado del servidor + retención 30 días.

---

## 10. Archivo de configuración (.env)

Ubicación: raíz del proyecto (`wikibridge/.env`). Copiar desde `.env.example` la primera vez.

### Variables que un mantenedor SÍ puede tocar

| Variable | Para qué |
|----------|----------|
| `WIKIJS_URL` / `WIKIJS_API_KEY` | Conexión a la wiki |
| `OLLAMA_BASE_URL` | URL del servidor Ollama |
| `CHAT_MODEL` / `EMBEDDING_MODEL` | Modelos de IA |
| `AUTH_MODE` | `local` o `ldap` |
| `LOCAL_AUTH_*` | Credenciales modo prueba |
| `LDAP_*` | Active Directory en producción |
| `POSTGRES_HOST_PORT` | Puerto externo de la BD (DBeaver) |
| `VALIDATED_QA_MODE` | `direct` o `inject` |
| `INCREMENTAL_SYNC_CRON_HOURS` | Horas UTC de sync incremental automática (p. ej. `2,8,14,20`) |
| `INCREMENTAL_SYNC_CRON_MINUTE` | Minuto de cada sync programada (0–59) |

### Variables que NO debes cambiar sin coordinación

| Variable | Motivo |
|----------|--------|
| `INTERNAL_SERVICE_TOKEN` | Rompe comunicación web ↔ API si web y API no coinciden |
| `AUTH_SECRET` | Invalida sesiones de todos los usuarios |
| `DATABASE_URL` | Solo si cambias credenciales PostgreSQL a propósito |
| `EMBEDDING_DIM` | Debe coincidir con el modelo de embeddings |

**Tras editar `.env`:** reinicia los servicios afectados:

```powershell
docker compose -f infra/docker-compose.yml up -d --force-recreate api web worker
```

---

## 11. Problemas frecuentes

### La web no carga (localhost:3000)

1. `docker compose ps` → ¿`web` está Up?
2. Si no: `docker compose up -d web`
3. Logs: `docker compose logs web --tail 30`

### El chat no responde o tarda muchísimo

1. Comprobar Ollama: `curl http://localhost:8000/api/health` → campo `ollama`.
2. Verificar que la VM Ollama está encendida y `OLLAMA_BASE_URL` es correcta.
3. En CPU, respuestas largas son normales; no cerrar la pestaña.

### «No se encontraron fragmentos» / respuestas vacías

1. ¿Hay páginas indexadas? Admin → contador o SQL `SELECT COUNT(*) FROM wiki_pages`.
2. Lanzar **sync incremental** o **completa** en Admin.
3. Comprobar que la pregunta trata temas documentados en la wiki.

### Respuesta validada incorrecta o mal formateada

1. Admin → Validados → editar `answer` (markdown + bloques bash).
2. Probar con **nueva conversación** (mensajes antiguos guardan la respuesta vieja).

### No se borran conversaciones del sidebar

1. Recargar página (F5) tras actualizar web.
2. Si persiste: comprobar en BD si el id sigue en `conversations`.

### Error 500 en Admin → Validados

Revisar logs API: `docker compose logs api --tail 50`.  
Migraciones pendientes: reiniciar API (ejecuta `alembic upgrade head` al arrancar).

### Puerto PostgreSQL ocupado

Si Docker no arranca postgres por «port already allocated»:

1. Cambia `POSTGRES_HOST_PORT=5435` (u otro libre) en `.env`.
2. `docker compose up -d postgres`

O comenta la sección `ports:` de postgres en `docker-compose.yml` y usa solo `docker compose exec postgres psql …`.

### Wiki.js / ingesta falla

- Verificar URL y API key en `.env`.
- Probar acceso a Wiki.js desde el servidor Docker.
- Logs: `docker compose logs worker --tail 100`

---

## 12. Cuándo pedir ayuda técnica

Contacta con desarrollo / Sistemas avanzado si:

- Migraciones Alembic fallan repetidamente al arrancar API.
- Corrupción de base de datos o necesidad de restaurar backup.
- Cambios de arquitectura (nuevo servidor Ollama, LDAP, certificados TLS).
- Errores 500 persistentes no cubiertos en este manual.
- Actualización de versión mayor de WikiBridge (git pull + rebuild).

**Información útil al reportar:**

- Hora exacta del incidente.
- URL y acción que hacías.
- Salida de `docker compose ps`.
- Últimas 50 líneas de logs: `docker compose logs api web worker --tail 50`.

---

## 13. Glosario

| Término | Significado sencillo |
|---------|---------------------|
| **RAG** | Buscar en la documentación y responder con citas |
| **Chunk** | Trozo de una página wiki indexada |
| **Embedding** | Representación numérica del texto para búsqueda semántica |
| **Ollama** | Servidor local que ejecuta modelos de IA |
| **Ingesta / sync** | Copiar wiki → base de datos de WikiBridge |
| **Q&A validado** | Pregunta/respuesta revisada por el equipo |
| **Finding** | Hallazgo de salud documental |
| **Runbook** | Procedimiento paso a paso ejecutable |
| **Docker / compose** | Herramienta que levanta todos los servicios juntos |
| **SSE** | Streaming de la respuesta del chat token a token |

---

## Documentación relacionada

| Documento | Contenido |
|-----------|-----------|
| [README.md](../README.md) | Arranque rápido |
| [estado-y-roadmap.md](estado-y-roadmap.md) | Estado y hoja de ruta |
| [architecture.md](architecture.md) | Arquitectura técnica |
| [development.md](development.md) | Tests para desarrolladores |

---

*WikiBridge — CCMGC · Equipo de Sistemas. Mantén este manual actualizado cuando cambien procedimientos operativos.*
