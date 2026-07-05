import pytest
from unittest.mock import AsyncMock

from app.services.ollama import hash_query
from app.services.query_embedding import embed_query_text


@pytest.mark.asyncio
async def test_chat_embedding_pattern_cache_hit_skips_ollama():
    """Mirrors ChatService.stream_response: Redis first, embed_query_text only on miss."""
    cache = AsyncMock()
    ollama = AsyncMock()
    ollama.embed_text.return_value = [0.1] * 1024

    content = "¿Qué puerto usa LDAP?"
    query_hash = hash_query(content)

    async def cache_get(key: str):
        return cache_get.store.get(key)

    async def cache_set(key: str, value: list[float]):
        cache_get.store[key] = value

    cache_get.store: dict[str, list[float]] = {}
    cache.get = AsyncMock(side_effect=cache_get)
    cache.set = AsyncMock(side_effect=cache_set)

    async def resolve_embedding(text: str) -> list[float]:
        key = hash_query(text)
        cached = await cache.get(key)
        if cached is None:
            cached = await embed_query_text(text, ollama)
            await cache.set(key, cached)
        return cached

    first = await resolve_embedding(content)
    second = await resolve_embedding(content)

    assert first == second
    assert ollama.embed_text.await_count == 1
    assert cache.get.await_count == 2
    assert cache.set.await_count == 1
