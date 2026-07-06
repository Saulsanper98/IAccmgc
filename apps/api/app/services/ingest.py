from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.db.models import Chunk, IngestJob, IngestJobStatus, IngestJobType, WikiPage
from app.services.chunking import build_chunk_embed_input, chunk_markdown
from app.services.ollama import OllamaClient
from app.services.wikijs import WikiJsClient, WikiPageDetail, WikiPageListItem

logger = logging.getLogger(__name__)


class IngestService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._wiki = WikiJsClient(settings)
        self._ollama = OllamaClient(settings)

    async def run_job(self, job_id: uuid.UUID) -> dict:
        job = await self._session.get(IngestJob, job_id)
        if not job:
            raise ValueError(f"Ingest job {job_id} not found")

        job.status = IngestJobStatus.RUNNING
        job.started_at = datetime.now(UTC)
        job.error = None
        await self._session.commit()

        stats = {
            "pages_seen": 0,
            "pages_upserted": 0,
            "pages_skipped": 0,
            "pages_deleted": 0,
            "chunks_created": 0,
            "errors": 0,
        }

        try:
            listed = await self._wiki.list_pages()
            stats["pages_seen"] = len(listed)
            job.stats = dict(stats)
            await self._session.commit()
            active_ids = {item.id for item in listed}

            existing_pages = await self._session.execute(select(WikiPage))
            pages_by_wikijs_id = {p.wikijs_page_id: p for p in existing_pages.scalars()}

            for item in listed:
                try:
                    changed = await self._sync_page_item(item, pages_by_wikijs_id, job.type, stats)
                    if changed:
                        stats["pages_upserted"] += 1
                    else:
                        stats["pages_skipped"] += 1
                    await self._persist_job_progress(job, stats)
                except Exception as exc:
                    await self._session.rollback()
                    job = await self._session.get(IngestJob, job_id)
                    if not job:
                        raise
                    stats["errors"] += 1
                    logger.exception("Failed syncing page %s: %s", item.id, exc)
                    await self._persist_job_progress(job, stats)

            for wikijs_id, page in pages_by_wikijs_id.items():
                if wikijs_id not in active_ids and not page.is_deleted:
                    page.is_deleted = True
                    await self._session.execute(delete(Chunk).where(Chunk.page_id == page.id))
                    stats["pages_deleted"] += 1

            await self._session.commit()

            job.status = IngestJobStatus.COMPLETED
            job.stats = stats
            job.finished_at = datetime.now(UTC)
            await self._session.commit()
            return stats
        except Exception as exc:
            logger.exception("Ingest job %s failed", job_id)
            job.status = IngestJobStatus.FAILED
            job.error = str(exc)
            job.stats = stats
            job.finished_at = datetime.now(UTC)
            await self._session.commit()
            raise

    async def _sync_page_item(
        self,
        item: WikiPageListItem,
        pages_by_wikijs_id: dict[int, WikiPage],
        job_type: IngestJobType,
        stats: dict,
    ) -> bool:
        existing = pages_by_wikijs_id.get(item.id)

        if job_type == IngestJobType.INCREMENTAL and existing and not existing.is_deleted:
            if (
                existing.wiki_updated_at == item.updated_at
                and existing.path == item.path
                and existing.title == item.title
            ):
                return False

        detail = await self._wiki.get_page(item.id)
        if not detail:
            if existing and not existing.is_deleted:
                existing.is_deleted = True
                await self._session.execute(delete(Chunk).where(Chunk.page_id == existing.id))
                stats["pages_deleted"] += 1
            return bool(existing)

        if (
            job_type == IngestJobType.INCREMENTAL
            and existing
            and not existing.is_deleted
            and existing.content_hash == detail.hash
            and existing.wiki_updated_at == detail.updated_at
        ):
            return False

        page = await self._upsert_page(detail, existing, stats)
        pages_by_wikijs_id[detail.id] = page
        return True

    async def _persist_job_progress(self, job: IngestJob, stats: dict) -> None:
        job.stats = dict(stats)
        await self._session.commit()

    async def _upsert_page(
        self,
        detail: WikiPageDetail,
        existing: WikiPage | None,
        stats: dict,
    ) -> WikiPage:
        now = datetime.now(UTC)
        page = existing or WikiPage(wikijs_page_id=detail.id)
        page.path = detail.path
        page.title = detail.title
        page.locale = detail.locale
        page.tags = detail.tags
        page.content_raw = detail.content
        page.content_hash = detail.hash
        page.wiki_updated_at = detail.updated_at
        page.last_synced_at = now
        page.is_deleted = False

        if not existing:
            self._session.add(page)
            await self._session.flush()

        await self._session.execute(delete(Chunk).where(Chunk.page_id == page.id))

        drafts = chunk_markdown(
            detail.content,
            min_tokens=self._settings.chunk_min_tokens,
            max_tokens=self._settings.chunk_max_tokens,
            overlap_tokens=self._settings.chunk_overlap_tokens,
        )

        embed_inputs = [
            build_chunk_embed_input(
                page_title=detail.title,
                page_path=detail.path,
                tags=detail.tags,
                heading_path=draft.heading_path,
                content=draft.content,
            )
            for draft in drafts
        ]
        embeddings = await self._ollama.embed_texts(embed_inputs)

        for draft, embedding in zip(drafts, embeddings, strict=True):
            chunk = Chunk(
                page_id=page.id,
                ordinal=draft.ordinal,
                heading_path=draft.heading_path,
                content=draft.content,
                token_count=draft.token_count,
                embedding=embedding,
                embedding_model=self._settings.embedding_model,
            )
            self._session.add(chunk)
            stats["chunks_created"] += 1

        return page

    async def get_status(self) -> dict:
        pages_count = await self._session.scalar(
            select(func.count()).select_from(WikiPage).where(WikiPage.is_deleted.is_(False))
        )
        chunks_count = await self._session.scalar(
            select(func.count())
            .select_from(Chunk)
            .join(WikiPage, WikiPage.id == Chunk.page_id)
            .where(WikiPage.is_deleted.is_(False))
        )
        deleted_count = await self._session.scalar(
            select(func.count()).select_from(WikiPage).where(WikiPage.is_deleted.is_(True))
        )

        jobs_result = await self._session.execute(
            select(IngestJob).order_by(IngestJob.started_at.desc().nullslast()).limit(10)
        )
        jobs = jobs_result.scalars().all()

        return {
            "pages": pages_count or 0,
            "chunks": chunks_count or 0,
            "deleted_pages": deleted_count or 0,
            "recent_jobs": [
                {
                    "id": str(job.id),
                    "type": job.type.value,
                    "status": job.status.value,
                    "stats": job.stats,
                    "started_at": job.started_at.isoformat() if job.started_at else None,
                    "finished_at": job.finished_at.isoformat() if job.finished_at else None,
                    "error": job.error,
                }
                for job in jobs
            ],
        }

    async def create_job(self, job_type: IngestJobType) -> IngestJob:
        running = await self._session.scalar(
            select(func.count())
            .select_from(IngestJob)
            .where(IngestJob.status.in_([IngestJobStatus.PENDING, IngestJobStatus.RUNNING]))
        )
        if running:
            raise RuntimeError("Ya hay un trabajo de ingesta en curso")

        job = IngestJob(type=job_type, status=IngestJobStatus.PENDING, stats={})
        self._session.add(job)
        await self._session.commit()
        await self._session.refresh(job)
        return job

    async def list_pages(self, limit: int = 50, offset: int = 0) -> dict:
        total = await self._session.scalar(
            select(func.count()).select_from(WikiPage).where(WikiPage.is_deleted.is_(False))
        )
        result = await self._session.execute(
            select(WikiPage)
            .where(WikiPage.is_deleted.is_(False))
            .order_by(WikiPage.title.asc())
            .offset(offset)
            .limit(limit)
        )
        pages = result.scalars().all()
        chunk_counts: dict[uuid.UUID, int] = {}
        if pages:
            counts = await self._session.execute(
                select(Chunk.page_id, func.count())
                .where(Chunk.page_id.in_([p.id for p in pages]))
                .group_by(Chunk.page_id)
            )
            chunk_counts = {page_id: count for page_id, count in counts.all()}

        return {
            "total": total or 0,
            "items": [
                {
                    "id": str(page.id),
                    "wikijs_page_id": page.wikijs_page_id,
                    "path": page.path,
                    "title": page.title,
                    "locale": page.locale,
                    "tags": page.tags,
                    "chunk_count": chunk_counts.get(page.id, 0),
                    "wiki_updated_at": page.wiki_updated_at.isoformat() if page.wiki_updated_at else None,
                    "last_synced_at": page.last_synced_at.isoformat() if page.last_synced_at else None,
                    "wiki_url": f"{self._settings.wikijs_url.rstrip('/')}/{page.path}",
                }
                for page in pages
            ],
        }
