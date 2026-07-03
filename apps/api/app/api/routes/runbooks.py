import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedUser, get_authenticated_user
from app.config import Settings, get_settings
from app.db.models import SessionOutcome, SessionStepStatus
from app.db.session import get_db
from app.services.runbooks import RunbookService

router = APIRouter(prefix="/runbooks", tags=["runbooks"])


class CreateFromPageRequest(BaseModel):
    page_id: uuid.UUID


class UpdateRunbookRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    steps: list[dict] | None = None


class StartSessionRequest(BaseModel):
    context: dict = Field(default_factory=dict)


class CompleteStepRequest(BaseModel):
    status: SessionStepStatus
    note: str | None = None


class FinishSessionRequest(BaseModel):
    outcome: SessionOutcome


@router.get("")
async def list_runbooks(
    status: str | None = None,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = RunbookService(session, settings)
    return await service.list_runbooks(status=status)


@router.get("/{runbook_id}")
async def get_runbook(
    runbook_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = RunbookService(session, settings)
    try:
        return await service.get_runbook(runbook_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/from-page")
async def create_from_page(
    body: CreateFromPageRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    if user.role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Sin permisos")
    service = RunbookService(session, settings)
    try:
        return await service.create_from_page(body.page_id, user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.patch("/{runbook_id}")
async def update_runbook(
    runbook_id: uuid.UUID,
    body: UpdateRunbookRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    if user.role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Sin permisos")
    service = RunbookService(session, settings)
    try:
        return await service.update_runbook(runbook_id, body.model_dump(exclude_none=True), user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/{runbook_id}/publish")
async def publish_runbook(
    runbook_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    if user.role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Sin permisos")
    service = RunbookService(session, settings)
    try:
        return await service.publish_runbook(runbook_id, user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{runbook_id}/regenerate")
async def regenerate_runbook(
    runbook_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    if user.role not in ("admin", "editor"):
        raise HTTPException(status_code=403, detail="Sin permisos")
    service = RunbookService(session, settings)
    try:
        return await service.regenerate_from_source(runbook_id, user.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/{runbook_id}/sessions")
async def start_session(
    runbook_id: uuid.UUID,
    body: StartSessionRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = RunbookService(session, settings)
    try:
        return await service.start_session(runbook_id, user.user_id, body.context)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/steps/{step_id}")
async def complete_step(
    session_id: uuid.UUID,
    step_id: uuid.UUID,
    body: CompleteStepRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = RunbookService(session, settings)
    try:
        return await service.complete_step(session_id, step_id, body.status, body.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/undo")
async def undo_last_step(
    session_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = RunbookService(session, settings)
    try:
        return await service.undo_last_step(session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/finish")
async def finish_session(
    session_id: uuid.UUID,
    body: FinishSessionRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = RunbookService(session, settings)
    try:
        return await service.finish_session(session_id, body.outcome)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/{runbook_id}/sessions")
async def list_sessions(
    runbook_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = RunbookService(session, settings)
    return await service.list_sessions(runbook_id)
