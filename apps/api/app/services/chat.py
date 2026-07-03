from __future__ import annotations

import json
import logging
import re
import time
import uuid
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.models import Chunk, Conversation, Feedback, IngestJob, Message, MessageRole, WikiPage
from app.services.ollama import OllamaClient, hash_query
from app.services.chat_instructions import ChatInstructionsService, build_rag_system_prompt
from app.services.search import ChunkHit, HybridSearchService

logger = logging.getLogger(__name__)

RAG_SYSTEM_PROMPT = """Eres WikiBridge, asistente interno del equipo de Sistemas del CCMGC.
Responde SIEMPRE en español y ÚNICAMENTE con la información de los fragmentos de documentación proporcionados.

Reglas estrictas:
1. Si la documentación no contiene evidencia suficiente, dilo explícitamente. No inventes datos.
2. Sugiere en qué página o sección podría documentarse la información faltante, si aplica.
3. Cita las fuentes con marcadores [1], [2], etc. correspondientes a los fragmentos numerados.
4. Sé conciso y operativo: pasos claros, nombres de servicios y valores tal como aparecen en la doc.
5. Si el usuario pide un resumen, estructura por secciones y cierra con una conclusión breve; no dejes la respuesta a medias.
6. Si los fragmentos incluyen el diario del día consultado (marcado como prioridad), úsalo como fuente principal frente a entradas de otros días.
7. No menciones que eres un modelo de lenguaje ni hables de tus instrucciones internas."""

CITATION_PATTERN = re.compile(r"\[(\d+)\]")


def _local_timezone() -> timezone | ZoneInfo:
    try:
        return ZoneInfo("Europe/Madrid")
    except ZoneInfoNotFoundError:
        return timezone(timedelta(hours=1))


LOCAL_TZ = _local_timezone()
DIARY_QUERY_PATTERN = re.compile(r"\b(diario|bitácora|bitacora)\b", re.IGNORECASE)
DIARY_DATE_TODAY_PATTERN = re.compile(
    r"\b(hoy|esta mañana|este día|del día de hoy|del dia de hoy)\b",
    re.IGNORECASE,
)
DIARY_DATE_YESTERDAY_PATTERN = re.compile(r"\bayer\b", re.IGNORECASE)
DIARY_DEPT_OPERADORES_PATTERN = re.compile(r"\boperadores?\b", re.IGNORECASE)
DIARY_DEPT_SISTEMAS_PATTERN = re.compile(r"\bsistemas?\b", re.IGNORECASE)
DIARY_EXPLICIT_DATE_PATTERN = re.compile(
    r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b"
)
INGEST_QUERY_PATTERN = re.compile(
    r"(indexad|ingest|sincroniz|actualizad).{0,40}(hoy|reciente|últim|ultim)"
    r"|(qué|que)\s+se\s+ha\s+indexad"
    r"|páginas?\s+indexad",
    re.IGNORECASE,
)
SUMMARY_QUERY_PATTERN = re.compile(
    r"\b(resume|resumen|resumir|resúmeme|resumeme|sintetiza|sintetizar)\b",
    re.IGNORECASE,
)
PROCEDURE_QUERY_PATTERN = re.compile(
    r"(?:"
    r"(?:instal|configur|despleg|implement|migr)\w*\b|"
    r"procedimiento|pasos?\s+para|"
    r"cómo\s+(?:instal|configur|despleg|hacer|realiz|ejecut)\w*\b|"
    r"como\s+(?:instal|configur|despleg|hacer|realiz|ejecut)\w*\b"
    r")",
    re.IGNORECASE,
)
SHORT_QUERY_PATTERN = re.compile(
    r"(?:"
    r"^\s*(?:dónde|donde|qué|que|cuál|cual|cuánto|cuanto|hay|existe)\b|"
    r"\b(?:qué|que)\s+(?:puerto|url|ip|usuario|contraseña|password)\b|"
    r"\b(?:dónde|donde)\s+(?:está|esta|queda|document)"
    r")",
    re.IGNORECASE,
)


