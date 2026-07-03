import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedUser, get_authenticated_user, verify_internal_token
from app.config import Settings, get_settings
from app.db.models import FindingStatus
from app.db.session import get_db
from app.services.document_health.service import HealthService
from app.services.queue import enqueue_health_scan
from app.services.runbooks import RunbookService

router = APIRouter(prefix="/health", tags=["health"])


class UpdateFindingRequest(BaseModel):
    status: FindingStatus


@router.get("/summary")
async def health_summary(
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: None = Depends(verify_internal_token),
) -> dict:
    service = HealthService(session, settings)
    return await service.get_summary()


@router.get("/findings")
async def list_findings(
    status: str | None = Query(default=None),
    detector: str | None = Query(default=None),
    severity: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
    _: None = Depends(verify_internal_token),
) -> dict:
    service = HealthService(session, settings)
    return await service.list_findings(
        status=status, detector=detector, severity=severity, limit=limit, offset=offset
    )


@router.patch("/findings/{finding_id}")
async def update_finding(
    finding_id: uuid.UUID,
    body: UpdateFindingRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    if user.role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Sin permisos")
    service = HealthService(session, settings)
    try:
        return await service.update_finding_status(finding_id, body.status, user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/scan")
async def trigger_health_scan(
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    service = HealthService(session, settings)
    try:
        job = await service.create_scan_job(trigger="manual")
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await enqueue_health_scan(settings.redis_url, str(job.id))
    return {"job_id": str(job.id), "status": "pending"}
