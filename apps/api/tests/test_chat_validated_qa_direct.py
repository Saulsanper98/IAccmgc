from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.config import Settings
from app.db.models import MessageRole
from app.services.chat import ChatService, iter_response_tokens
from app.services.validated_qa import (
    ValidatedQaHit,
    pick_primary_validated_hit,
    build_validated_qa_citations,
)


def parse_sse(raw: str) -> list[tuple[str, dict]]:
    events: list[tuple[str, dict]] = []
    for block in raw.strip().split("\n\n"):
        if not block.strip():
            continue
        event_name = "message"
        data_line = ""
        for line in block.split("\n"):
            if line.startswith("event: "):
                event_name = line[7:].strip()
            elif line.startswith("data: "):
                data_line = line[6:]
        if data_line:
            events.append((event_name, json.loads(data_line)))
    return events


def _make_hit(
    *,
    answer: str,
    similarity: float = 0.95,
    verification: str = "llm_yes",
    hit_id: uuid.UUID | None = None,
) -> ValidatedQaHit:
    return ValidatedQaHit(
        id=hit_id or uuid.uuid4(),
        question="¿Cómo instalar el agente Zabbix en Linux?",
        answer=answer,
        valid_from=date(2026, 6, 1),
        validated_at=datetime(2026, 6, 15, 10, 0, tzinfo=timezone.utc),
        similarity=similarity,
        verification=verification,  # type: ignore[arg-type]
    )


def _build_service(settings: Settings | None = None) -> tuple[ChatService, AsyncMock, uuid.UUID]:
    session = AsyncMock()
    conv_id = uuid.uuid4()
    conversation = MagicMock()
    conversation.id = conv_id
    conversation.user_id = "user-1"
    conversation.title = "Nueva conversación"
    session.get = AsyncMock(return_value=conversation)

    def _refresh(obj):
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()

    session.refresh = AsyncMock(side_effect=_refresh)

    service = ChatService(session, settings or Settings(validated_qa_mode="direct"))
    return service, session, conv_id


async def _empty_stream(*_args, **_kwargs):
    if False:
        yield ""


@pytest.mark.asyncio
async def test_direct_mode_verified_match_returns_stored_answer_without_chat_llm():
    validated_answer = (
        "1. Añadir repo oficial Zabbix.\n"
        "2. Instalar zabbix-agent2.\n"
        "3. Editar /etc/zabbix/zabbix_agent2.conf."
    )
    hit = _make_hit(answer=validated_answer)
    service, _session, conv_id = _build_service(Settings(validated_qa_mode="direct"))

    with (
        patch.object(service._cache, "get", new_callable=AsyncMock, return_value=[0.1] * 1024),
        patch.object(service._ollama, "unload_model", new_callable=AsyncMock),
        patch.object(
            service,
            "_fetch_diary_hits",
            new_callable=AsyncMock,
            return_value=[],
        ),
        patch(
            "app.services.chat.ValidatedQAService.search_validated",
            new_callable=AsyncMock,
            return_value=([hit], hit.similarity),
        ),
        patch.object(service._search, "search", new_callable=AsyncMock) as mock_wiki_search,
        patch.object(
            service._ollama,
            "chat_stream_with_continuation",
            side_effect=_empty_stream,
        ) as mock_stream,
        patch.object(service._ollama, "chat_complete", new_callable=AsyncMock) as mock_complete,
    ):
        chunks: list[str] = []
        async for chunk in service.stream_response(conv_id, "user-1", "instalar zabbix agente linux"):
            chunks.append(chunk)

    mock_wiki_search.assert_not_called()
    mock_stream.assert_not_called()
    mock_complete.assert_not_called()

    events = parse_sse("".join(chunks))
    token_text = "".join(data["content"] for name, data in events if name == "token")
    assert token_text == validated_answer

    done_events = [data for name, data in events if name == "done"]
    assert len(done_events) == 1
    assert done_events[0]["model"] == "wikibridge-validated-qa"
    assert done_events[0]["used_validated_qa"][0]["id"] == str(hit.id)
    assert done_events[0]["used_validated_qa"][0]["verification"] == "llm_yes"

    citation_events = [data for name, data in events if name == "citations"]
    assert len(citation_events) == 1
    assert citation_events[0]["citations"][0]["source_type"] == "validated_qa"
    assert citation_events[0]["citations"][0]["chunk_id"] == str(hit.id)
    assert citation_events[0]["cited_chunk_ids"] == [str(hit.id)]


