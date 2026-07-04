import uuid
from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.db.models import Feedback, Message, MessageRole, ValidatedQa, ValidatedQaStatus
from app.services.validated_qa import FeedbackPromotionResult, ValidatedQaService, find_preceding_user_question


@pytest.mark.asyncio
async def test_find_preceding_user_question():
    assistant = Message(
        id=uuid.uuid4(),
        conversation_id=uuid.uuid4(),
        role=MessageRole.ASSISTANT,
        content="Respuesta del sistema",
        created_at=datetime.now(UTC),
    )
    session = AsyncMock()
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = "¿Cómo hago backup?"
    session.execute.return_value = result_mock

    question = await find_preceding_user_question(session, assistant)
    assert question == "¿Cómo hago backup?"


@pytest.mark.asyncio
async def test_create_from_feedback_inserts_pending_with_embedding():
    session = AsyncMock()
    session.execute.return_value = MagicMock(scalar_one_or_none=lambda: None)

    feedback = Feedback(
        id=uuid.uuid4(),
        message_id=uuid.uuid4(),
        user_id="user-1",
        rating=-1,
        correction="La respuesta correcta es X",
    )
    settings = MagicMock()
    settings.embedding_dim = 1024

    with patch("app.services.validated_qa.OllamaClient") as mock_ollama_cls:
        mock_ollama = mock_ollama_cls.return_value
        mock_ollama.embed_text = AsyncMock(return_value=[0.1] * 1024)

        service = ValidatedQaService(session, settings)
        result = await service.create_or_update_from_feedback(
            feedback,
            question="¿Cuál es el procedimiento?",
            correction="La respuesta correcta es X",
            created_by="user-1",
        )

    assert result.action == "created"
    assert result.entry is not None
    assert result.entry.status == ValidatedQaStatus.PENDING
    assert result.entry.source_feedback_id == feedback.id
    mock_ollama.embed_text.assert_awaited_once_with("¿Cuál es el procedimiento?")
    session.add.assert_called_once()


@pytest.mark.asyncio
async def test_create_from_feedback_updates_pending_without_touching_validated():
    session = AsyncMock()
    existing = ValidatedQa(
        id=uuid.uuid4(),
        question="Pregunta antigua",
        question_embedding=[0.0] * 1024,
        answer="Respuesta antigua",
        status=ValidatedQaStatus.PENDING,
        created_by="user-1",
    )
    session.execute.return_value = MagicMock(scalar_one_or_none=lambda: existing)

    feedback = Feedback(id=uuid.uuid4(), message_id=uuid.uuid4(), user_id="user-1", rating=-1)
    settings = MagicMock()

    with patch("app.services.validated_qa.OllamaClient") as mock_ollama_cls:
        mock_ollama = mock_ollama_cls.return_value
        mock_ollama.embed_text = AsyncMock(return_value=[0.2] * 1024)

        service = ValidatedQaService(session, settings)
        result = await service.create_or_update_from_feedback(
            feedback,
            question="Pregunta nueva",
            correction="Respuesta nueva",
            created_by="user-1",
        )

    assert result.action == "updated"
    assert existing.question == "Pregunta nueva"
    assert existing.answer == "Respuesta nueva"
    assert existing.status == ValidatedQaStatus.PENDING
    mock_ollama.embed_text.assert_awaited_once()


@pytest.mark.asyncio
async def test_create_from_feedback_ignores_when_already_validated():
    session = AsyncMock()
    existing = ValidatedQa(
        id=uuid.uuid4(),
        question="Pregunta validada",
        question_embedding=[0.0] * 1024,
        answer="Respuesta validada",
        status=ValidatedQaStatus.VALIDATED,
        validated_by="admin-1",
        created_by="user-1",
    )
    session.execute.return_value = MagicMock(scalar_one_or_none=lambda: existing)

    feedback = Feedback(id=uuid.uuid4(), message_id=uuid.uuid4(), user_id="user-1", rating=-1)
    settings = MagicMock()

    with patch("app.services.validated_qa.OllamaClient") as mock_ollama_cls:
        mock_ollama = mock_ollama_cls.return_value
        service = ValidatedQaService(session, settings)
        result = await service.create_or_update_from_feedback(
            feedback,
            question="Otra pregunta",
            correction="Otra respuesta",
            created_by="user-1",
        )

    assert result.action == "ignored_validated"
    assert result.entry is None
    assert existing.status == ValidatedQaStatus.VALIDATED
    assert existing.answer == "Respuesta validada"
    mock_ollama.embed_text.assert_not_called()