class ChatService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._ollama = OllamaClient(settings)
        self._search = HybridSearchService(session)
        self._cache = QueryEmbeddingCache(
            settings.redis_url, settings.query_embedding_cache_ttl_seconds
        )

    async def list_conversations(self, user_id: str) -> list[dict]:
        result = await self._session.execute(
            select(Conversation)
            .where(Conversation.user_id == user_id)
            .order_by(Conversation.updated_at.desc())
            .limit(50)
        )
        conversations = result.scalars().all()
        return [
            {
                "id": str(conv.id),
                "title": conv.title,
                "created_at": conv.created_at.isoformat(),
                "updated_at": conv.updated_at.isoformat(),
            }
            for conv in conversations
        ]

    async def create_conversation(self, user_id: str, title: str = "Nueva conversación") -> dict:
        conversation = Conversation(user_id=user_id, title=title)
        self._session.add(conversation)
        await self._session.commit()
        await self._session.refresh(conversation)
        return {
            "id": str(conversation.id),
            "title": conversation.title,
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat(),
        }

    async def get_conversation(self, conversation_id: uuid.UUID, user_id: str) -> dict | None:
        conversation = await self._session.get(Conversation, conversation_id)
        if not conversation or conversation.user_id != user_id:
            return None

        messages_result = await self._session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.asc())
        )
        messages = messages_result.scalars().all()
        serialized_messages = []
        for msg in messages:
            data = self._serialize_message(msg)
            if msg.cited_chunk_ids:
                data["citations"] = await self.enrich_citations(msg.cited_chunk_ids)
            else:
                data["citations"] = []
            serialized_messages.append(data)
        return {
            "id": str(conversation.id),
            "title": conversation.title,
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat(),
            "messages": serialized_messages,
        }

    async def delete_conversation(self, conversation_id: uuid.UUID, user_id: str) -> bool:
        conversation = await self._session.get(Conversation, conversation_id)
        if not conversation or conversation.user_id != user_id:
            return False
        await self._session.delete(conversation)
        await self._session.commit()
        return True

    async def rename_conversation(
        self, conversation_id: uuid.UUID, user_id: str, title: str
    ) -> dict | None:
        conversation = await self._session.get(Conversation, conversation_id)
        if not conversation or conversation.user_id != user_id:
            return None
        conversation.title = title.strip()[:120] or conversation.title
        conversation.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(conversation)
        return {
            "id": str(conversation.id),
            "title": conversation.title,
            "updated_at": conversation.updated_at.isoformat(),
        }

    async def submit_feedback(
        self,
        message_id: uuid.UUID,
        user_id: str,
        rating: int,
        comment: str | None = None,
    ) -> dict | None:
        message = await self._session.get(Message, message_id)
        if not message:
            return None

        conversation = await self._session.get(Conversation, message.conversation_id)
        if not conversation or conversation.user_id != user_id:
            return None

        if rating not in (1, -1):
            raise ValueError("rating must be 1 or -1")

        existing = await self._session.execute(
            select(Feedback).where(
                Feedback.message_id == message_id, Feedback.user_id == user_id
            )
        )
        feedback = existing.scalar_one_or_none()
        if feedback:
            feedback.rating = rating
            feedback.comment = comment
        else:
            feedback = Feedback(
                message_id=message_id,
                user_id=user_id,
                rating=rating,
                comment=comment,
            )
            self._session.add(feedback)

        await self._session.commit()
        return {"message_id": str(message_id), "rating": rating}

    async def stream_response(
        self,
        conversation_id: uuid.UUID,
        user_id: str,
        content: str,
    ) -> AsyncIterator[str]:
        conversation = await self._session.get(Conversation, conversation_id)
        if not conversation or conversation.user_id != user_id:
            yield self._sse("error", {"message": "Conversación no encontrada"})
            return

        yield self._sse("status", {"phase": "started", "message": "Procesando tu pregunta…"})

        user_message = Message(
            conversation_id=conversation_id,
            role=MessageRole.USER,
            content=content,
        )
        self._session.add(user_message)

        if conversation.title == "Nueva conversación":
            conversation.title = content.strip()[:80] or "Nueva conversación"
        conversation.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(user_message)

        yield self._sse("user_message", {"id": str(user_message.id), "content": content})

        started = time.perf_counter()
        try:
            diary_hits = await self._fetch_diary_hits(content)
            if diary_hits:
                yield self._sse(
                    "status",
                    {"phase": "searching", "message": "Localizando el diario del día…"},
                )
                hits = diary_hits
                context_block, citations = self._build_context(hits, diary_hits=diary_hits)
                direct_answer = format_diary_answer(diary_hits)
                if direct_answer:
                    yield self._sse(
                        "status",
                        {
                            "phase": "generating",
                            "message": "Resumiendo el diario…",
                            "chunks_found": len(hits),
                        },
                    )
                    full_response = direct_answer
                    yield self._sse("token", {"content": full_response})
                    cited_ids = [hit.chunk_id for hit in diary_hits]
                    latency_ms = int((time.perf_counter() - started) * 1000)
                    assistant_message = Message(
                        conversation_id=conversation_id,
                        role=MessageRole.ASSISTANT,
                        content=full_response,
                        cited_chunk_ids=cited_ids,
                        latency_ms=latency_ms,
                        model="wikibridge-diary",
                    )
                    self._session.add(assistant_message)
                    conversation.updated_at = datetime.now(UTC)
                    await self._session.commit()
                    await self._session.refresh(assistant_message)
                    yield self._sse("citations", {"citations": citations, "cited_chunk_ids": [str(cid) for cid in cited_ids]})
                    yield self._sse(
                        "done",
                        {
                            "message_id": str(assistant_message.id),
                            "latency_ms": latency_ms,
                            "model": "wikibridge-diary",
                        },
                    )
                    return

            yield self._sse("status", {"phase": "embedding", "message": "Buscando en la wiki…"})

            query_hash = hash_query(content)
            embedding = await self._cache.get(query_hash)
            if embedding is None:
                embedding = await self._ollama.embed_text(content)
                await self._cache.set(query_hash, embedding)

            await self._ollama.unload_model(self._settings.embedding_model)

            yield self._sse("status", {"phase": "searching", "message": "Buscando en la documentación…"})

            diary_hits = await self._fetch_diary_hits(content)
            if diary_hits:
                hits = diary_hits
            else:
                final_k = self._settings.rag_final_chunks
                if SUMMARY_QUERY_PATTERN.search(content):
                    final_k = self._settings.rag_summary_final_chunks
                hits = await self._search.search(
                    content,
                    embedding,
                    top_k=self._settings.rag_search_top_k,
                    final_k=final_k,
                    rrf_k=self._settings.rrf_k,
                )

            context_block, citations = self._build_context(hits, diary_hits=diary_hits if diary_hits else None)
            ingest_context = await self._build_ingest_context(content)
            if ingest_context:
                context_block = f"{ingest_context}\n\n---\n\n{context_block}"
            history = await self._recent_history(conversation_id)
            if diary_hits:
                history = []

            user_instructions, team_instructions = await ChatInstructionsService(
                self._session
            ).get_for_prompt(user_id)
            system_prompt = build_rag_system_prompt(
                RAG_SYSTEM_PROMPT,
                team_instructions=team_instructions,
                user_instructions=user_instructions,
            )

            llm_messages = history + [
                {
                    "role": "user",
                    "content": (
                        f"Fragmentos de documentación:\n\n{context_block}\n\n"
                        f"Pregunta del usuario: {content}"
                    ),
                }
            ]

            yield self._sse(
                "status",
                {
                    "phase": "generating",
                    "message": "Redactando respuesta…",
                    "chunks_found": len(hits),
                },
            )

            full_response = ""
            num_predict = resolve_num_predict(content, self._settings)
            async for token in self._ollama.chat_stream_with_continuation(
                llm_messages, system_prompt, num_predict=num_predict
            ):
                full_response += token
                yield self._sse("token", {"content": token})

            if len(full_response.strip()) < 5:
                logger.warning(
                    "Chat response too short (%d chars), retrying non-streaming",
                    len(full_response.strip()),
                )
                full_response = await self._ollama.chat_complete(
                    llm_messages, system=system_prompt, num_predict=num_predict
                )
                if full_response.strip():
                    yield self._sse("token", {"content": full_response})

            if not full_response.strip():
                full_response = (
                    "No pude generar una respuesta con el modelo local. "
                    "Inténtalo de nuevo o reformula la pregunta."
                )
                yield self._sse("token", {"content": full_response})

            cited_ids = self._resolve_cited_chunk_ids(full_response, hits)
            cited_id_strs = {str(cid) for cid in cited_ids}
            latency_ms = int((time.perf_counter() - started) * 1000)

            assistant_message = Message(
                conversation_id=conversation_id,
                role=MessageRole.ASSISTANT,
                content=full_response,
                cited_chunk_ids=cited_ids,
                latency_ms=latency_ms,
                model=self._settings.chat_model,
            )
            self._session.add(assistant_message)
            conversation.updated_at = datetime.now(UTC)
            await self._session.commit()
            await self._session.refresh(assistant_message)

            yield self._sse(
                "citations",
                {
                    "citations": [c for c in citations if c["chunk_id"] in cited_id_strs],
                    "cited_chunk_ids": [str(cid) for cid in cited_ids],
                },
            )
            yield self._sse(
                "done",
                {
                    "message_id": str(assistant_message.id),
                    "latency_ms": latency_ms,
                    "model": self._settings.chat_model,
                },
            )
        except Exception as exc:
            logger.exception("Chat stream failed for conversation %s", conversation_id)
            yield self._sse("error", {"message": str(exc)})

    async def _recent_history(self, conversation_id: uuid.UUID) -> list[dict[str, str]]:
        result = await self._session.execute(
            select(Message)
            .where(Message.conversation_id == conversation_id)
            .order_by(Message.created_at.desc())
            .limit(6)
        )
        messages = list(reversed(result.scalars().all()))
        # Exclude the just-added user message from duplicate context
        history: list[dict[str, str]] = []
        for msg in messages[:-1]:
            if msg.role in (MessageRole.USER, MessageRole.ASSISTANT) and msg.content:
                history.append({"role": msg.role.value, "content": msg.content})
        return history[-2:]

    def _build_context(
        self, hits: list[ChunkHit], *, diary_hits: list[ChunkHit] | None = None
    ) -> tuple[str, list[dict]]:
        if not hits:
            return (
                "(No se encontraron fragmentos relevantes en la documentación indexada.)",
                [],
            )

        max_chars = (
            self._settings.rag_diary_max_chars
            if diary_hits
            else self._settings.rag_chunk_max_chars
        )
        blocks: list[str] = []
        citations: list[dict] = []
        diary_count = len(diary_hits or [])
        if diary_count:
            blocks.append(
                "ENTRADA OFICIAL DEL DÍA — responde SOLO con este diario, "
                f"sin mencionar entradas de otros días ({hits[0].page_title}, {hits[0].page_path})."
            )
        for index, hit in enumerate(hits, start=1):
            body = strip_html(hit.content) if diary_count else hit.content
            snippet = body[:max_chars]
            if len(body) > max_chars:
                snippet += "…"
            priority = " [DIARIO DEL DÍA]" if diary_count and index <= diary_count else ""
            blocks.append(
                f"[{index}]{priority} Página: {hit.page_title}\n"
                f"Ruta: {hit.page_path}\n"
                f"Sección: {hit.heading_path}\n"
                f"Contenido:\n{snippet}"
            )
            citations.append(
                {
                    "index": index,
                    "chunk_id": str(hit.chunk_id),
                    "page_title": hit.page_title,
                    "page_path": hit.page_path,
                    "heading_path": hit.heading_path,
                    "wiki_url": f"{self._settings.wikijs_url.rstrip('/')}/{hit.page_path}",
                    "excerpt": hit.content[:280],
                }
            )
        return "\n\n---\n\n".join(blocks), citations

    async def _build_ingest_context(self, content: str) -> str | None:
        if not INGEST_QUERY_PATTERN.search(content):
            return None

        today_start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        pages_result = await self._session.execute(
            select(WikiPage)
            .where(
                WikiPage.is_deleted.is_(False),
                WikiPage.last_synced_at >= today_start,
            )
            .order_by(WikiPage.last_synced_at.desc())
            .limit(40)
        )
        pages_today = pages_result.scalars().all()

        pages_count = await self._session.scalar(
            select(func.count()).select_from(WikiPage).where(WikiPage.is_deleted.is_(False))
        )
        chunks_count = await self._session.scalar(select(func.count()).select_from(Chunk))

        jobs_result = await self._session.execute(
            select(IngestJob).order_by(IngestJob.started_at.desc().nullslast()).limit(3)
        )
        jobs = jobs_result.scalars().all()

        lines = [
            "[Metadatos WikiBridge — ingesta local, no proviene de Wiki.js]",
            f"Páginas activas indexadas en total: {pages_count or 0}",
            f"Chunks en el índice: {chunks_count or 0}",
            f"Páginas sincronizadas hoy ({today_start.date().isoformat()}): {len(pages_today)}",
        ]
        if pages_today:
            lines.append("Listado de páginas sincronizadas hoy:")
            for page in pages_today:
                synced = page.last_synced_at.isoformat() if page.last_synced_at else "desconocido"
                lines.append(f"- {page.title} ({page.path}) — last_synced_at: {synced}")
        else:
            lines.append("No hay páginas con last_synced_at de hoy en la base local.")

        if jobs:
            last = jobs[0]
            lines.append(
                f"Último trabajo de ingesta: {last.status.value} "
                f"({last.type.value}), "
                f"inicio: {last.started_at.isoformat() if last.started_at else '—'}, "
                f"fin: {last.finished_at.isoformat() if last.finished_at else '—'}"
            )
            if last.stats:
                lines.append(f"Estadísticas del último job: {json.dumps(last.stats, ensure_ascii=False)}")

        return "\n".join(lines)

    async def _fetch_diary_hits(self, query: str) -> list[ChunkHit]:
        target = parse_diary_query(query)
        if not target:
            return []

        dept_prefix, target_date = target
        path_pattern = (
            f"{dept_prefix}/diario/{target_date.year}/"
            f"{target_date.month:02d}/{target_date.day:02d}"
        )
        result = await self._session.execute(
            select(Chunk, WikiPage)
            .join(WikiPage, WikiPage.id == Chunk.page_id)
            .where(
                WikiPage.is_deleted.is_(False),
                WikiPage.path.ilike(path_pattern),
            )
            .order_by(Chunk.ordinal.asc())
        )
        rows = result.all()
        if not rows:
            logger.info("Diary page not found for pattern %s", path_pattern)
            return []

        return [
            ChunkHit(
                chunk_id=chunk.id,
                page_id=page.id,
                page_title=page.title,
                page_path=page.path,
                heading_path=chunk.heading_path,
                content=chunk.content,
                ordinal=chunk.ordinal,
                score=1000.0,
            )
            for chunk, page in rows
        ]

    def _extract_cited_chunk_ids(
        self, response: str, hits: list[ChunkHit]
    ) -> list[uuid.UUID]:
        indices = {int(match) for match in CITATION_PATTERN.findall(response)}
        cited: list[uuid.UUID] = []
        for index in sorted(indices):
            if 1 <= index <= len(hits):
                cited.append(hits[index - 1].chunk_id)
        return cited

    def _resolve_cited_chunk_ids(
        self, response: str, hits: list[ChunkHit]
    ) -> list[uuid.UUID]:
        cited = self._extract_cited_chunk_ids(response, hits)
        if cited:
            return cited
        return [hit.chunk_id for hit in hits]

    def _serialize_message(self, message: Message) -> dict:
        return {
            "id": str(message.id),
            "role": message.role.value,
            "content": message.content,
            "cited_chunk_ids": [str(cid) for cid in message.cited_chunk_ids],
            "latency_ms": message.latency_ms,
            "model": message.model,
            "created_at": message.created_at.isoformat(),
        }

    async def enrich_citations(self, cited_chunk_ids: list[uuid.UUID]) -> list[dict]:
        if not cited_chunk_ids:
            return []
        result = await self._session.execute(
            select(Chunk, WikiPage)
            .join(WikiPage, WikiPage.id == Chunk.page_id)
            .where(Chunk.id.in_(cited_chunk_ids))
        )
        rows = result.all()
        by_id = {chunk.id: (chunk, page) for chunk, page in rows}
        citations: list[dict] = []
        for index, chunk_id in enumerate(cited_chunk_ids, start=1):
            row = by_id.get(chunk_id)
            if not row:
                continue
            chunk, page = row
            citations.append(
                {
                    "index": index,
                    "chunk_id": str(chunk.id),
                    "page_title": page.title,
                    "page_path": page.path,
                    "heading_path": chunk.heading_path,
                    "wiki_url": f"{self._settings.wikijs_url.rstrip('/')}/{page.path}",
                    "excerpt": chunk.content[:280],
                }
            )
        return citations

    @staticmethod
    def _sse(event: str, data: dict) -> str:
        return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def local_today() -> date:
    return datetime.now(LOCAL_TZ).date()


