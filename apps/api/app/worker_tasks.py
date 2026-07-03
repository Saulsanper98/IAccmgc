import uuid

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.models import IngestJobType
from app.logging_config import setup_logging
from app.services.document_health.service import HealthService
from app.services.ingest import IngestService
from app.services.queue import enqueue_health_scan

settings = get_settings()
engine = create_async_engine(settings.database_url, pool_pre_ping=True)
session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def run_ingest_job(ctx: dict, job_id: str) -> dict:
  """arq task: process a Wiki.js ingest job."""
  setup_logging(settings.debug)
  async with session_factory() as session:
      service = IngestService(session, settings)
      result = await service.run_job(uuid.UUID(job_id))
      if settings.health_scan_after_ingest:
          health = HealthService(session, settings)
          try:
              scan_job = await health.create_scan_job(trigger="post_ingest")
              await enqueue_health_scan(settings.redis_url, str(scan_job.id))
          except RuntimeError:
              pass
      return result


async def run_health_scan(ctx: dict, job_id: str) -> dict:
    """arq task: run document health detectors."""
    setup_logging(settings.debug)
    async with session_factory() as session:
        service = HealthService(session, settings)
        return await service.run_scan(uuid.UUID(job_id))
