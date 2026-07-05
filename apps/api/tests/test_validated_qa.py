from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import Settings
from app.db.models import (
    MessageRole,
    QaFeedback,
    QaFeedbackRating,
    ValidatedQa,
    ValidatedQaStatus,
)
from app.services.query_embedding import embed_query_text, prepare_query_text
from app.services.validated_qa import ValidatedQAService


def _settings() -> Settings:
    return Settings(
        validated_qa_recall_threshold=0.70,
        validated_qa_verify_bypass=0.98,
        validated_qa_max_results=2,
    )


def test_prepare_query_text_strips_whitespace():
    assert prepare_query_text("  hola  ") == "hola"


@pytest.mark.asyncio
async def test_embed_query_text_uses_ollama_with_prepared_text():
    ollama = AsyncMock()
    ollama.embed_text.return_value = [0.1, 0.2]

    result = await embed_query_text("  pregunta  ", ollama)

    assert result == [0.1, 0.2]
    ollama.embed_text.assert_awaited_once_with("pregunta")


@pytest.mark.asyncio
async def test_create_and_edit_use_same_embed_query_text_path():
    """Creating pending Q&A and editing the question must both call embed_query_text."""
    with patch(
        "app.services.validated_qa.embed_query_text",
        new_callable=AsyncMock,
        side_effect=[[0.1] * 1024, [0.2] * 1024],
    ) as mock_embed:
        session = AsyncMock()
        service = ValidatedQAService(session, _settings())

        feedback = QaFeedback(
            id=uuid.uuid4(),
            chat_message_id=uuid.uuid4(),
            question="Puerto LDAP?",
            answer="389",
            rating=QaFeedbackRating.DOWN,
            correction="636",
            created_by="user-1",
        )
        session.execute = AsyncMock(
            return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None))
        )

        await service._ensure_pending_validated_qa(
            feedback=feedback,
            question="  Puerto LDAP?  ",
            correction="636",
            user_id="user-1",
        )

        row = ValidatedQa(
            id=uuid.uuid4(),
            question="Puerto LDAP?",
            question_embedding=[0.1] * 1024,
            answer="636",
            status=ValidatedQaStatus.PENDING,
            created_by="user-1",
            valid_from=date.today(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.get = AsyncMock(return_value=row)
        session.refresh = AsyncMock()

        await service.update_for_admin(
            row.id,
            "admin-1",
            question="  Que puerto usa LDAP?  ",
            fields_set={"question"},
        )

        assert mock_embed.await_count == 2
        embedded_questions = [call.args[0] for call in mock_embed.await_args_list]
        assert "Puerto LDAP?" in embedded_questions
        assert "Que puerto usa LDAP?" in embedded_questions


@pytest.mark.asyncio
async def test_submit_feedback_down_with_correction_promotes_to_pending():
    session = AsyncMock()
    service = ValidatedQAService(session, _settings())

    assistant_id = uuid.uuid4()
    conv_id = uuid.uuid4()
    assistant = MagicMock(
        id=assistant_id,
        role=MessageRole.ASSISTANT,
        conversation_id=conv_id,
        content="Puerto 389",
    )
    user_msg = MagicMock(role=MessageRole.USER, content="¿Puerto LDAP?")
    conversation = MagicMock(user_id="user-1")

    session.get = AsyncMock(side_effect=lambda model, pk: {
        assistant_id: assistant,
        conv_id: conversation,
    }.get(pk))
    session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=MagicMock(return_value=user_msg)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
    )

    with patch(
        "app.services.validated_qa.embed_query_text",
        new_callable=AsyncMock,
        return_value=[0.5] * 1024,
    ):
        result = await service.submit_message_feedback(
            assistant_id,
            "user-1",
            QaFeedbackRating.DOWN,
            correction="636",
        )

    assert result is not None
    assert result["rating"] == "down"
    assert result["validated_qa_status"] == "pending"
    assert "validated_qa_id" in result
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_submit_feedback_up_does_not_create_validated_qa():
    session = AsyncMock()
    service = ValidatedQAService(session, _settings())

    assistant_id = uuid.uuid4()
    conv_id = uuid.uuid4()
    assistant = MagicMock(
        id=assistant_id,
        role=MessageRole.ASSISTANT,
        conversation_id=conv_id,
        content="Correcto",
    )
    user_msg = MagicMock(role=MessageRole.USER, content="¿Está bien?")
    conversation = MagicMock(user_id="user-1")

    session.get = AsyncMock(side_effect=lambda model, pk: {
        assistant_id: assistant,
        conv_id: conversation,
    }.get(pk))
    session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=MagicMock(return_value=user_msg)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
    )

    result = await service.submit_message_feedback(
        assistant_id,
        "user-1",
        QaFeedbackRating.UP,
    )

    assert result is not None
    assert "validated_qa_id" not in result
    added = [call.args[0] for call in session.add.call_args_list]
    assert all(not isinstance(obj, ValidatedQa) for obj in added)


