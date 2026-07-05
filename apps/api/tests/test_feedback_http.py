"""HTTP integration tests for POST /api/chat/messages/{id}/feedback.

Exercises the full FastAPI route + Pydantic parsing + JSON serialization.
Service-layer unit tests mock ValidatedQAService directly; these catch regressions
in the HTTP boundary (e.g. rating.value on str, missing response fields).
"""

from __future__ import annotations

import uuid
from collections import deque
from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.db.models import MessageRole
from app.db.session import get_db
from app.main import create_app

TEST_TOKEN = "test-internal-token"
TEST_USER = "http-test-user"
AUTH_HEADERS = {
    "X-Internal-Token": TEST_TOKEN,
    "X-User-Id": TEST_USER,
    "X-User-Role": "admin",
}


def _test_settings() -> Settings:
    return Settings(
        internal_service_token=TEST_TOKEN,
        validated_qa_recall_threshold=0.70,
    )


def _build_mock_session(*, expect_validated_qa_lookup: bool) -> tuple[AsyncMock, uuid.UUID]:
    assistant_id = uuid.uuid4()
    conv_id = uuid.uuid4()
    now = datetime.now(UTC)
    assistant = MagicMock(
        id=assistant_id,
        role=MessageRole.ASSISTANT,
        conversation_id=conv_id,
        content="Respuesta del asistente",
        created_at=now,
    )
    user_msg = MagicMock(role=MessageRole.USER, content="¿Pregunta del usuario?")
    conversation = MagicMock(user_id=TEST_USER)

    execute_queue: deque = deque(
        [
            MagicMock(scalar_one_or_none=MagicMock(return_value=user_msg)),
            MagicMock(scalar_one_or_none=MagicMock(return_value=None)),
        ]
    )
    if expect_validated_qa_lookup:
        execute_queue.append(MagicMock(scalar_one_or_none=MagicMock(return_value=None)))

    added: list = []
    session = AsyncMock()
    session.get = AsyncMock(
        side_effect=lambda model, pk: {
            assistant_id: assistant,
            conv_id: conversation,
        }.get(pk)
    )
    session.execute = AsyncMock(side_effect=lambda *_args, **_kwargs: execute_queue.popleft())
    session.add = MagicMock(side_effect=lambda obj: added.append(obj))

    async def flush() -> None:
        for obj in added:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()

    session.flush = AsyncMock(side_effect=flush)
    session.commit = AsyncMock()
    return session, assistant_id, added


@pytest.fixture
def feedback_http_client():
    app = create_app()
    app.dependency_overrides[get_settings] = _test_settings

    with patch(
        "app.services.validated_qa.embed_query_text",
        new_callable=AsyncMock,
        return_value=[0.1] * 1024,
    ):
        yield app

    app.dependency_overrides.clear()


def _post_feedback(client: TestClient, assistant_id: uuid.UUID, body: dict) -> dict:
    response = client.post(
        f"/api/chat/messages/{assistant_id}/feedback",
        json=body,
        headers=AUTH_HEADERS,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_feedback_http_new_schema_down_with_correction(feedback_http_client):
    session, assistant_id, _added = _build_mock_session(expect_validated_qa_lookup=True)

    async def override_db():
        yield session

    feedback_http_client.dependency_overrides[get_db] = override_db

    with TestClient(feedback_http_client) as client:
        data = _post_feedback(
            client,
            assistant_id,
            {
                "rating": "down",
                "correction": "La respuesta correcta es usar nginx -s reload.",
            },
        )

    assert data["message_id"] == str(assistant_id)
    assert data["rating"] == "down"
    assert isinstance(data["rating"], str)
    uuid.UUID(data["feedback_id"])
    uuid.UUID(data["validated_qa_id"])
    assert data["validated_qa_status"] == "pending"


def test_feedback_http_new_schema_up(feedback_http_client):
    session, assistant_id, _added = _build_mock_session(expect_validated_qa_lookup=False)

    async def override_db():
        yield session

    feedback_http_client.dependency_overrides[get_db] = override_db

    with TestClient(feedback_http_client) as client:
        data = _post_feedback(client, assistant_id, {"rating": "up"})

    assert data["message_id"] == str(assistant_id)
    assert data["rating"] == "up"
    uuid.UUID(data["feedback_id"])
    assert "validated_qa_id" not in data


def test_feedback_http_legacy_down_with_comment(feedback_http_client):
    session, assistant_id, added = _build_mock_session(expect_validated_qa_lookup=False)

    async def override_db():
        yield session

    feedback_http_client.dependency_overrides[get_db] = override_db

    with TestClient(feedback_http_client) as client:
        data = _post_feedback(
            client,
            assistant_id,
            {"rating": -1, "comment": "Respuesta incorrecta"},
        )

    assert data["message_id"] == str(assistant_id)
    assert data["rating"] == "down"
    uuid.UUID(data["feedback_id"])
    assert "validated_qa_id" not in data
    feedback_objs = [obj for obj in added if hasattr(obj, "is_legacy")]
    assert len(feedback_objs) == 1
    assert feedback_objs[0].is_legacy is True


def test_feedback_http_legacy_up(feedback_http_client):
    session, assistant_id, added = _build_mock_session(expect_validated_qa_lookup=False)

    async def override_db():
        yield session

    feedback_http_client.dependency_overrides[get_db] = override_db

    with TestClient(feedback_http_client) as client:
        data = _post_feedback(client, assistant_id, {"rating": 1})

    assert data["message_id"] == str(assistant_id)
    assert data["rating"] == "up"
    uuid.UUID(data["feedback_id"])
    assert "validated_qa_id" not in data
    feedback_objs = [obj for obj in added if hasattr(obj, "is_legacy")]
    assert len(feedback_objs) == 1
    assert feedback_objs[0].is_legacy is True