def is_short_factual_query(query: str) -> bool:
    text = query.strip()
    if not text or len(text) > 120:
        return False
    if SUMMARY_QUERY_PATTERN.search(text) or PROCEDURE_QUERY_PATTERN.search(text):
        return False
    if SHORT_QUERY_PATTERN.search(text):
        return True
    return False


def resolve_num_predict(query: str, settings: Settings) -> int:
    if SUMMARY_QUERY_PATTERN.search(query) or PROCEDURE_QUERY_PATTERN.search(query):
        return settings.ollama_num_predict
    if len(query.strip()) > 140:
        return settings.ollama_num_predict
    if is_short_factual_query(query):
        return settings.ollama_num_predict_short
    return settings.ollama_num_predict


def parse_diary_query(query: str) -> tuple[str, date] | None:
    if not DIARY_QUERY_PATTERN.search(query):
        return None

    target_date: date | None = None
    if DIARY_DATE_TODAY_PATTERN.search(query):
        target_date = local_today()
    elif DIARY_DATE_YESTERDAY_PATTERN.search(query):
        target_date = local_today() - timedelta(days=1)
    else:
        match = DIARY_EXPLICIT_DATE_PATTERN.search(query)
        if match:
            day = int(match.group(1))
            month = int(match.group(2))
            year_raw = match.group(3)
            year = int(year_raw) if year_raw else local_today().year
            if year < 100:
                year += 2000
            try:
                target_date = date(year, month, day)
            except ValueError:
                return None
        elif re.search(r"\b(del día|del dia|día de|dia de)\b", query, re.IGNORECASE):
            target_date = local_today()

    if target_date is None:
        return None

    if DIARY_DEPT_OPERADORES_PATTERN.search(query):
        dept_prefix = "Operadores"
    elif DIARY_DEPT_SISTEMAS_PATTERN.search(query):
        dept_prefix = "sistemas"
    else:
        dept_prefix = "sistemas"

    return dept_prefix, target_date