@pytest.mark.asyncio
async def test_update_status_validated_sets_validated_by():
    session = AsyncMock()
    service = ValidatedQAService(session, _settings())

    row = ValidatedQa(
        id=uuid.uuid4(),
        question="Q",
        question_embedding=[0.1] * 1024,
        answer="A",
        status=ValidatedQaStatus.PENDING,
        created_by="user-1",
        valid_from=date.today(),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.get = AsyncMock(return_value=row)
    session.refresh = AsyncMock()

    result = await service.update_for_admin(
        row.id,
        "admin-1",
        status=ValidatedQaStatus.VALIDATED,
    )

    assert result is not None
    assert row.status == ValidatedQaStatus.VALIDATED
    assert row.validated_by == "admin-1"
    session.commit.assert_awaited()


@pytest.mark.asyncio
async def test_update_recomputes_embedding_when_question_changes():
    session = AsyncMock()
    service = ValidatedQAService(session, _settings())
    service._ollama = AsyncMock()

    row = ValidatedQa(
        id=uuid.uuid4(),
        question="Antigua",
        question_embedding=[0.0] * 1024,
        answer="A",
        status=ValidatedQaStatus.PENDING,
        created_by="user-1",
        valid_from=date.today(),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    session.get = AsyncMock(return_value=row)
    session.refresh = AsyncMock()

    with patch(
        "app.services.validated_qa.embed_query_text",
        new_callable=AsyncMock,
        return_value=[0.9] * 1024,
    ) as mock_embed:
        await service.update_for_admin(
            row.id,
            "admin-1",
            question="Nueva pregunta",
            fields_set={"question"},
        )

    mock_embed.assert_awaited_once_with("Nueva pregunta", service._ollama)
    assert row.question == "Nueva pregunta"
    assert row.question_embedding == [0.9] * 1024


@pytest.mark.asyncio
async def test_search_validated_bypass_accepts_near_literal(caplog):
    session = AsyncMock()
    service = ValidatedQAService(session, _settings())

    row_id = uuid.uuid4()
    session.execute = AsyncMock(
        return_value=MagicMock(
            mappings=MagicMock(
                return_value=[
                    {
                        "id": row_id,
                        "question": "¿Puerto LDAP?",
                        "answer": "636",
                        "valid_from": date.today(),
                        "updated_at": datetime.now(timezone.utc),
                        "similarity": 0.99,
                    },
                ]
            )
        )
    )

    with caplog.at_level("INFO", logger="app.services.validated_qa"):
        hits, max_similarity = await service.search_validated(
            [0.1] * 1024,
            query_text="¿Puerto LDAP?",
        )

    assert max_similarity == 0.99
    assert len(hits) == 1
    assert hits[0].id == row_id
    assert hits[0].verification == "bypass"
    assert any("verdict=bypass" in record.message for record in caplog.records)


@pytest.mark.asyncio
async def test_search_validated_no_hits_when_below_recall_threshold(caplog):
    session = AsyncMock()
    service = ValidatedQAService(session, _settings())

    session.execute = AsyncMock(
        return_value=MagicMock(
            mappings=MagicMock(
                return_value=[
                    {
                        "id": uuid.uuid4(),
                        "question": "P",
                        "answer": "A",
                        "valid_from": date.today(),
                        "updated_at": datetime.now(timezone.utc),
                        "similarity": 0.65,
                    },
                ]
            )
        )
    )

    with caplog.at_level("INFO", logger="app.services.validated_qa"):
        hits, max_similarity = await service.search_validated(
            [0.1] * 1024,
            query_text="¿Puerto LDAP?",
        )

    assert hits == []
    assert max_similarity == 0.65
    assert not any("verdict=" in record.message for record in caplog.records)


def test_feedback_request_accepts_legacy_rating_without_promotion_fields():
    from app.api.routes.chat import FeedbackRequest
    from app.db.models import QaFeedbackRating

    body = FeedbackRequest.model_validate({"rating": 1, "comment": None})
    assert body.rating == QaFeedbackRating.UP
    assert body.legacy is True
    assert body.correction is None

    body = FeedbackRequest.model_validate({"rating": -1, "comment": "faltó detalle"})
    assert body.rating == QaFeedbackRating.DOWN
    assert body.legacy is True
    assert body.comment == "faltó detalle"
    assert body.correction is None

    body = FeedbackRequest.model_validate({"rating": "down", "correction": "636"})
    assert body.rating == QaFeedbackRating.DOWN
    assert body.legacy is False
    assert body.correction == "636"


@pytest.mark.asyncio
async def test_legacy_down_with_comment_does_not_create_validated_qa():
    session = AsyncMock()
    service = ValidatedQAService(session, Settings())

    assistant_id = uuid.uuid4()
    conv_id = uuid.uuid4()
    assistant = MagicMock(
        id=assistant_id,
        role=MessageRole.ASSISTANT,
        conversation_id=conv_id,
        content="Puerto 389",
    )
    user_msg = MagicMock(role=MessageRole.USER, content="¿Puerto LDAP?")
    conversation = MagicMock(user_id="user-1")

    session.get = AsyncMock(side_effect=lambda model, pk: {
        assistant_id: assistant,
        conv_id: conversation,
    }.get(pk))
    session.execute = AsyncMock(
        side_effect=[
            MagicMock(scalar_one_or_none=MagicMock(return_value=user_msg)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
    )

    with patch.object(service, "_ensure_pending_validated_qa", new_callable=AsyncMock) as mock_promote:
        result = await service.submit_message_feedback(
            assistant_id,
            "user-1",
            QaFeedbackRating.DOWN,
            comment="faltó detalle",
            legacy=True,
        )

    mock_promote.assert_not_awaited()
    assert result is not None
    assert "validated_qa_id" not in result
    added = [call.args[0] for call in session.add.call_args_list]
    assert not any(isinstance(obj, ValidatedQa) for obj in added)
    feedback_objs = [obj for obj in added if isinstance(obj, QaFeedback)]
    assert len(feedback_objs) == 1
    assert feedback_objs[0].is_legacy is True


def test_admin_route_requires_admin_role():
    from fastapi import HTTPException

    from app.api.deps import AuthenticatedUser
    from app.api.routes.admin_validated_qa import _require_admin

    with pytest.raises(HTTPException) as exc:
        _require_admin(AuthenticatedUser("u1", "lector"))
    assert exc.value.status_code == 403
