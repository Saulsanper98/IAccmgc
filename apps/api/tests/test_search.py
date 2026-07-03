import uuid

from app.services.search import reciprocal_rank_fusion


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
