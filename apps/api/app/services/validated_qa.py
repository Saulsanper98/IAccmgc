from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.models import Feedback, Message, MessageRole, ValidatedQa, ValidatedQaStatus
from app.services.ollama import OllamaClient


class ValidatedQaService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._ollama = OllamaClient(settings)

    async def create_or_update_from_feedback(
        self,
        feedback: Feedback,
        *,
        question: str,
        correction: str,
        created_by: str,
    ) -> ValidatedQa:
        normalized_question = question.strip()
        normalized_answer = correction.strip()
        if not normalized_question or not normalized_answer:
            raise ValueError("La pregunta y la corrección son obligatorias")

        existing = await self._session.execute(
            select(ValidatedQa).where(ValidatedQa.source_feedback_id == feedback.id)
        )
        row = existing.scalar_one_or_none()

        if row is None:
            embedding = await self._ollama.embed_text(normalized_question)
            row = ValidatedQa(
                question=normalized_question,
                question_embedding=embedding,
                answer=normalized_answer,
                status=ValidatedQaStatus.PENDING,
                source_feedback_id=feedback.id,
                created_by=created_by,
            )
            self._session.add(row)
        else:
            question_changed = row.question != normalized_question
            row.question = normalized_question
            row.answer = normalized_answer
            row.status = ValidatedQaStatus.PENDING
            row.validated_by = None
            if question_changed:
                row.question_embedding = await self._ollama.embed_text(normalized_question)

        await self._session.flush()
        return row

    async def list_entries(
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

        total = int((await self._session.execute(count_query)).scalar_one())
        rows = (await self._session.execute(query.limit(limit).offset(offset))).scalars().all()
        items = [await self._serialize(row) for row in rows]
        return {"items": items, "total": total, "limit": limit, "offset": offset}

    async def count_pending(self) -> int:
        result = await self._session.execute(
            select(func.count())
            .select_from(ValidatedQa)
            .where(ValidatedQa.status == ValidatedQaStatus.PENDING)
        )
        return int(result.scalar_one())

    async def update_entry(
        self,
        entry_id: uuid.UUID,
        *,
        admin_user_id: str,
        question: str | None = None,
        answer: str | None = None,
        status: ValidatedQaStatus | None = None,
        notes: str | None = None,
        valid_from: date | None = None,
    ) -> dict | None:
        row = await self._session.get(ValidatedQa, entry_id)
        if row is None:
            return None

        if question is not None:
            normalized = question.strip()
            if not normalized:
                raise ValueError("La pregunta no puede estar vacía")
            if normalized != row.question:
                row.question = normalized
                row.question_embedding = await self._ollama.embed_text(normalized)

        if answer is not None:
            normalized = answer.strip()
            if not normalized:
                raise ValueError("La respuesta no puede estar vacía")
            row.answer = normalized

        if notes is not None:
            row.notes = notes.strip() or None

        if valid_from is not None:
            row.valid_from = valid_from

        if status is not None:
            row.status = status
            if status == ValidatedQaStatus.VALIDATED:
                row.validated_by = admin_user_id
            elif status in (ValidatedQaStatus.PENDING, ValidatedQaStatus.REJECTED):
                row.validated_by = None

        await self._session.commit()
        await self._session.refresh(row)
        return await self._serialize(row)

    async def delete_entry(self, entry_id: uuid.UUID) -> bool:
        row = await self._session.get(ValidatedQa, entry_id)
        if row is None:
            return False
        await self._session.delete(row)
        await self._session.commit()
        return True

    async def _serialize(self, row: ValidatedQa) -> dict:
        original_answer = None
        if row.source_feedback_id:
            feedback = await self._session.get(Feedback, row.source_feedback_id)
            if feedback:
                message = await self._session.get(Message, feedback.message_id)
                if message:
                    original_answer = message.content

        return {
            "id": str(row.id),
            "question": row.question,
            "answer": row.answer,
            "status": row.status.value,
            "source_feedback_id": str(row.source_feedback_id) if row.source_feedback_id else None,
            "original_answer": original_answer,
            "created_by": row.created_by,
            "validated_by": row.validated_by,
            "valid_from": row.valid_from.isoformat() if row.valid_from else None,
            "notes": row.notes,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }


async def find_preceding_user_question(session: AsyncSession, assistant_message: Message) -> str | None:
    result = await session.execute(
        select(Message.content)
        .where(
            Message.conversation_id == assistant_message.conversation_id,
            Message.role == MessageRole.USER,
            Message.created_at < assistant_message.created_at,
        )
        .order_by(Message.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()