def strip_html(text: str) -> str:
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</p>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</li>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</h[1-6]>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = text.replace("&nbsp;", " ").replace("\u00a0", " ")
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def extract_diary_list_items(html: str) -> list[str]:
    items: list[str] = []
    for match in re.finditer(r"<li>(.*?)</li>", html, flags=re.IGNORECASE | re.DOTALL):
        text = strip_html(match.group(1)).strip()
        if len(text) >= 12:
            items.append(text)
    return items


def format_diary_answer(hits: list[ChunkHit]) -> str | None:
    if not hits:
        return None

    hit = hits[0]
    html = hit.content
    lines = [f"## {hit.page_title}", f"Ruta: `{hit.page_path}`", ""]

    sections = re.split(r"<h2[^>]*>", html, flags=re.IGNORECASE)
    found_content = False

    for raw_section in sections[1:]:
        section_html, _, rest = raw_section.partition("</h2>")
        section_title = strip_html(section_html)
        body_html = rest

        worker = ""
        worker_match = re.search(
            r"Nombre del trabajador:\s*(.*?)</strong>",
            body_html,
            flags=re.IGNORECASE | re.DOTALL,
        )
        if worker_match:
            worker = strip_html(worker_match.group(1)).strip().rstrip(":")

        notes = extract_diary_list_items(body_html)
        if not notes and not worker:
            continue

        found_content = True
        lines.append(f"### {section_title}")
        if worker:
            lines.append(f"- **Trabajador:** {worker}")
        for note in notes:
            lines.append(f"- {note}")
        lines.append("")

    if not found_content:
        return (
            f"El **{hit.page_title}** (`{hit.page_path}`) no tiene tareas, incidencias "
            "ni notas con contenido registrado. Las secciones del turno están vacías."
        )

    return "\n".join(lines).strip()
