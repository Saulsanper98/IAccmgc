from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory


@dataclass(frozen=True)
class ChunkHit:
    chunk_id: uuid.UUID
    page_id: uuid.UUID
    page_title: str
    page_path: str
    heading_path: str
    content: str
    ordinal: int
    score: float


def reciprocal_rank_fusion(
    ranked_lists: list[list[uuid.UUID]],
    *,
    k: int = 60,
) -> dict[uuid.UUID, float]:
    scores: dict[uuid.UUID, float] = {}
    for ranked_ids in ranked_lists:
        for rank, chunk_id in enumerate(ranked_ids):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + rank + 1)
    return scores


def select_diverse_chunks(
    ranked: list[tuple[uuid.UUID, float]],
    by_id: dict[uuid.UUID, dict],
    *,
    final_k: int,
    max_per_page: int = 2,
) -> list[tuple[uuid.UUID, float]]:
    """Pick top chunks while limiting how many come from the same wiki page."""
    selected: list[tuple[uuid.UUID, float]] = []
    page_counts: dict[uuid.UUID, int] = {}

    for chunk_id, score in ranked:
        row = by_id.get(chunk_id)
        if row is None:
            continue
        page_id = row["page_id"]
        if page_counts.get(page_id, 0) >= max_per_page:
            continue
        selected.append((chunk_id, score))
        page_counts[page_id] = page_counts.get(page_id, 0) + 1
        if len(selected) >= final_k:
            break

    return selected


class HybridSearchService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def search(
        self,
        query: str,
        query_embedding: list[float],
        *,
        top_k: int = 20,
        final_k: int = 6,
        rrf_k: int = 60,
        max_per_page: int = 2,
        path_prefix: str | None = None,
    ) -> list[ChunkHit]:
        embedding_literal = "[" + ",".join(str(v) for v in query_embedding) + "]"

        semantic_task = asyncio.create_task(
            self._semantic_search(embedding_literal, top_k, path_prefix=path_prefix)
        )
        lexical_task = (
            asyncio.create_task(self._lexical_search(query, top_k, path_prefix=path_prefix))
            if query.strip()
            else None
        )

        semantic_hits = await semantic_task
        lexical_hits = await lexical_task if lexical_task else []

        semantic_ids = [row["id"] for row in semantic_hits]
        lexical_ids = [row["id"] for row in lexical_hits]
        fused_scores = reciprocal_rank_fusion([semantic_ids, lexical_ids], k=rrf_k)

        if not fused_scores:
            return []

        by_id: dict[uuid.UUID, dict] = {}
        for row in semantic_hits + lexical_hits:
            by_id[row["id"]] = row

        scan_limit = max(final_k * 4, final_k)
        ranked = sorted(fused_scores.items(), key=lambda item: item[1], reverse=True)[:scan_limit]
        diverse = select_diverse_chunks(
            ranked,
            by_id,
            final_k=final_k,
            max_per_page=max_per_page,
        )

        return [
            ChunkHit(
                chunk_id=chunk_id,
                page_id=by_id[chunk_id]["page_id"],
                page_title=by_id[chunk_id]["title"],
                page_path=by_id[chunk_id]["path"],
                heading_path=by_id[chunk_id]["heading_path"],
                content=by_id[chunk_id]["content"],
                ordinal=by_id[chunk_id]["ordinal"],
                score=score,
            )
            for chunk_id, score in diverse
            if chunk_id in by_id
        ]

    async def _semantic_search(
        self, embedding_literal: str, top_k: int, *, path_prefix: str | None = None
    ) -> list:
        path_clause = "AND p.path ILIKE :path_prefix || '%'" if path_prefix else ""
        async with async_session_factory() as session:
            rows = await session.execute(
                text(
                    f"""
                    SELECT
                        c.id,
                        c.page_id,
                        p.title,
                        p.path,
                        c.heading_path,
                        c.content,
                        c.ordinal
                    FROM chunks c
                    JOIN wiki_pages p ON p.id = c.page_id
                    WHERE p.is_deleted = false
                      AND c.embedding IS NOT NULL
                      {path_clause}
                    ORDER BY c.embedding <=> CAST(:embedding AS vector)
                    LIMIT :limit
                    """
                ),
                {
                    "embedding": embedding_literal,
                    "limit": top_k,
                    **({"path_prefix": path_prefix} if path_prefix else {}),
                },
            )
            return list(rows.mappings())

    async def _lexical_search(
        self, query: str, top_k: int, *, path_prefix: str | None = None
    ) -> list:
        path_clause = "AND p.path ILIKE :path_prefix || '%'" if path_prefix else ""
        async with async_session_factory() as session:
            rows = await session.execute(
                text(
                    f"""
                    SELECT
                        c.id,
                        c.page_id,
                        p.title,
                        p.path,
                        c.heading_path,
                        c.content,
                        c.ordinal,
                        ts_rank_cd(
                            c.tsv,
                            websearch_to_tsquery('spanish', :query)
                        ) AS rank_score
                    FROM chunks c
                    JOIN wiki_pages p ON p.id = c.page_id
                    WHERE p.is_deleted = false
                      AND c.tsv @@ websearch_to_tsquery('spanish', :query)
                      {path_clause}
                    ORDER BY rank_score DESC
                    LIMIT :limit
                    """
                ),
                {
                    "query": query,
                    "limit": top_k,
                    **({"path_prefix": path_prefix} if path_prefix else {}),
                },
            )
            hits = list(rows.mappings())
            if hits:
                return hits

            rows = await session.execute(
                text(
                    f"""
                    SELECT
                        c.id,
                        c.page_id,
                        p.title,
                        p.path,
                        c.heading_path,
                        c.content,
                        c.ordinal,
                        ts_rank_cd(c.tsv, plainto_tsquery('spanish', :query)) AS rank_score
                    FROM chunks c
                    JOIN wiki_pages p ON p.id = c.page_id
                    WHERE p.is_deleted = false
                      AND c.tsv @@ plainto_tsquery('spanish', :query)
                      {path_clause}
                    ORDER BY rank_score DESC
                    LIMIT :limit
                    """
                ),
                {
                    "query": query,
                    "limit": top_k,
                    **({"path_prefix": path_prefix} if path_prefix else {}),
                },
            )
            return list(rows.mappings())
