from __future__ import annotations

import json
import logging

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_redis_client: aioredis.Redis | None = None


async def get_redis_client(redis_url: str) -> aioredis.Redis:
    global _redis_client
    if _redis_client is None:
        _redis_client = aioredis.from_url(redis_url, decode_responses=True)
    return _redis_client


async def close_redis_client() -> None:
    global _redis_client
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None


class QueryEmbeddingCache:
    def __init__(self, redis_url: str, ttl_seconds: int) -> None:
        self._redis_url = redis_url
        self._ttl_seconds = ttl_seconds

    async def get(self, query_hash: str) -> list[float] | None:
        try:
            client = await get_redis_client(self._redis_url)
            raw = await client.get(f"qemb:{query_hash}")
            if not raw:
                logger.debug("Query embedding cache miss key=%s", query_hash[:16])
                return None
            logger.debug("Query embedding cache hit key=%s", query_hash[:16])
            return json.loads(raw)
        except Exception:
            logger.warning("Query embedding cache read failed", exc_info=True)
            return None

    async def set(self, query_hash: str, embedding: list[float]) -> None:
        try:
            client = await get_redis_client(self._redis_url)
            await client.setex(
                f"qemb:{query_hash}",
                self._ttl_seconds,
                json.dumps(embedding),
            )
        except Exception:
            logger.warning("Query embedding cache write failed", exc_info=True)
