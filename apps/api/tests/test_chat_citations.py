import uuid

from app.services.chat import ChatService
from app.services.search import ChunkHit


def _hit(index: int) -> ChunkHit:
    chunk_id = uuid.uuid4()
    return ChunkHit(
        chunk_id=chunk_id,
        page_id=uuid.uuid4(),
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


def test_resolve_cited_chunk_ids_falls_back_to_all_hits():
    hits = [_hit(1), _hit(2), _hit(3)]
    service = ChatService.__new__(ChatService)

    cited = service._resolve_cited_chunk_ids("Resumen sin marcadores de cita.", hits)

    assert cited == [hit.chunk_id for hit in hits]