@pytest.mark.asyncio
async def test_submit_feedback_positive_does_not_create_validated_qa():
    from app.services.chat import ChatService

    message_id = uuid.uuid4()
    conversation_id = uuid.uuid4()
    message = Message(
        id=message_id,
        conversation_id=conversation_id,
        role=MessageRole.ASSISTANT,
        content="Respuesta",
        created_at=datetime.now(UTC),
    )
    conversation = MagicMock(user_id="user-1")

    session = AsyncMock()
    session.get = AsyncMock(side_effect=lambda model, pk: message if model is Message else conversation)
    session.execute.return_value = MagicMock(scalar_one_or_none=lambda: None)

    settings = MagicMock()
    with patch("app.services.chat.OllamaClient"), patch("app.services.chat.QueryEmbeddingCache"):
        service = ChatService(session, settings)
        result = await service.submit_feedback(message_id, "user-1", 1, comment="Útil")

    assert result == {"message_id": str(message_id), "rating": 1}
    assert "validated_qa_id" not in result
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_submit_feedback_negative_with_correction_creates_validated_qa():
    from app.services.chat import ChatService

    message_id = uuid.uuid4()
    conversation_id = uuid.uuid4()
    message = Message(
        id=message_id,
        conversation_id=conversation_id,
        role=MessageRole.ASSISTANT,
        content="Respuesta incorrecta",
        created_at=datetime.now(UTC),
    )
    conversation = MagicMock(user_id="user-1")
    feedback = Feedback(id=uuid.uuid4(), message_id=message_id, user_id="user-1", rating=-1)

    session = AsyncMock()
    session.get = AsyncMock(
        side_effect=lambda model, pk: {
            message_id: message,
            conversation_id: conversation,
            feedback.id: feedback,
        }.get(pk)
    )
    session.execute.return_value = MagicMock(scalar_one_or_none=lambda: None)

    settings = MagicMock()
    with patch("app.services.chat.OllamaClient"), patch("app.services.chat.QueryEmbeddingCache"):
        service = ChatService(session, settings)

        mock_vqa = MagicMock()
        mock_vqa.create_or_update_from_feedback = AsyncMock(
            return_value=FeedbackPromotionResult(
                entry=ValidatedQa(
                    id=uuid.uuid4(),
                    question="¿Cómo reinicio el servicio?",
                    question_embedding=[0.1] * 1024,
                    answer="Usa systemctl restart nginx",
                    status=ValidatedQaStatus.PENDING,
                    created_by="user-1",
                ),
                action="created",
            )
        )
        with patch(
            "app.services.validated_qa.find_preceding_user_question",
            AsyncMock(return_value="¿Cómo reinicio el servicio?"),
        ), patch(
            "app.services.validated_qa.ValidatedQaService",
            return_value=mock_vqa,
        ) as mock_service_cls:
            result = await service.submit_feedback(
                message_id,
                "user-1",
                -1,
                comment="Mal",
                correction="Usa systemctl restart nginx",
            )

    assert result["rating"] == -1
    assert result["validated_qa_status"] == "pending"
    assert "validated_qa_id" in result
    mock_service_cls.assert_called_once()
    mock_vqa.create_or_update_from_feedback.assert_awaited_once()


@pytest.mark.asyncio
async def test_submit_feedback_negative_without_correction_skips_validated_qa():
    from app.services.chat import ChatService

    message_id = uuid.uuid4()
    conversation_id = uuid.uuid4()
    message = Message(
        id=message_id,
        conversation_id=conversation_id,
        role=MessageRole.ASSISTANT,
        content="Respuesta",
        created_at=datetime.now(UTC),
    )
    conversation = MagicMock(user_id="user-1")

    session = AsyncMock()
    session.get = AsyncMock(side_effect=lambda model, pk: message if model is Message else conversation)
    session.execute.return_value = MagicMock(scalar_one_or_none=lambda: None)

    settings = MagicMock()
    with patch("app.services.chat.OllamaClient"), patch("app.services.chat.QueryEmbeddingCache"):
        service = ChatService(session, settings)

        with patch.object(ValidatedQaService, "create_or_update_from_feedback", AsyncMock()) as mock_create:
            result = await service.submit_feedback(message_id, "user-1", -1, comment="No útil")

    assert result == {"message_id": str(message_id), "rating": -1}
    mock_create.assert_not_awaited()


@pytest.mark.asyncio
async def test_update_entry_sets_validated_by_on_validate():
    row = ValidatedQa(
        id=uuid.uuid4(),
        question="Pregunta",
        question_embedding=[0.1] * 1024,
        answer="Respuesta",
        status=ValidatedQaStatus.PENDING,
        created_by="user-1",
        valid_from=date.today(),
    )
    session = AsyncMock()
    session.get = AsyncMock(return_value=row)
    settings = MagicMock()

    with patch("app.services.validated_qa.OllamaClient"):
        service = ValidatedQaService(session, settings)
        result = await service.update_entry(
            row.id,
            admin_user_id="admin-1",
            status=ValidatedQaStatus.VALIDATED,
        )

    assert row.validated_by == "admin-1"
    assert row.status == ValidatedQaStatus.VALIDATED
    assert result["status"] == "validated"
    session.commit.assert_awaited_once()
