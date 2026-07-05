"""Shared query embedding path for RAG retrieval and validated Q&A."""

from __future__ import annotations

from app.services.ollama import OllamaClient


def prepare_query_text(text: str) -> str:
    return text.strip()


async def embed_query_text(text: str, ollama: OllamaClient) -> list[float]:
    """Embed text using the same preprocessing as chat query retrieval.

    Note: Redis caching is handled by the caller (ChatService) on cache miss only.
    """
    return await ollama.embed_text(prepare_query_text(text))
