from __future__ import annotations

import json
import logging

from app.config import Settings
from app.db.models import Chunk, FindingSeverity, WikiPage
from app.services.document_health.base import DetectorContext, DetectorFinding
from app.services.ollama import OllamaClient

logger = logging.getLogger(__name__)


def _cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


class ContradictionDetector:
    name = "contradiction"

    async def run(self, page: WikiPage, context: DetectorContext) -> list[DetectorFinding]:
        settings: Settings = context.settings  # type: ignore[assignment]
        ollama: OllamaClient | None = context.ollama  # type: ignore[assignment]
        if not ollama:
            return []

        if getattr(context, "_contradiction_done", False):
            return []
        context._contradiction_done = True  # type: ignore[attr-defined]

        session_factory = getattr(context, "session_factory", None)
        if not session_factory:
            return []

        from sqlalchemy import select  # noqa: PLC0415

        findings: list[DetectorFinding] = []
        async with session_factory() as session:
            result = await session.execute(
                select(Chunk, WikiPage)
                .join(WikiPage, WikiPage.id == Chunk.page_id)
                .where(WikiPage.is_deleted.is_(False), Chunk.embedding.isnot(None))
                .limit(400)
            )
            rows = result.all()
            pairs = _find_similar_pairs(rows, settings.contradiction_similarity_threshold)
            pairs = pairs[: settings.contradiction_max_pairs]

            for chunk_a, page_a, chunk_b, page_b, score in pairs:
                if page_a.id == page_b.id:
                    continue
                contradiction = await _llm_check_contradiction(ollama, chunk_a, page_a, chunk_b, page_b)
                if not contradiction:
                    continue
                findings.append(
                    DetectorFinding(
                        detector=self.name,
                        severity=FindingSeverity.WARN,
                        summary=contradiction["summary"],
                        evidence={
                            "similarity": round(score, 3),
                            "page_a": {"id": str(page_a.id), "title": page_a.title, "path": page_a.path},
                            "page_b": {"id": str(page_b.id), "title": page_b.title, "path": page_b.path},
                            "fragment_a": chunk_a.content[:400],
                            "fragment_b": chunk_b.content[:400],
                            "llm_reason": contradiction.get("reason", ""),
                        },
                    )
                )

        return findings


def _find_similar_pairs(rows, threshold: float) -> list[tuple]:
    pairs: list[tuple] = []
    chunks_data = []
    for chunk, page in rows:
        if chunk.embedding is None:
            continue
        vec = list(chunk.embedding)
        chunks_data.append((chunk, page, vec))

    for i in range(len(chunks_data)):
        for j in range(i + 1, len(chunks_data)):
            chunk_a, page_a, vec_a = chunks_data[i]
            chunk_b, page_b, vec_b = chunks_data[j]
            score = _cosine_similarity(vec_a, vec_b)
            if score >= threshold:
                pairs.append((chunk_a, page_a, chunk_b, page_b, score))

    pairs.sort(key=lambda item: item[4], reverse=True)
    return pairs


async def _llm_check_contradiction(ollama, chunk_a, page_a, chunk_b, page_b) -> dict | None:
    system = (
        "Eres un auditor de documentación técnica. Responde SOLO con JSON válido, sin markdown. "
        'Formato: {"contradicts": true|false, "summary": "...", "reason": "..."}'
    )
    prompt = (
        f'Página A "{page_a.title}":\n{chunk_a.content[:600]}\n\n'
        f'Página B "{page_b.title}":\n{chunk_b.content[:600]}\n\n'
        "¿Hay afirmaciones incompatibles entre ambos fragmentos (IPs distintas, versiones, "
        "procedimientos opuestos)? Solo marca contradictorio si es claro."
    )
    try:
        raw = await ollama.generate_text(prompt, system=system)
        start = raw.find("{")
        end = raw.rfind("}") + 1
        if start < 0 or end <= start:
            return None
        data = json.loads(raw[start:end])
        if data.get("contradicts"):
            return data
    except Exception:
        logger.warning("Contradiction LLM check failed", exc_info=True)
    return None