@pytest.mark.asyncio
async def test_direct_mode_sse_status_token_done_order():
    hit = _make_hit(answer="Respuesta validada exacta.")
    service, _session, conv_id = _build_service(Settings(validated_qa_mode="direct"))

    with (
        patch.object(service._cache, "get", new_callable=AsyncMock, return_value=[0.1] * 1024),
        patch.object(service._ollama, "unload_model", new_callable=AsyncMock),
        patch.object(service, "_fetch_diary_hits", new_callable=AsyncMock, return_value=[]),
        patch(
            "app.services.chat.ValidatedQAService.search_validated",
            new_callable=AsyncMock,
            return_value=([hit], hit.similarity),
        ),
    ):
        raw = ""
        async for chunk in service.stream_response(conv_id, "user-1", "zabbix linux"):
            raw += chunk

    names = [name for name, _ in parse_sse(raw)]
    assert names[0] == "status"
    assert names[1] == "user_message"
    assert "token" in names
    assert "citations" in names
    assert names[-1] == "done"
    generating = next(data for name, data in parse_sse(raw) if name == "status" and data.get("phase") == "generating")
    assert generating["message"] == "Respuesta validada por el equipo…"


@pytest.mark.asyncio
async def test_inject_mode_still_uses_chat_generation():
    hit = _make_hit(answer="No debe usarse tal cual en inject.")
    service, _session, conv_id = _build_service(Settings(validated_qa_mode="inject"))

    async def fake_stream(*_args, **_kwargs):
        yield "Respuesta "
        yield "generada."

    with (
        patch.object(service._cache, "get", new_callable=AsyncMock, return_value=[0.1] * 1024),
        patch.object(service._ollama, "unload_model", new_callable=AsyncMock),
        patch.object(service, "_fetch_diary_hits", new_callable=AsyncMock, return_value=[]),
        patch(
            "app.services.chat.ValidatedQAService.search_validated",
            new_callable=AsyncMock,
            return_value=([hit], hit.similarity),
        ),
        patch.object(service._search, "search", new_callable=AsyncMock, return_value=[]),
        patch.object(
            service._ollama,
            "chat_stream_with_continuation",
            side_effect=fake_stream,
        ) as mock_stream,
        patch(
            "app.services.chat.ChatInstructionsService.get_for_prompt",
            new_callable=AsyncMock,
            return_value=("", ""),
        ),
        patch.object(service, "_recent_history", new_callable=AsyncMock, return_value=[]),
        patch.object(service, "_build_ingest_context", new_callable=AsyncMock, return_value=None),
    ):
        raw = ""
        async for chunk in service.stream_response(conv_id, "user-1", "zabbix linux"):
            raw += chunk

    mock_stream.assert_called_once()
    token_text = "".join(data["content"] for name, data in parse_sse(raw) if name == "token")
    assert token_text == "Respuesta generada."
    done = next(data for name, data in parse_sse(raw) if name == "done")
    assert done["model"] == Settings().chat_model
    assert done["used_validated_qa"][0]["id"] == str(hit.id)


