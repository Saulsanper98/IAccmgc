from __future__ import annotations

import logging
import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import async_session_factory

from app.config import Settings
from app.db.models import (
    Chunk,
    Feedback,
    FindingSeverity,
    FindingStatus,
    HealthScanJob,
    HealthScanStatus,
    Message,
    StalenessFinding,
    WikiPage,
)
from app.services.document_health.base import DetectorContext, DetectorFinding
from app.services.document_health.registry import ALL_DETECTORS, PHASE_A_DETECTORS, PHASE_B_DETECTORS
from app.services.ollama import OllamaClient

logger = logging.getLogger(__name__)

WIKI_LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")


class HealthService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._ollama = OllamaClient(settings)

    async def create_scan_job(self, trigger: str = "manual") -> HealthScanJob:
        running = await self._session.scalar(
            select(func.count())
            .select_from(HealthScanJob)
            .where(HealthScanJob.status.in_([HealthScanStatus.PENDING, HealthScanStatus.RUNNING]))
        )
        if running:
            raise RuntimeError("Ya hay un análisis de salud en curso")

        job = HealthScanJob(status=HealthScanStatus.PENDING, stats={}, trigger=trigger)
        self._session.add(job)
        await self._session.commit()
        await self._session.refresh(job)
        return job

    async def run_scan(self, job_id: uuid.UUID) -> dict:
        job = await self._session.get(HealthScanJob, job_id)
        if not job:
            raise ValueError(f"Health scan job {job_id} not found")

        job.status = HealthScanStatus.RUNNING
        job.started_at = datetime.now(UTC)
        job.error = None
        await self._session.commit()

        stats = {
            "pages_scanned": 0,
            "findings_created": 0,
            "findings_updated": 0,
            "findings_auto_resolved": 0,
            "detectors_run": 0,
            "errors": 0,
        }

        try:
            pages = (
                await self._session.execute(
                    select(WikiPage).where(WikiPage.is_deleted.is_(False)).order_by(WikiPage.title)
                )
            ).scalars().all()

            context = _build_context(pages, self._settings, self._ollama)
            context.session_factory = async_session_factory  # type: ignore[attr-defined]

            active_keys: set[tuple[uuid.UUID, str, str]] = set()
            per_page_detectors = [d for d in ALL_DETECTORS if d.name not in ("contradiction", "usage_signal")]
            total_pages = len(pages)
            stats["total_pages"] = total_pages
            stats["phase"] = "per_page"

            for page in pages:
                stats["pages_scanned"] += 1
                for detector in per_page_detectors:
                    stats["detectors_run"] += 1
                    try:
                        findings = await detector.run(page, context)
                        for finding in findings:
                            key = (page.id, finding.detector, finding.evidence_hash())
                            active_keys.add(key)
                            await self._upsert_finding(page.id, finding, stats)
                    except Exception:
                        stats["errors"] += 1
                        logger.exception("Detector %s failed on page %s", detector.name, page.id)
                await self._persist_progress(job, stats)

            stats["phase"] = "global_detectors"
            await self._persist_progress(job, stats)

            for detector in [d for d in ALL_DETECTORS if d.name in ("contradiction", "usage_signal")]:
                stats["current_detector"] = detector.name
                await self._persist_progress(job, stats)
                stats["detectors_run"] += 1
                try:
                    global_findings = await _run_global_detector(detector, pages[0] if pages else None, context)
                    for page_id, finding in global_findings:
                        active_keys.add((page_id, finding.detector, finding.evidence_hash()))
                        await self._upsert_finding(page_id, finding, stats)
                    await self._persist_progress(job, stats)
                except Exception:
                    stats["errors"] += 1
                    logger.exception("Global detector %s failed", detector.name)
                    await self._persist_progress(job, stats)

            stats["phase"] = "finalizing"
            await self._persist_progress(job, stats)

            await self._auto_resolve_stale(active_keys, stats)

            job.status = HealthScanStatus.COMPLETED
            stats["phase"] = "done"
            job.stats = stats
            job.finished_at = datetime.now(UTC)
            await self._session.commit()
            return stats
        except Exception as exc:
            logger.exception("Health scan %s failed", job_id)
            job.status = HealthScanStatus.FAILED
            job.error = str(exc)
            job.stats = stats
            job.finished_at = datetime.now(UTC)
            await self._session.commit()
            raise

    async def _upsert_finding(self, page_id: uuid.UUID, finding: DetectorFinding, stats: dict) -> None:
        evidence_hash = finding.evidence_hash()
        existing = await self._session.scalar(
            select(StalenessFinding).where(
                StalenessFinding.page_id == page_id,
                StalenessFinding.detector == finding.detector,
                StalenessFinding.evidence_hash == evidence_hash,
            )
        )
        if existing:
            if existing.status in (FindingStatus.RESOLVED, FindingStatus.FALSE_POSITIVE):
                return
            existing.summary = finding.summary
            existing.severity = finding.severity
            existing.evidence = finding.evidence
            existing.updated_at = datetime.now(UTC)
            stats["findings_updated"] += 1
            return

        self._session.add(
            StalenessFinding(
                page_id=page_id,
                detector=finding.detector,
                severity=finding.severity,
                summary=finding.summary,
                evidence=finding.evidence,
                evidence_hash=evidence_hash,
                status=FindingStatus.OPEN,
            )
        )
        stats["findings_created"] += 1

    async def _persist_progress(self, job: HealthScanJob, stats: dict) -> None:
        job.stats = dict(stats)
        await self._session.commit()

    async def _auto_resolve_stale(self, active_keys: set[tuple[uuid.UUID, str, str]], stats: dict) -> None:
        open_findings = (
            await self._session.execute(
                select(StalenessFinding).where(StalenessFinding.status == FindingStatus.OPEN)
            )
        ).scalars().all()
        for finding in open_findings:
            key = (finding.page_id, finding.detector, finding.evidence_hash)
            if key not in active_keys:
                finding.status = FindingStatus.RESOLVED
                finding.resolved_by = "system:auto"
                finding.updated_at = datetime.now(UTC)
                stats["findings_auto_resolved"] += 1
        await self._session.commit()

    async def get_summary(self) -> dict:
        total_open = await self._session.scalar(
            select(func.count())
            .select_from(StalenessFinding)
            .where(StalenessFinding.status == FindingStatus.OPEN)
        )
        by_severity = await self._session.execute(
            select(StalenessFinding.severity, func.count())
            .where(StalenessFinding.status == FindingStatus.OPEN)
            .group_by(StalenessFinding.severity)
        )
        by_detector = await self._session.execute(
            select(StalenessFinding.detector, func.count())
            .where(StalenessFinding.status == FindingStatus.OPEN)
            .group_by(StalenessFinding.detector)
        )
        pages_count = await self._session.scalar(
            select(func.count()).select_from(WikiPage).where(WikiPage.is_deleted.is_(False))
        )
        open_count = total_open or 0
        pages = pages_count or 1
        score = max(0, min(100, int(100 - (open_count / pages) * 25)))

        recent_jobs = (
            await self._session.execute(
                select(HealthScanJob).order_by(HealthScanJob.started_at.desc().nullslast()).limit(5)
            )
        ).scalars().all()

        return {
            "health_score": score,
            "open_findings": open_count,
            "scan_in_progress": any(
                j.status in (HealthScanStatus.PENDING, HealthScanStatus.RUNNING) for j in recent_jobs
            ),
            "by_severity": {row[0].value: row[1] for row in by_severity.all()},
            "by_detector": {row[0]: row[1] for row in by_detector.all()},
            "recent_scans": [
                {
                    "id": str(j.id),
                    "status": j.status.value,
                    "trigger": j.trigger,
                    "stats": j.stats,
                    "started_at": j.started_at.isoformat() if j.started_at else None,
                    "finished_at": j.finished_at.isoformat() if j.finished_at else None,
                    "error": j.error,
                }
                for j in recent_jobs
            ],
        }

    async def list_findings(
        self,
        *,
        status: str | None = None,
        detector: str | None = None,
        severity: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        query = (
            select(StalenessFinding, WikiPage)
            .join(WikiPage, WikiPage.id == StalenessFinding.page_id)
            .order_by(
                StalenessFinding.severity.desc(),
                StalenessFinding.created_at.desc(),
            )
        )
        if status:
            query = query.where(StalenessFinding.status == FindingStatus(status))
        else:
            query = query.where(StalenessFinding.status == FindingStatus.OPEN)
        if detector:
            query = query.where(StalenessFinding.detector == detector)
        if severity:
            query = query.where(StalenessFinding.severity == severity)

        count_result = await self._session.scalar(
            select(func.count()).select_from(query.subquery())
        )
        result = await self._session.execute(query.offset(offset).limit(limit))
        items = []
        for finding, page in result.all():
            items.append(_serialize_finding(finding, page, self._settings))

        return {"total": count_result or 0, "items": items}

    async def update_finding_status(
        self,
        finding_id: uuid.UUID,
        status: FindingStatus,
        user_id: str,
    ) -> dict:
        finding = await self._session.get(StalenessFinding, finding_id)
        if not finding:
            raise ValueError("Finding no encontrado")
        page = await self._session.get(WikiPage, finding.page_id)
        finding.status = status
        finding.resolved_by = user_id if status != FindingStatus.OPEN else None
        finding.updated_at = datetime.now(UTC)
        await self._session.commit()
        return _serialize_finding(finding, page, self._settings)


def _serialize_finding(finding: StalenessFinding, page: WikiPage | None, settings: Settings) -> dict:
    return {
        "id": str(finding.id),
        "page_id": str(finding.page_id),
        "detector": finding.detector,
        "severity": finding.severity.value,
        "summary": finding.summary,
        "evidence": finding.evidence,
        "status": finding.status.value,
        "created_at": finding.created_at.isoformat() if finding.created_at else None,
        "updated_at": finding.updated_at.isoformat() if finding.updated_at else None,
        "page": {
            "title": page.title if page else "",
            "path": page.path if page else "",
            "tags": page.tags if page else [],
            "wiki_url": f"{settings.wikijs_url.rstrip('/')}/{page.path}" if page else "",
        },
    }


def _build_context(pages: list[WikiPage], settings: Settings, ollama: OllamaClient) -> DetectorContext:
    paths_set = {p.path for p in pages}
    paths_by_id = {p.wikijs_page_id: p.path for p in pages}
    inbound: dict[str, int] = {p.path: 0 for p in pages}

    for page in pages:
        for match in WIKI_LINK_RE.finditer(page.content_raw):
            target = match.group(2).strip()
            if target.startswith("http"):
                continue
            normalized = target.strip().lstrip("/")
            if normalized.startswith("es/"):
                normalized = normalized[3:]
            if normalized in inbound:
                inbound[normalized] += 1

    return DetectorContext(
        all_pages=pages,
        paths_by_id=paths_by_id,
        paths_set=paths_set,
        inbound_links=inbound,
        settings=settings,
        ollama=ollama,
    )


async def _run_global_detector(
    detector,
    dummy_page: WikiPage | None,
    context: DetectorContext,
) -> list[tuple[uuid.UUID, DetectorFinding]]:
    if detector.name == "usage_signal":
        return await _usage_signal_findings(context)
    if detector.name == "contradiction" and dummy_page:
        findings = await detector.run(dummy_page, context)
        results: list[tuple[uuid.UUID, DetectorFinding]] = []
        for f in findings:
            page_id = uuid.UUID(f.evidence["page_a"]["id"])
            results.append((page_id, f))
        return results
    return []


async def _usage_signal_findings(context: DetectorContext) -> list[tuple[uuid.UUID, DetectorFinding]]:
    session_factory = getattr(context, "session_factory", None)
    if not session_factory:
        return []

    page_counts: dict[uuid.UUID, dict] = {}
    async with session_factory() as session:
        rows = await session.execute(
            select(Message.cited_chunk_ids)
            .join(Feedback, Feedback.message_id == Message.id)
            .where(Feedback.rating == -1)
        )
        chunk_ids: list[uuid.UUID] = []
        for cited in rows.scalars():
            if cited:
                chunk_ids.extend(cited)
        if not chunk_ids:
            return []

        chunk_pages = await session.execute(
            select(Chunk.id, Chunk.page_id, WikiPage.title, WikiPage.path)
            .join(WikiPage, WikiPage.id == Chunk.page_id)
            .where(Chunk.id.in_(chunk_ids))
        )
        chunk_to_page = {row[0]: (row[1], row[2], row[3]) for row in chunk_pages.all()}

        feedback_counts = await session.execute(
            select(Message.cited_chunk_ids, func.count())
            .join(Feedback, Feedback.message_id == Message.id)
            .where(Feedback.rating == -1)
            .group_by(Message.id, Message.cited_chunk_ids)
        )
        for cited, count in feedback_counts.all():
            if not cited:
                continue
            for chunk_id in cited:
                if chunk_id not in chunk_to_page:
                    continue
                page_id, title, path = chunk_to_page[chunk_id]
                entry = page_counts.setdefault(
                    page_id, {"title": title, "path": path, "count": 0}
                )
                entry["count"] += int(count)

    results: list[tuple[uuid.UUID, DetectorFinding]] = []
    for page_id, data in page_counts.items():
        if data["count"] < 2:
            continue
        results.append(
            (
                page_id,
                DetectorFinding(
                    detector="usage_signal",
                    severity=FindingSeverity.WARN,
                    summary=(
                        f"Señal de uso negativo: {data['count']} valoraciones 👎 "
                        "en respuestas que citan esta página"
                    ),
                    evidence={
                        "negative_feedback_count": data["count"],
                        "path": data["path"],
                    },
                ),
            )
        )
    return results
