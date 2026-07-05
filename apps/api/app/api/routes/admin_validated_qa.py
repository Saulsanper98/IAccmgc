import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedUser, get_authenticated_user
from app.config import Settings, get_settings
from app.db.models import ValidatedQaStatus
from app.db.session import get_db
from app.services.validated_qa import ValidatedQAService

router = APIRouter(prefix="/admin/validated-qa", tags=["admin-validated-qa"])


class ValidatedQaUpdateBody(BaseModel):
    question: str | None = Field(default=None, min_length=1)
    answer: str | None = Field(default=None, min_length=1)
    status: ValidatedQaStatus | None = None
    valid_from: date | None = None
    valid_until: date | None = None
    notes: str | None = Field(default=None, max_length=2000)


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
    service = ValidatedQAService(session, settings)
    return await service.list_for_admin(status=status, limit=limit, offset=offset)


@router.get("/pending-count")
async def pending_count(
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    _require_admin(user)
    service = ValidatedQAService(session, settings)
    return {"pending": await service.count_pending()}


@router.put("/{validated_qa_id}")
async def update_validated_qa(
    validated_qa_id: uuid.UUID,
    body: ValidatedQaUpdateBody,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    _require_admin(user)
    service = ValidatedQAService(session, settings)
    try:
        result = await service.update_for_admin(
            validated_qa_id,
            user.user_id,
            question=body.question,
            answer=body.answer,
            status=body.status,
            valid_from=body.valid_from,
            valid_until=body.valid_until,
            notes=body.notes,
            fields_set=body.model_fields_set,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not result:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    return result


@router.delete("/{validated_qa_id}")
async def delete_validated_qa(
    validated_qa_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    _require_admin(user)
    service = ValidatedQAService(session, settings)
    deleted = await service.delete_for_admin(validated_qa_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Entrada no encontrada")
    return {"status": "deleted", "id": str(validated_qa_id)}
