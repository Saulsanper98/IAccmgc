import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedUser, get_authenticated_user
from app.config import Settings, get_settings
from app.db.models import ValidatedQaStatus
from app.db.session import get_db
from app.services.validated_qa import ValidatedQaService

router = APIRouter(prefix="/admin/validated-qa", tags=["admin-validated-qa"])


class ValidatedQaUpdateBody(BaseModel):
    question: str | None = Field(default=None, min_length=1)
    answer: str | None = Field(default=None, min_length=1)
    status: ValidatedQaStatus | None = None
    notes: str | None = None
    valid_from: date | None = None


def _require_admin(user: AuthenticatedUser) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")


@router.get("")
async def list_validated_qa(
    status: ValidatedQaStatus | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    _require_admin(user)
    service = ValidatedQaService(session, settings)
    return await service.list_entries(status=status, limit=limit, offset=offset)


@router.get("/pending-count")
async def pending_count(
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    _require_admin(user)
    service = ValidatedQaService(session, settings)
    return {"count": await service.count_pending()}


@router.put("/{entry_id}")
async def update_validated_qa(
    entry_id: uuid.UUID,
    body: ValidatedQaUpdateBody,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    _require_admin(user)
    service = ValidatedQaService(session, settings)
    try:
        result = await service.update_entry(
            entry_id,
            admin_user_id=user.user_id,
            question=body.question,
            answer=body.answer,
            status=body.status,
            notes=body.notes,
            valid_from=body.valid_from,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not result:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    return result


@router.delete("/{entry_id}")
async def delete_validated_qa(
    entry_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    _require_admin(user)
    service = ValidatedQaService(session, settings)
    deleted = await service.delete_entry(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    return {"deleted": True, "id": str(entry_id)}
