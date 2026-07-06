from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

_shared_client: httpx.AsyncClient | None = None
_client_lock = asyncio.Lock()


async def get_http_client() -> httpx.AsyncClient:
    global _shared_client
    if _shared_client is not None and not _shared_client.is_closed:
        return _shared_client
    async with _client_lock:
        if _shared_client is None or _shared_client.is_closed:
            _shared_client = httpx.AsyncClient(
                timeout=httpx.Timeout(120.0, connect=10.0),
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        return _shared_client


async def close_http_client() -> None:
    global _shared_client
    async with _client_lock:
        if _shared_client is not None and not _shared_client.is_closed:
            await _shared_client.aclose()
        _shared_client = None


def resolve_num_thread(configured: int) -> int:
    if configured > 0:
        return configured
    cpu_count = os.cpu_count() or 4
    return max(4, min(cpu_count, 8))


class OllamaClient:
    def __init__(self, settings: Settings) -> None:
        self._base_url = settings.ollama_base_url.rstrip("/")
        self._embedding_model = settings.embedding_model
        self._chat_model = settings.chat_model
        self._keep_alive = settings.ollama_keep_alive
        self._embedding_keep_alive = settings.ollama_embedding_keep_alive
        self._unload_embedding_before_chat = settings.ollama_unload_embedding_before_chat
        self._default_num_predict = settings.ollama_num_predict
        self._embed_batch_size = max(1, settings.ollama_embed_batch_size)
        self._base_options = {
            "num_ctx": settings.ollama_num_ctx,
            "num_thread": resolve_num_thread(settings.ollama_num_thread),
        }
        self._max_continue_rounds = settings.ollama_max_continue_rounds
        self._semaphore = asyncio.Semaphore(settings.ollama_max_concurrency)

    def _chat_options(self, num_predict: int | None = None, *, temperature: float | None = None) -> dict:
        options = {
            **self._base_options,
            "num_predict": num_predict if num_predict is not None else self._default_num_predict,
        }
        if temperature is not None:
            options["temperature"] = temperature
        return options

    async def embed_text(self, text: str) -> list[float]:
        async with self._semaphore:
            client = await get_http_client()
            response = await client.post(
                f"{self._base_url}/api/embeddings",
                json={
                    "model": self._embedding_model,
                    "prompt": text,
                    "keep_alive": self._embedding_keep_alive,
                },
            )
            response.raise_for_status()
            data = response.json()
            embedding = data.get("embedding")
            if not embedding:
                raise RuntimeError("Ollama returned empty embedding")
            return embedding

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        batch_size = self._embed_batch_size
        results: list[list[float]] = []
        for offset in range(0, len(texts), batch_size):
            batch = texts[offset : offset + batch_size]
            batch_results = await asyncio.gather(*(self.embed_text(text) for text in batch))
            results.extend(batch_results)
        return results

    async def unload_model(self, model: str) -> None:
        """Free RAM by unloading a model from Ollama."""
        if not self._unload_embedding_before_chat:
            return
        try:
            client = await get_http_client()
            await client.post(
                f"{self._base_url}/api/generate",
                json={"model": model, "prompt": "", "keep_alive": 0},
            )
        except Exception:
            logger.warning("Failed to unload Ollama model %s", model, exc_info=True)

    async def chat_stream(self, messages: list[dict[str, str]], system: str):
        """Yield token strings from Ollama /api/chat stream."""
        async for token, _done_reason in self._chat_stream_round(messages, system):
            if token:
                yield token

    async def chat_stream_with_continuation(
        self,
        messages: list[dict[str, str]],
        system: str,
        *,
        num_predict: int | None = None,
    ):
        """Stream a reply, auto-continuing when Ollama stops due to length."""
        current_messages = list(messages)
        accumulated = ""

        for round_index in range(self._max_continue_rounds):
            done_reason: str | None = None
            round_text = ""

            async for token, reason in self._chat_stream_round(
                current_messages, system, num_predict=num_predict
            ):
                if token:
                    round_text += token
                    accumulated += token
                    yield token
                if reason:
                    done_reason = reason

            if done_reason != "length":
                return

            logger.info(
                "Ollama hit num_predict at round %d (%d chars), continuing",
                round_index + 1,
                len(accumulated),
            )
            current_messages = [
                *current_messages,
                {"role": "assistant", "content": accumulated},
                {
                    "role": "user",
                    "content": (
                        "Continúa la respuesta exactamente donde la dejaste, "
                        "sin repetir contenido previo. Cierra con una conclusión breve."
                    ),
                },
            ]

    async def _chat_stream_round(
        self,
        messages: list[dict[str, str]],
        system: str,
        *,
        num_predict: int | None = None,
    ):
        """Yield (token, done_reason) pairs from one Ollama stream."""
        options = self._chat_options(num_predict)
        async with self._semaphore:
            client = await get_http_client()
            async with client.stream(
                "POST",
                f"{self._base_url}/api/chat",
                json={
                    "model": self._chat_model,
                    "messages": messages,
                    "system": system,
                    "stream": True,
                    "keep_alive": self._keep_alive,
                    "options": options,
                },
            ) as response:
                response.raise_for_status()
                done_reason: str | None = None
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    token = payload.get("message", {}).get("content", "")
                    if token:
                        yield token, None
                    if payload.get("done"):
                        done_reason = payload.get("done_reason")
                        break
                yield "", done_reason

    async def generate_text(self, prompt: str, system: str = "") -> str:
        """Single-shot chat completion (non-streaming)."""
        return await self.chat_complete([{"role": "user", "content": prompt}], system)

    async def chat_complete(
        self,
        messages: list[dict[str, str]],
        system: str = "",
        *,
        model: str | None = None,
        num_predict: int | None = None,
        timeout: float | None = None,
        response_format: str | None = None,
        temperature: float | None = None,
    ) -> str:
        """Single-shot multi-turn chat completion (non-streaming)."""
        options = self._chat_options(num_predict, temperature=temperature)
        payload: dict = {
            "model": model or self._chat_model,
            "messages": messages,
            "system": system,
            "stream": False,
            "keep_alive": self._keep_alive,
            "options": options,
        }
        if response_format is not None:
            payload["format"] = response_format
        async with self._semaphore:
            client = await get_http_client()
            response = await client.post(
                f"{self._base_url}/api/chat",
                json=payload,
                timeout=timeout or 180.0,
            )
            response.raise_for_status()
            return response.json().get("message", {}).get("content", "").strip()


def hash_query(text: str) -> str:
    normalized = " ".join(text.lower().split())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
