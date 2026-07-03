import json

import pytest

from app.services.ollama import OllamaClient


class _FakeAsyncLines:
    def __init__(self, lines: list[str]) -> None:
        self._lines = lines

    def __aiter__(self):
        self._iter = iter(self._lines)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration as exc:
            raise StopAsyncIteration from exc


class _FakeStreamResponse:
    def __init__(self, lines: list[str]) -> None:
        self._lines = lines

    def raise_for_status(self) -> None:
        return None

    def aiter_lines(self):
        return _FakeAsyncLines(self._lines)


class _FakeStreamClient:
    def __init__(self, lines: list[str]) -> None:
        self._lines = lines

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    def stream(self, *args, **kwargs):
        return _FakeStreamContext(self._lines)


class _FakeStreamContext:
    def __init__(self, lines: list[str]) -> None:
        self._lines = lines

    async def __aenter__(self):
        return _FakeStreamResponse(self._lines)

    async def __aexit__(self, *args):
        return None


@pytest.mark.asyncio
async def test_chat_stream_yields_every_token(monkeypatch):
    lines = [
        json.dumps({"message": {"content": "Hola"}, "done": False}),
        json.dumps({"message": {"content": " mundo"}, "done": False}),
        json.dumps({"message": {"content": "!"}, "done": True}),
    ]

    def fake_async_client(*args, **kwargs):
        return _FakeStreamClient(lines)

    monkeypatch.setattr("app.services.ollama.httpx.AsyncClient", fake_async_client)

    from app.config import Settings

    client = OllamaClient(Settings())
    tokens = [token async for token in client.chat_stream([], "system")]

    assert tokens == ["Hola", " mundo", "!"]
