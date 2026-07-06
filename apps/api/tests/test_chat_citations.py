import uuid

from app.config import Settings
from app.services.chat import ChatService
from app.services.search import ChunkHit, select_diverse_chunks


def _hit(index: int, page_id: uuid.UUID | None = None) -> ChunkHit:
    chunk_id = uuid.uuid4()
    return ChunkHit(
        chunk_id=chunk_id,
        page_id=page_id or uuid.uuid4(),
        page_title=f"Página {index}",
        page_path=f"path/{index}",
        heading_path="Sección",
        content=f"Contenido {index}",
        ordinal=index,
        score=1.0,
    )


def test_resolve_cited_chunk_ids_uses_explicit_markers():
    hits = [_hit(1), _hit(2)]
    service = ChatService.__new__(ChatService)

    cited = service._resolve_cited_chunk_ids("Según la doc [2] y también [1].", hits)

    assert cited == [hits[0].chunk_id, hits[1].chunk_id]


def test_resolve_cited_chunk_ids_falls_back_to_top_hits():
    hits = [_hit(1), _hit(2), _hit(3)]
    service = ChatService.__new__(ChatService)
    service._settings = Settings(rag_citation_fallback_max=2)

    cited = service._resolve_cited_chunk_ids("Resumen sin marcadores de cita.", hits)

    assert cited == [hits[0].chunk_id, hits[1].chunk_id]


def test_select_diverse_chunks_limits_per_page():
    page_a = uuid.uuid4()
    page_b = uuid.uuid4()
    hits = [
        _hit(1, page_a),
        _hit(2, page_a),
        _hit(3, page_b),
        _hit(4, page_b),
    ]
    by_id = {hit.chunk_id: {
        "page_id": hit.page_id,
        "title": hit.page_title,
        "path": hit.page_path,
        "heading_path": hit.heading_path,
        "content": hit.content,
        "ordinal": hit.ordinal,
    } for hit in hits}
    ranked = [(hit.chunk_id, hit.score) for hit in hits]

    selected = select_diverse_chunks(ranked, by_id, final_k=3, max_per_page=1)

    assert len(selected) == 2
    page_ids = {by_id[chunk_id]["page_id"] for chunk_id, _ in selected}
    assert page_ids == {page_a, page_b}
