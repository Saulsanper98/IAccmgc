import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import Settings
from app.db.models import MessageRole, QaFeedbackRating, ValidatedQa
from app.services.chat import RAG_SYSTEM_PROMPT, build_rag_user_message
from app.services.chat_instructions import build_rag_system_prompt
from app.services.validated_qa import (
    ValidatedQaHit,
    ValidatedQAService,
    validated_hits_to_prompt_entries,
)


BASE = RAG_SYSTEM_PROMPT
TEAM = "Para Power BI web, revisar página Web CCMGC."
USER = "Prefiero respuestas muy breves."
CONTEXT = "(No se encontraron fragmentos relevantes en la documentación indexada.)"
QUESTION = "¿Puerto LDAP?"


def _baseline_system_prompt() -> str:
    return build_rag_system_prompt(
        BASE,
        team_instructions=TEAM,
        user_instructions=USER,
    )


def _baseline_user_message() -> str:
    return build_rag_user_message(CONTEXT, QUESTION)


def test_no_match_system_prompt_byte_identical_to_baseline():
    prompt = build_rag_system_prompt(
        BASE,
        team_instructions=TEAM,
        user_instructions=USER,
        validated_qa_entries=None,
    )
    assert prompt == _baseline_system_prompt()

    prompt_empty = build_rag_system_prompt(
        BASE,
        team_instructions=TEAM,
        user_instructions=USER,
        validated_qa_entries=[],
    )
    assert prompt_empty == _baseline_system_prompt()


def test_no_match_user_message_byte_identical_to_baseline():
    assert build_rag_user_message(CONTEXT, QUESTION) == _baseline_user_message()


def test_match_injects_validated_section_with_exact_format():
    entries = validated_hits_to_prompt_entries(
        [
            ValidatedQaHit(
                id=uuid.uuid4(),
                question="¿Puerto LDAP?",
                answer="636",
                valid_from=date(2026, 6, 1),
                validated_at=datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc),
                similarity=0.91,
                verification="bypass",
            )
        ]
    )
    prompt = build_rag_system_prompt(
        BASE,
        team_instructions=TEAM,
        user_instructions=USER,
        validated_qa_entries=entries,
    )

    baseline = _baseline_system_prompt()
    assert prompt.startswith(baseline)
    assert "### Respuestas validadas por el equipo (máxima prioridad)" in prompt
    assert "[Q]: ¿Puerto LDAP?" in prompt
    assert "[A]: 636 (validada el 2026-06-15)" in prompt
    assert prompt.index("Instrucciones del equipo") < prompt.index("Respuestas validadas")
    assert prompt.index("Instrucciones personales") < prompt.index("Respuestas validadas")


def test_instructions_005_order_preserved_with_validated_section():
    prompt = build_rag_system_prompt(
        BASE,
        team_instructions=TEAM,
        user_instructions=USER,
        validated_qa_entries=validated_hits_to_prompt_entries(
            [
                ValidatedQaHit(
                    id=uuid.uuid4(),
                    question="Q",
                    answer="A",
                    valid_from=date.today(),
                    validated_at=datetime.now(timezone.utc),
                    similarity=0.9,
                    verification="bypass",
                )
            ]
        ),
    )
    assert prompt.index("Instrucciones del equipo") < prompt.index("Instrucciones personales")
    assert prompt.index("Instrucciones personales") < prompt.index("Respuestas validadas")


def test_search_validated_sql_filters_valid_until():
    import inspect

    sql = inspect.getsource(ValidatedQAService.search_validated)
    assert "valid_until IS NULL OR valid_until >=" in sql
    assert "status = 'validated'" in sql
    assert "valid_from <=" in sql


@pytest.mark.asyncio
async def test_valid_until_expired_excluded_from_hits():
    service = ValidatedQAService(AsyncMock(), Settings())
    session = AsyncMock()
    service._session = session
    session.execute = AsyncMock(
        return_value=MagicMock(mappings=MagicMock(return_value=[]))
    )

    hits, max_similarity = await service.search_validated(
        [0.1] * 1024,
        query_text="test",
    )

    assert hits == []
    assert max_similarity == 0.0


def test_diary_query_skips_validated_search():
    assert ValidatedQAService.should_search_for_rag(is_diary_query=True) is False
    assert ValidatedQAService.should_search_for_rag(is_diary_query=False) is True


@pytest.mark.asyncio
async def test_diary_flow_never_calls_search_validated():
    from app.services.chat import ChatService

    session = AsyncMock()
    settings = Settings()
    service = ChatService(session, settings)

    with patch.object(
        ValidatedQAService, "search_validated", new_callable=AsyncMock
    ) as mock_search:
        assert ValidatedQAService.should_search_for_rag(is_diary_query=True) is False
        mock_search.assert_not_called()
