"""Tests for document health detectors."""

from datetime import UTC, datetime, timedelta

import pytest

from app.config import Settings
from app.db.models import FindingSeverity, WikiPage
from app.services.document_health.base import DetectorContext
from app.services.document_health.detectors.age import AgeDetector
from app.services.document_health.detectors.orphan import OrphanDetector
from app.services.document_health.detectors.version_citation import VersionCitationDetector


def _page(**kwargs) -> WikiPage:
    page = WikiPage(
        wikijs_page_id=1,
        path=kwargs.get("path", "test/page"),
        title=kwargs.get("title", "Test"),
        content_raw=kwargs.get("content_raw", ""),
        tags=kwargs.get("tags", []),
        wiki_updated_at=kwargs.get(
            "wiki_updated_at", datetime.now(UTC) - timedelta(days=400)
        ),
    )
    return page


def _context(pages: list[WikiPage]) -> DetectorContext:
    settings = Settings()
    paths_set = {p.path for p in pages}
    inbound = {p.path: 0 for p in pages}
    return DetectorContext(
        all_pages=pages,
        paths_by_id={p.wikijs_page_id: p.path for p in pages},
        paths_set=paths_set,
        inbound_links=inbound,
        settings=settings,
        ollama=None,
    )


@pytest.mark.asyncio
async def test_age_detector_flags_old_procedure():
    page = _page(title="Procedimiento backup", path="proc/backup")
    detector = AgeDetector()
    findings = await detector.run(page, _context([page]))
    assert len(findings) == 1
    assert findings[0].severity in (FindingSeverity.WARN, FindingSeverity.CRITICAL)


@pytest.mark.asyncio
async def test_age_detector_skips_recent_page():
    page = _page(wiki_updated_at=datetime.now(UTC) - timedelta(days=30))
    detector = AgeDetector()
    findings = await detector.run(page, _context([page]))
    assert findings == []


@pytest.mark.asyncio
async def test_orphan_detector():
    page = _page(path="hidden/page")
    detector = OrphanDetector()
    findings = await detector.run(page, _context([page]))
    assert len(findings) == 1
    assert findings[0].detector == "orphan"


@pytest.mark.asyncio
async def test_version_citation_detector():
    page = _page(content_raw="Servidor con PostgreSQL 16.2 en producción.")
    detector = VersionCitationDetector()
    findings = await detector.run(page, _context([page]))
    assert any("PostgreSQL" in f.summary for f in findings)
