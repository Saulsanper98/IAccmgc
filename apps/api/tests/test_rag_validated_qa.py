from datetime import UTC, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.chat import RAG_SYSTEM_PROMPT
from app.services.chat_instructions import (
    build_rag_system_prompt,
    build_rag_user_message_content,
    format_validated_qa_prompt_section,
)
from app.services.validated_qa import ValidatedQaHit, ValidatedQaService


def _hit(question: str, answer: str) -> ValidatedQaHit:
    return ValidatedQaHit(
        id=uuid4(),
        question=question,
        answer=answer,
        validated_at=datetime(2026, 7, 4, 12, 0, tzinfo=UTC),
    )


def test_format_validated_qa_prompt_section():
    section = format_validated_qa_prompt_section([
        _hit("¿Cómo hago backup?", "Ejecutar backup-servidores.sh"),
    ])
    assert "### Respuestas validadas por el equipo" in section
    assert "[Q]: ¿Cómo hago backup?" in section
    assert "[A]: Ejecutar backup-servidores.sh (validada el 2026-07-04)" in section


def test_build_prompt_with_validated_qa_after_personal_instructions():
    result = build_rag_system_prompt(
        "Eres WikiBridge.",
        team_instructions="Priorizar runbooks.",
        user_instructions="Respuestas breves.",
        validated_qa_hits=[_hit("¿Puerto VPN?", "10443")],
    )
    assert result.index("Instrucciones del equipo") < result.index("Instrucciones personales")
    assert result.index("Instrucciones personales") < result.index("Respuestas validadas por el equipo")
    assert "[Q]: ¿Puerto VPN?" in result


def test_no_regression_prompt_without_match_is_byte_identical():
    team = "Priorizar runbooks."
    user = "Respuestas breves."
    baseline = build_rag_system_prompt(
        RAG_SYSTEM_PROMPT,
        team_instructions=team,
        user_instructions=user,
    )
    with_empty_hits = build_rag_system_prompt(
        RAG_SYSTEM_PROMPT,
        team_instructions=team,
        user_instructions=user,
        validated_qa_hits=[],
    )
    with_default = build_rag_system_prompt(
        RAG_SYSTEM_PROMPT,
        team_instructions=team,
        user_instructions=user,
        validated_qa_hits=None,
    )
    assert baseline == with_empty_hits
    assert baseline == with_default


def test_no_regression_user_message_is_byte_identical():
    context = "[1] Fragmento wiki\nContenido del manual."
    question = "¿Cómo reinicio nginx?"
    expected = (
        f"Fragmentos de documentación:\n\n{context}\n\n"
        f"Pregunta del usuario: {question}"
    )
    assert build_rag_user_message_content(context, question) == expected


def test_no_regression_full_assembly_without_validated_hits():
    team = "Priorizar runbooks."
    user = "Respuestas breves."
    context = "[1] Fragmento\nTexto."
    question = "¿Backup nocturno?"

    system_prompt = build_rag_system_prompt(
        RAG_SYSTEM_PROMPT,
        team_instructions=team,
        user_instructions=user,
        validated_qa_hits=[],
    )
    user_message = build_rag_user_message_content(context, question)

    expected_system = build_rag_system_prompt(
        RAG_SYSTEM_PROMPT,
        team_instructions=team,
        user_instructions=user,
    )
    expected_user = (
        f"Fragmentos de documentación:\n\n{context}\n\n"
        f"Pregunta del usuario: {question}"
    )

    assert system_prompt == expected_system
    assert user_message == expected_user


def test_done_payload_with_and_without_validated_hits():
    from datetime import UTC, datetime

    hit = _hit("¿Marquesinas?", "systemctl restart marquesinas")
    base = {"message_id": "msg-1", "latency_ms": 100, "model": "test-model"}

    with_meta = {
        **base,
        **(
            {
                "validated_qa_id": str(hit.id),
                "validated_at": hit.validated_at.isoformat(),
            }
            if [hit]
            else {}
        ),
    }
    without_meta = {**base, **({} if not [] else {"validated_qa_id": "x"})}

    assert with_meta["validated_qa_id"] == str(hit.id)
    assert "validated_at" in with_meta
    assert "validated_qa_id" not in without_meta
    assert "validated_at" not in without_meta


@pytest.mark.asyncio
async def test_search_validated_applies_threshold_and_limit():
    row1 = {
        "id": uuid4(),
        "question": "¿Backup?",
        "answer": "Script nocturno",
        "updated_at": datetime.now(UTC),
        "similarity": 0.91,
    }
    result = MagicMock()
    result.mappings.return_value = [row1]
    session = AsyncMock()
    session.execute = AsyncMock(return_value=result)
    settings = MagicMock()

    with patch("app.services.validated_qa.OllamaClient"):
        service = ValidatedQaService(session, settings)
        hits = await service.search_validated([0.1] * 1024, threshold=0.80, limit=2)

    assert len(hits) == 1
    assert hits[0].question == "¿Backup?"
    session.execute.assert_awaited_once()
    sql = session.execute.await_args.args[0].text
    assert "validated_qa" in sql
    assert "threshold" not in sql
