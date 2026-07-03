from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import verify_internal_token
from app.config import Settings, get_settings
from app.db.models import IngestJobType
from app.db.session import get_db
from app.services.ingest import IngestService
from app.services.queue import enqueue_ingest_job

router = APIRouter(prefix="/admin/ingest", tags=["admin-ingest"])


class SyncRequest(BaseModel):
    type: IngestJobType = IngestJobType.INCREMENTAL


@router.get("/status")
async def ingest_status(
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: None = Depends(verify_internal_token),
) -> dict:
    service = IngestService(session, settings)
    status = await service.get_status()
    status["wikijs_url"] = settings.wikijs_url.rstrip("/")
    return status


@router.get("/pages")
async def ingest_pages(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: None = Depends(verify_internal_token),
) -> dict:
    service = IngestService(session, settings)
    return await service.list_pages(limit=limit, offset=offset)


@router.post("/sync")
async def trigger_sync(
    body: SyncRequest,
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: None = Depends(verify_internal_token),
) -> dict:
    service = IngestService(session, settings)
    try:
        job = await service.create_job(body.type)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    await enqueue_ingest_job(settings.redis_url, str(job.id))
    return {
        "job_id": str(job.id),
        "type": job.type.value,
        "status": job.status.value,
    }