@pytest.mark.asyncio
async def test_no_match_direct_mode_uses_chat_generation():
    service, _session, conv_id = _build_service(Settings(validated_qa_mode="direct"))

    async def fake_stream(*_args, **_kwargs):
        yield "Sin Q&A validado."

    with (
        patch.object(service._cache, "get", new_callable=AsyncMock, return_value=[0.1] * 1024),
        patch.object(service._ollama, "unload_model", new_callable=AsyncMock),
        patch.object(service, "_fetch_diary_hits", new_callable=AsyncMock, return_value=[]),
        patch(
            "app.services.chat.ValidatedQAService.search_validated",
            new_callable=AsyncMock,
            return_value=([], 0.0),
        ),
        patch.object(service._search, "search", new_callable=AsyncMock, return_value=[]),
        patch.object(service._ollama, "chat_stream_with_continuation", side_effect=fake_stream) as mock_stream,
        patch(
            "app.services.chat.ChatInstructionsService.get_for_prompt",
            new_callable=AsyncMock,
            return_value=("", ""),
        ),
        patch.object(service, "_recent_history", new_callable=AsyncMock, return_value=[]),
        patch.object(service, "_build_ingest_context", new_callable=AsyncMock, return_value=None),
    ):
        raw = ""
        async for chunk in service.stream_response(conv_id, "user-1", "pregunta sin match"):
            raw += chunk

    mock_stream.assert_called_once()
    done = next(data for name, data in parse_sse(raw) if name == "done")
    assert "used_validated_qa" not in done


def test_pick_primary_validated_hit_selects_highest_similarity(caplog):
    low = _make_hit(answer="A", similarity=0.82, hit_id=uuid.uuid4())
    high = _make_hit(answer="B", similarity=0.93, hit_id=uuid.uuid4())

    with caplog.at_level("INFO", logger="app.services.validated_qa"):
        primary = pick_primary_validated_hit([low, high])

    assert primary.id == high.id
    assert "discarding" in caplog.text
    assert str(low.id) in caplog.text


def test_build_validated_qa_citations_use_qa_not_wiki():
    hit = _make_hit(answer="x" * 300)
    citations = build_validated_qa_citations(hit)
    assert len(citations) == 1
    assert citations[0]["source_type"] == "validated_qa"
    assert citations[0]["chunk_id"] == str(hit.id)
    assert citations[0]["page_title"] == "Respuesta validada por el equipo"


def test_iter_response_tokens_reconstructs_full_text():
    text = "Instalar zabbix-agent2 desde el repositorio oficial."
    assert "".join(iter_response_tokens(text)) == text


@pytest.mark.asyncio
async def test_direct_mode_persists_validated_qa_id_in_cited_chunk_ids():
    hit = _make_hit(answer="Respuesta persistida.")
    service, session, conv_id = _build_service(Settings(validated_qa_mode="direct"))
    added: list[object] = []

    def capture_add(obj):
        added.append(obj)

    session.add = MagicMock(side_effect=capture_add)

    with (
        patch.object(service._cache, "get", new_callable=AsyncMock, return_value=[0.1] * 1024),
        patch.object(service._ollama, "unload_model", new_callable=AsyncMock),
        patch.object(service, "_fetch_diary_hits", new_callable=AsyncMock, return_value=[]),
        patch(
            "app.services.chat.ValidatedQAService.search_validated",
            new_callable=AsyncMock,
            return_value=([hit], hit.similarity),
        ),
    ):
        async for _chunk in service.stream_response(conv_id, "user-1", "zabbix linux"):
            pass

    assistant_messages = [
        obj for obj in added if getattr(obj, "role", None) == MessageRole.ASSISTANT
    ]
    assert len(assistant_messages) == 1
    assert assistant_messages[0].cited_chunk_ids == [hit.id]


@pytest.mark.asyncio
async def test_enrich_citations_rebuilds_validated_qa_citations_on_reload():
    qa_id = uuid.uuid4()
    validated_row = MagicMock()
    validated_row.id = qa_id
    validated_row.question = "¿Cómo instalar Zabbix?"
    validated_row.answer = "Usar repo oficial e instalar zabbix-agent2."

    session = AsyncMock()
    session.execute = AsyncMock(
        return_value=MagicMock(all=MagicMock(return_value=[]))
    )
    session.get = AsyncMock(return_value=validated_row)

    service = ChatService(session, Settings())
    citations = await service.enrich_citations([qa_id])

    assert len(citations) == 1
    assert citations[0]["chunk_id"] == str(qa_id)
    assert citations[0]["source_type"] == "validated_qa"
    assert citations[0]["page_title"] == "Respuesta validada por el equipo"
