import pytest

from app.config import parse_incremental_sync_hours


def test_parse_incremental_sync_hours_default_fallback():
    assert parse_incremental_sync_hours("") == [2, 8, 14, 20]
    assert parse_incremental_sync_hours("   ") == [2, 8, 14, 20]


def test_parse_incremental_sync_hours_sorted_unique():
    assert parse_incremental_sync_hours("14,2,8,2,20") == [2, 8, 14, 20]


def test_parse_incremental_sync_hours_single():
    assert parse_incremental_sync_hours("6") == [6]


def test_parse_incremental_sync_hours_invalid():
    with pytest.raises(ValueError, match="Hora de sync inválida"):
        parse_incremental_sync_hours("24")
