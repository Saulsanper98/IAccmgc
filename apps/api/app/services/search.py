from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


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
    ) -> list[ChunkHit]:
        embedding_literal = "[" + ",".join(str(v) for v in query_embedding) + "]"

        semantic_rows = await self._session.execute(
            text(
                """
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
                ORDER BY c.embedding <=> CAST(:embedding AS vector)
                LIMIT :limit
                """
            ),
            {"embedding": embedding_literal, "limit": top_k},
        )
        semantic_hits = list(semantic_rows.mappings())

        lexical_hits: list = []
        if query.strip():
            lexical_rows = await self._session.execute(
                text(
                    """
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
                    ORDER BY rank_score DESC
                    LIMIT :limit
                    """
                ),
                {"query": query, "limit": top_k},
            )
            lexical_hits = list(lexical_rows.mappings())

        semantic_ids = [row["id"] for row in semantic_hits]
        lexical_ids = [row["id"] for row in lexical_hits]
        fused_scores = reciprocal_rank_fusion([semantic_ids, lexical_ids], k=rrf_k)

        if not fused_scores:
            return []

        by_id: dict[uuid.UUID, dict] = {}
        for row in semantic_hits + lexical_hits:
            by_id[row["id"]] = row

        ranked = sorted(fused_scores.items(), key=lambda item: item[1], reverse=True)[:final_k]
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
            for chunk_id, score in ranked
            if chunk_id in by_id
        ]
