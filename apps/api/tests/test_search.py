import uuid

from app.services.search import reciprocal_rank_fusion, select_diverse_chunks


def test_rrf_fuses_two_rankings():
    id_a = uuid.uuid4()
    id_b = uuid.uuid4()
    id_c = uuid.uuid4()

    semantic = [id_a, id_b, id_c]
    lexical = [id_b, id_a, id_c]

    scores = reciprocal_rank_fusion([semantic, lexical], k=60)

    assert scores[id_b] > scores[id_c]
    assert scores[id_a] > scores[id_c]
    assert id_a in scores and id_b in scores and id_c in scores


def test_rrf_empty_lists():
    assert reciprocal_rank_fusion([]) == {}


def test_rrf_single_list():
    id_a = uuid.uuid4()
    id_b = uuid.uuid4()
    scores = reciprocal_rank_fusion([[id_a, id_b]], k=60)
    assert scores[id_a] > scores[id_b]


def test_select_diverse_chunks_respects_page_limit():
    page_a = uuid.uuid4()
    page_b = uuid.uuid4()
    id_a1, id_a2, id_b1 = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    by_id = {
        id_a1: {"page_id": page_a},
        id_a2: {"page_id": page_a},
        id_b1: {"page_id": page_b},
    }
    ranked = [(id_a1, 1.0), (id_a2, 0.9), (id_b1, 0.8)]

    selected = select_diverse_chunks(ranked, by_id, final_k=3, max_per_page=1)

    assert [chunk_id for chunk_id, _ in selected] == [id_a1, id_b1]
