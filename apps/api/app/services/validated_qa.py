from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Literal

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.models import (
    Conversation,
    Message,
    MessageRole,
    QaFeedback,
    QaFeedbackRating,
    ValidatedQa,
    ValidatedQaStatus,
)
from app.services.ollama import OllamaClient
from app.services.query_embedding import embed_query_text, prepare_query_text

logger = logging.getLogger(__name__)

MAX_CORRECTION_LENGTH = 8000
MAX_NOTES_LENGTH = 2000

QA_VERIFY_SYSTEM_PROMPT = (
    "Eres un verificador. Compara dos preguntas y decide si piden la MISMA información "
    "(misma acción sobre el mismo servicio/objeto). Una paráfrasis o reformulación cuenta "
    "como la misma información. Una pregunta sobre un servicio distinto, o sobre una acción "
    "distinta (por ejemplo parar vs reiniciar), NO es la misma información. "
    'Responde SOLO con JSON: {"misma_informacion": true} o {"misma_informacion": false}.'
)

QA_VERIFY_FEW_SHOT: tuple[tuple[str, str, bool], ...] = (
    (
        "Como reinicio el servicio nginx en el servidor wiki interno",
        "¿Cómo levanto nginx si está caído en el servidor de la wiki?",
        True,
    ),
    (
        "Como reinicio el servicio nginx en el servidor wiki interno",
        "¿Cómo reinicio el servicio postgres en el servidor wiki interno?",
        False,
    ),
    (
        "Como reinicio el servicio nginx en el servidor wiki interno",
        "¿Cómo veo los logs de nginx en el servidor wiki interno?",
        False,
    ),
    (
        "Como reinicio el servicio nginx en el servidor wiki interno",
        "¿Cómo paro nginx en el servidor wiki interno?",
        False,
    ),
)

QA_VERIFY_NUM_PREDICT = 20


def effective_recall_threshold(settings: Settings) -> float:
    if settings.validated_qa_similarity_threshold is not None:
        return settings.validated_qa_similarity_threshold
    return settings.validated_qa_recall_threshold


def _format_verify_pair(question_one: str, question_two: str) -> str:
    return f'Pregunta 1: "{question_one}"\nPregunta 2: "{question_two}"'


def build_verify_user_message(candidate_question: str, user_question: str) -> str:
    lines = ["Ejemplos:"]
    for q1, q2, same in QA_VERIFY_FEW_SHOT:
        lines.append(_format_verify_pair(q1, q2))
        lines.append(json.dumps({"misma_informacion": same}, ensure_ascii=False))
        lines.append("")
    lines.append("Caso real:")
    lines.append(_format_verify_pair(candidate_question, user_question))
    return "\n".join(lines).strip()


def parse_verification_json(response: str) -> bool:
    try:
        payload = json.loads(response.strip())
    except (json.JSONDecodeError, TypeError, ValueError):
        return False
    if not isinstance(payload, dict):
        return False
    value = payload.get("misma_informacion")
    if not isinstance(value, bool):
        return False
    return value


@dataclass(frozen=True)
class ValidatedQaHit:
    id: uuid.UUID
    question: str
    answer: str
    valid_from: date
    validated_at: datetime | None
    similarity: float
    verification: Literal["llm_yes", "bypass"]

