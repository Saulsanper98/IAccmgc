from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from app.config import Settings
from app.services.chat import RAG_SYSTEM_PROMPT, build_rag_user_message
from app.services.chat_instructions import build_rag_system_prompt
from app.services.validated_qa import (
    ValidatedQAService,
    build_verify_user_message,
    parse_verification_json,
    validated_hits_to_metadata,
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


def _settings(**overrides) -> Settings:
    defaults = {
        "validated_qa_recall_threshold": 0.70,
        "validated_qa_verify_bypass": 0.98,
        "validated_qa_max_results": 2,
    }
    defaults.update(overrides)
    return Settings(**defaults)


def _candidate_row(*, similarity: float, question: str = "Como reinicio nginx en el servidor wiki") -> dict:
    return {
        "id": uuid.uuid4(),
        "question": question,
        "answer": "nginx -s reload",
        "valid_from": date.today(),
        "updated_at": datetime.now(timezone.utc),
        "similarity": similarity,
    }


def _mock_search_session(rows: list[dict]) -> AsyncMock:
    session = AsyncMock()
    session.execute = AsyncMock(
        return_value=MagicMock(mappings=MagicMock(return_value=rows))
    )
    return session


@pytest.mark.parametrize(
    ("response", "expected"),
    [
        ('{"misma_informacion": true}', True),
        ('{"misma_informacion": false}', False),
        ("", False),
        ("not json", False),
        ('{"misma_informacion": "true"}', False),
        ('{"otra_clave": true}', False),
    ],
)
def test_parse_verification_json(response, expected):
    assert parse_verification_json(response) is expected


@pytest.mark.asyncio
async def test_verify_question_match_malformed_json_fail_closed():
    service = ValidatedQAService(AsyncMock(), _settings())
    with patch.object(
        service,
        "_call_verify_llm",
        new_callable=AsyncMock,
        return_value='{"misma_informacion": "yes"}',
    ):
        accepted = await service._verify_question_match("user q", "candidate q")
    assert accepted is False


@pytest.mark.asyncio
async def test_template_collision_llm_rejects_high_similarity():
    service = ValidatedQAService(
        _mock_search_session([_candidate_row(similarity=0.86, question="Como reinicio nginx...")]),
        _settings(),
    )
    with patch.object(service, "_verify_question_match", new_callable=AsyncMock, return_value=False):
        hits, _ = await service.search_validated(
            [0.1] * 1024,
            query_text="¿Cómo reinicio el servicio postgres en el servidor wiki interno?",
        )

    assert hits == []


@pytest.mark.asyncio
async def test_paraphrase_llm_accepts_recall_candidate():
    row = _candidate_row(similarity=0.77)
    service = ValidatedQAService(_mock_search_session([row]), _settings())

    with patch.object(service, "_verify_question_match", new_callable=AsyncMock, return_value=True):
        hits, _ = await service.search_validated(
            [0.1] * 1024,
            query_text="¿Cómo levanto nginx si está caído en el servidor de la wiki?",
        )

    assert len(hits) == 1
    assert hits[0].similarity == 0.77
    assert hits[0].verification == "llm_yes"

    entries = validated_hits_to_prompt_entries(hits)
    assert entries[0]["answer"] == "nginx -s reload"
    metadata = validated_hits_to_metadata(hits)
    assert metadata[0]["verification"] == "llm_yes"
    assert metadata[0]["similarity"] == 0.77


@pytest.mark.asyncio
async def test_bypass_skips_llm_verification():
    row = _candidate_row(similarity=0.99)
    service = ValidatedQAService(_mock_search_session([row]), _settings())

    with patch.object(service, "_verify_question_match", new_callable=AsyncMock) as mock_verify:
        hits, _ = await service.search_validated(
            [0.1] * 1024,
            query_text="Como reinicio el servicio nginx en el servidor wiki interno",
        )

    mock_verify.assert_not_awaited()
    assert len(hits) == 1
    assert hits[0].verification == "bypass"


@pytest.mark.asyncio
async def test_verify_timeout_fail_closed(caplog):
    row = _candidate_row(similarity=0.80)
    service = ValidatedQAService(_mock_search_session([row]), _settings())

    with patch.object(
        service,
        "_verify_question_match",
        new_callable=AsyncMock,
        side_effect=httpx.TimeoutException("timeout"),
    ):
        with caplog.at_level("ERROR", logger="app.services.validated_qa"):
            hits, _ = await service.search_validated(
                [0.1] * 1024,
                query_text="¿Cómo levanto nginx si está caído?",
            )

    assert hits == []
    assert any("verdict=error" in record.message for record in caplog.records)


@pytest.mark.asyncio
async def test_no_recall_candidates_skips_llm_verification():
    row = _candidate_row(similarity=0.65)
    service = ValidatedQAService(_mock_search_session([row]), _settings())

    with patch.object(service, "_verify_question_match", new_callable=AsyncMock) as mock_verify:
        hits, max_similarity = await service.search_validated(
            [0.1] * 1024,
            query_text="¿Puerto LDAP?",
        )

    mock_verify.assert_not_awaited()
    assert hits == []
    assert max_similarity == 0.65


@pytest.mark.asyncio
async def test_call_verify_llm_uses_json_format_and_few_shot_prompt():
    service = ValidatedQAService(AsyncMock(), _settings())
    with patch.object(
        service._ollama,
        "chat_complete",
        new_callable=AsyncMock,
        return_value=json.dumps({"misma_informacion": True}),
    ) as mock_chat:
        accepted = await service._verify_question_match(
            "¿Cómo reinicio el servicio postgres en el servidor wiki interno?",
            "Como reinicio el servicio nginx en el servidor wiki interno",
        )

    assert accepted is True
    mock_chat.assert_awaited_once()
    kwargs = mock_chat.await_args.kwargs
    assert kwargs["response_format"] == "json"
    assert kwargs["temperature"] == 0
    assert kwargs["num_predict"] == 20
    user_content = mock_chat.await_args.args[0][0]["content"]
    assert "Ejemplos:" in user_content
    assert "Caso real:" in user_content
    assert "¿Cómo paro nginx en el servidor wiki interno?" in user_content
    assert user_content.count('{"misma_informacion": false}') == 3
    assert user_content.count('{"misma_informacion": true}') == 1
    assert build_verify_user_message(
        "Como reinicio el servicio nginx en el servidor wiki interno",
        "¿Cómo reinicio el servicio postgres en el servidor wiki interno?",
    ) == user_content


def test_no_candidates_system_prompt_byte_identical_to_baseline():
    prompt = build_rag_system_prompt(
        BASE,
        team_instructions=TEAM,
        user_instructions=USER,
        validated_qa_entries=None,
    )
    assert prompt == _baseline_system_prompt()
    assert build_rag_user_message(CONTEXT, QUESTION) == _baseline_user_message()
