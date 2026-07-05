from unittest.mock import AsyncMock

import pytest

from app.config import Settings
from app.services.chat import ChatService
from app.services.query_cache import QueryEmbeddingCache


@pytest.mark.asyncio
async def test_chat_service_wires_real_query_embedding_cache():
    """Catch missing imports (e.g. QueryEmbeddingCache NameError) at pytest time."""
    session = AsyncMock()
    settings = Settings(redis_url="redis://localhost:6379/0")

    service = ChatService(session, settings)

    assert isinstance(service._cache, QueryEmbeddingCache)
    assert service._cache._redis_url == settings.redis_url
    assert service._cache._ttl_seconds == settings.query_embedding_cache_ttl_seconds