class ValidatedQAService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._ollama = OllamaClient(settings)

    async def submit_message_feedback(
        self,
        message_id: uuid.UUID,
        user_id: str,
        rating: QaFeedbackRating,
        *,
        correction: str | None = None,
        comment: str | None = None,
        legacy: bool = False,
    ) -> dict | None:
        message = await self._session.get(Message, message_id)
        if not message or message.role != MessageRole.ASSISTANT:
            return None

        conversation = await self._session.get(Conversation, message.conversation_id)
        if not conversation or conversation.user_id != user_id:
            return None

        question, answer = await self._resolve_thread_qa(message)
        feedback_note = self._normalize_correction(comment if legacy else correction)

        existing = await self._session.execute(
            select(QaFeedback).where(
                QaFeedback.chat_message_id == message_id,
                QaFeedback.created_by == user_id,
            )
        )
        feedback = existing.scalar_one_or_none()
        if feedback:
            feedback.question = question
            feedback.answer = answer
            feedback.rating = rating
            feedback.correction = feedback_note
            feedback.is_legacy = legacy
        else:
            feedback = QaFeedback(
                chat_message_id=message_id,
                question=question,
                answer=answer,
                rating=rating,
                correction=feedback_note,
                is_legacy=legacy,
                created_by=user_id,
            )
            self._session.add(feedback)

        await self._session.flush()

        validated_qa_id: str | None = None
        should_promote = (
            not legacy
            and rating == QaFeedbackRating.DOWN
            and feedback_note is not None
        )
        if should_promote:
            validated_qa = await self._ensure_pending_validated_qa(
                feedback=feedback,
                question=question,
                correction=feedback_note,
                user_id=user_id,
            )
            validated_qa_id = str(validated_qa.id)

        await self._session.commit()

        rating_value = rating.value if isinstance(rating, QaFeedbackRating) else str(rating)
        result = {
            "message_id": str(message_id),
            "rating": rating_value,
            "feedback_id": str(feedback.id),
        }
        if validated_qa_id:
            result["validated_qa_id"] = validated_qa_id
            result["validated_qa_status"] = ValidatedQaStatus.PENDING.value
        return result

    async def list_for_admin(
        self,
        *,
        status: ValidatedQaStatus | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        query = select(ValidatedQa).order_by(ValidatedQa.updated_at.desc())
        count_query = select(func.count()).select_from(ValidatedQa)

        if status is not None:
            query = query.where(ValidatedQa.status == status)
            count_query = count_query.where(ValidatedQa.status == status)

        total = await self._session.scalar(count_query) or 0
        result = await self._session.execute(query.limit(limit).offset(offset))
        items = result.scalars().all()

        serialized = []
        for row in items:
            data = self._serialize_validated_qa(row)
            if row.source_feedback_id:
                fb = await self._session.get(QaFeedback, row.source_feedback_id)
                if fb:
                    data["original_system_answer"] = fb.answer
                    data["source_feedback"] = {
                        "id": str(fb.id),
                        "rating": fb.rating.value,
                        "created_by": fb.created_by,
                        "created_at": fb.created_at.isoformat(),
                    }
            serialized.append(data)

        return {"items": serialized, "total": total, "limit": limit, "offset": offset}

    async def update_for_admin(
        self,
        validated_qa_id: uuid.UUID,
        admin_user_id: str,
        *,
        question: str | None = None,
        answer: str | None = None,
        status: ValidatedQaStatus | None = None,
        valid_from: date | None = None,
        valid_until: date | None = None,
        notes: str | None = None,
        fields_set: set[str] | None = None,
    ) -> dict | None:
        row = await self._session.get(ValidatedQa, validated_qa_id)
        if not row:
            return None

        question_changed = False
        if question is not None:
            normalized = prepare_query_text(question)
            if not normalized:
                raise ValueError("La pregunta no puede estar vacía")
            if normalized != row.question:
                row.question = normalized
                question_changed = True

        if answer is not None:
            normalized_answer = answer.strip()
            if not normalized_answer:
                raise ValueError("La respuesta no puede estar vacía")
            row.answer = normalized_answer

        if status is not None:
            row.status = status
            if status == ValidatedQaStatus.VALIDATED:
                row.validated_by = admin_user_id
            elif status in (ValidatedQaStatus.PENDING, ValidatedQaStatus.REJECTED):
                row.validated_by = None

        if valid_from is not None:
            row.valid_from = valid_from

        if fields_set and "valid_until" in fields_set:
            row.valid_until = valid_until

        if notes is not None:
            notes_text = notes.strip()
            if len(notes_text) > MAX_NOTES_LENGTH:
                raise ValueError(f"Máximo {MAX_NOTES_LENGTH} caracteres en notas")
            row.notes = notes_text or None

        if question_changed:
            row.question_embedding = await embed_query_text(row.question, self._ollama)

        row.updated_at = datetime.now(UTC)
        await self._session.commit()
        await self._session.refresh(row)
        return self._serialize_validated_qa(row)

    async def delete_for_admin(self, validated_qa_id: uuid.UUID) -> bool:
        row = await self._session.get(ValidatedQa, validated_qa_id)
        if not row:
            return False
        await self._session.delete(row)
        await self._session.commit()
        return True

    async def count_pending(self) -> int:
        return await self._session.scalar(
            select(func.count())
            .select_from(ValidatedQa)
            .where(ValidatedQa.status == ValidatedQaStatus.PENDING)
        ) or 0

    async def search_validated(
        self,
        query_embedding: list[float],
        *,
        query_text: str,
        today: date | None = None,
    ) -> tuple[list[ValidatedQaHit], float]:
        """Recall by embedding, then LLM-verify candidates below the bypass threshold."""
        reference_date = today or date.today()
        recall_threshold = effective_recall_threshold(self._settings)
        verify_bypass = self._settings.validated_qa_verify_bypass
        max_results = self._settings.validated_qa_max_results
        user_question = prepare_query_text(query_text)
        embedding_literal = "[" + ",".join(str(v) for v in query_embedding) + "]"

        rows = await self._session.execute(
            text(
                """
                SELECT
                    id,
                    question,
                    answer,
                    valid_from,
                    updated_at,
                    1 - (question_embedding <=> CAST(:embedding AS vector)) AS similarity
                FROM validated_qa
                WHERE status = 'validated'
                  AND valid_from <= :reference_date
                  AND (valid_until IS NULL OR valid_until >= :reference_date)
                ORDER BY question_embedding <=> CAST(:embedding AS vector)
                LIMIT :scan_limit
                """
            ),
            {
                "embedding": embedding_literal,
                "reference_date": reference_date,
                "scan_limit": max(max_results * 5, 10),
            },
        )
        mappings = list(rows.mappings())
        max_similarity = max((float(row["similarity"]) for row in mappings), default=0.0)

        candidates: list = []
        for row in mappings:
            if float(row["similarity"]) >= recall_threshold:
                candidates.append(row)
            if len(candidates) >= max_results:
                break

        hits: list[ValidatedQaHit] = []
        verify_jobs = []
        for row in candidates:
            similarity = float(row["similarity"])
            if similarity >= verify_bypass:
                logger.info(
                    "validated_qa candidate id=%s similarity=%.4f verdict=bypass",
                    row["id"],
                    similarity,
                )
                hits.append(self._row_to_hit(row, similarity, verification="bypass"))
                continue
            verify_jobs.append((row, similarity))

        if verify_jobs:
            verify_results = await asyncio.gather(
                *(
                    self._verify_candidate(row, similarity, user_question)
                    for row, similarity in verify_jobs
                )
            )
            for hit in verify_results:
                if hit is not None:
                    hits.append(hit)

        return hits[:max_results], max_similarity

    async def _verify_candidate(
        self,
        row,
        similarity: float,
        user_question: str,
    ) -> ValidatedQaHit | None:
        qa_id = row["id"]
        try:
            accepted = await self._verify_question_match(user_question, row["question"])
        except Exception:
            logger.exception(
                "validated_qa candidate id=%s similarity=%.4f verdict=error",
                qa_id,
                similarity,
            )
            return None

        verdict = "accepted" if accepted else "rejected"
        logger.info(
            "validated_qa candidate id=%s similarity=%.4f verdict=%s",
            qa_id,
            similarity,
            verdict,
        )
        if accepted:
            return self._row_to_hit(row, similarity, verification="llm_yes")
        return None

    async def _call_verify_llm(self, candidate_question: str, user_question: str) -> str:
        user_message = build_verify_user_message(candidate_question, user_question)
        return await self._ollama.chat_complete(
            [{"role": "user", "content": user_message}],
            system=QA_VERIFY_SYSTEM_PROMPT,
            model=self._settings.validated_qa_verify_model or self._settings.chat_model,
            num_predict=QA_VERIFY_NUM_PREDICT,
            timeout=self._settings.validated_qa_verify_timeout_seconds,
            response_format="json",
            temperature=0,
        )

    async def _verify_question_match(self, user_question: str, candidate_question: str) -> bool:
        response = await self._call_verify_llm(candidate_question, user_question)
        return parse_verification_json(response)

    @staticmethod
    def _row_to_hit(
        row,
        similarity: float,
        *,
        verification: Literal["llm_yes", "bypass"],
    ) -> ValidatedQaHit:
        return ValidatedQaHit(
            id=row["id"],
            question=row["question"],
            answer=row["answer"],
            valid_from=row["valid_from"],
            validated_at=row["updated_at"],
            similarity=similarity,
            verification=verification,
        )

    @staticmethod
    def should_search_for_rag(*, is_diary_query: bool) -> bool:
        return not is_diary_query

    async def _ensure_pending_validated_qa(
        self,
        *,
        feedback: QaFeedback,
        question: str,
        correction: str,
        user_id: str,
    ) -> ValidatedQa:
        normalized_question = prepare_query_text(question)
        if feedback.id:
            existing = await self._session.execute(
                select(ValidatedQa).where(ValidatedQa.source_feedback_id == feedback.id)
            )
            row = existing.scalar_one_or_none()
            if row:
                row.question = normalized_question
                row.answer = correction
                row.status = ValidatedQaStatus.PENDING
                row.validated_by = None
                row.question_embedding = await embed_query_text(
                    normalized_question, self._ollama
                )
                row.updated_at = datetime.now(UTC)
                return row

        embedding = await embed_query_text(normalized_question, self._ollama)
        row = ValidatedQa(
            question=normalized_question,
            question_embedding=embedding,
            answer=correction,
            status=ValidatedQaStatus.PENDING,
            source_feedback_id=feedback.id,
            created_by=user_id,
        )
        self._session.add(row)
        await self._session.flush()
        return row

    async def _resolve_thread_qa(self, assistant_message: Message) -> tuple[str, str]:
        result = await self._session.execute(
            select(Message)
            .where(
                Message.conversation_id == assistant_message.conversation_id,
                Message.created_at < assistant_message.created_at,
            )
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        previous = result.scalar_one_or_none()
        if not previous or previous.role != MessageRole.USER:
            raise ValueError("No se encontró la pregunta del usuario asociada al mensaje")
        question = prepare_query_text(previous.content)
        answer = prepare_query_text(assistant_message.content)
        if not question:
            raise ValueError("La pregunta del usuario está vacía")
        if not answer:
            raise ValueError("La respuesta del asistente está vacía")
        return question, answer

    @staticmethod
    def _normalize_correction(correction: str | None) -> str | None:
        if correction is None:
            return None
        text_value = correction.strip()
        if not text_value:
            return None
        if len(text_value) > MAX_CORRECTION_LENGTH:
            raise ValueError(f"Máximo {MAX_CORRECTION_LENGTH} caracteres en la corrección")
        return text_value

    @staticmethod
    def _serialize_validated_qa(row: ValidatedQa) -> dict:
        return {
            "id": str(row.id),
            "question": row.question,
            "answer": row.answer,
            "status": row.status.value,
            "source_feedback_id": str(row.source_feedback_id) if row.source_feedback_id else None,
            "created_by": row.created_by,
            "validated_by": row.validated_by,
            "valid_from": row.valid_from.isoformat(),
            "valid_until": row.valid_until.isoformat() if row.valid_until else None,
            "notes": row.notes,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
        }


def validated_hits_to_prompt_entries(hits: list[ValidatedQaHit]) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    for hit in hits:
        validated_date = (
            hit.validated_at.date().isoformat()
            if hit.validated_at
            else hit.valid_from.isoformat()
        )
        entries.append(
            {
                "question": hit.question,
                "answer": hit.answer,
                "validated_date": validated_date,
            }
        )
    return entries


def validated_hits_to_metadata(hits: list[ValidatedQaHit]) -> list[dict]:
    return [
        {
            "id": str(hit.id),
            "validated_at": hit.validated_at.isoformat() if hit.validated_at else None,
            "validated_date": (
                hit.validated_at.date().isoformat()
                if hit.validated_at
                else hit.valid_from.isoformat()
            ),
            "similarity": round(hit.similarity, 4),
            "verification": hit.verification,
        }
        for hit in hits
    ]


def pick_primary_validated_hit(hits: list[ValidatedQaHit]) -> ValidatedQaHit:
    """Return the highest-similarity verified hit; log any others discarded."""
    if not hits:
        raise ValueError("hits must not be empty")
    ordered = sorted(hits, key=lambda hit: hit.similarity, reverse=True)
    primary = ordered[0]
    for discarded in ordered[1:]:
        logger.info(
            "validated_qa direct mode: using id=%s similarity=%.4f, "
            "discarding id=%s similarity=%.4f",
            primary.id,
            primary.similarity,
            discarded.id,
            discarded.similarity,
        )
    return primary


def build_validated_qa_citations(hit: ValidatedQaHit) -> list[dict]:
    return [
        validated_qa_to_citation(
            qa_id=hit.id,
            question=hit.question,
            answer=hit.answer,
            index=1,
        )
    ]


def validated_qa_to_citation(
    *,
    qa_id: uuid.UUID,
    question: str,
    answer: str,
    index: int = 1,
) -> dict:
    excerpt = answer[:280]
    if len(answer) > 280:
        excerpt += "…"
    return {
        "index": index,
        "chunk_id": str(qa_id),
        "page_title": "Respuesta validada por el equipo",
        "page_path": f"validated-qa/{qa_id}",
        "heading_path": question[:120],
        "wiki_url": f"#validated-qa-{qa_id}",
        "excerpt": excerpt,
        "source_type": "validated_qa",
    }
