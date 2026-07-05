"""WikiBridge async worker (arq)."""

import logging

from arq import cron
from arq.connections import RedisSettings

from app.config import get_settings
from app.logging_config import setup_logging
from app.worker_tasks import run_health_scan, run_ingest_job

logger = logging.getLogger(__name__)


async def startup(ctx: dict) -> None:
    settings = get_settings()
    setup_logging(settings.debug)
    logger.info("Worker started", extra={"redis_url": settings.redis_url})


async def shutdown(ctx: dict) -> None:
    logger.info("Worker shutting down")


async def scheduled_incremental_sync(ctx: dict) -> dict:
    """Enqueue incremental Wiki.js sync on the worker cron schedule."""
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

    from app.db.models import IngestJobType
    from app.services.ingest import IngestService
    from app.services.queue import enqueue_ingest_job

    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        service = IngestService(session, settings)
        try:
            job = await service.create_job(IngestJobType.INCREMENTAL)
        except RuntimeError:
            logger.info("Skipping scheduled incremental sync — job already running")
            return {"status": "skipped"}
        await enqueue_ingest_job(settings.redis_url, str(job.id))
        logger.info("Scheduled incremental sync enqueued", extra={"job_id": str(job.id)})
        return {"status": "enqueued", "job_id": str(job.id)}


def _incremental_sync_cron_jobs(settings) -> list:
    return [
        cron(
            scheduled_incremental_sync,
            hour=hour,
            minute=settings.incremental_sync_cron_minute,
            run_at_startup=False,
        )
        for hour in settings.incremental_sync_hours()
    ]


class WorkerSettings:
    settings = get_settings()
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    job_timeout = settings.ingest_job_timeout_seconds

    functions = [run_ingest_job, run_health_scan]
    on_startup = startup
    on_shutdown = shutdown

    cron_jobs = _incremental_sync_cron_jobs(settings)
