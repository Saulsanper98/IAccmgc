from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedUser, get_authenticated_user
from app.db.session import get_db
from app.services.chat_instructions import ChatInstructionsService, MAX_INSTRUCTION_LENGTH

router = APIRouter(prefix="/chat/instructions", tags=["chat-instructions"])


class InstructionsBody(BaseModel):
    content: str = Field(max_length=MAX_INSTRUCTION_LENGTH)


@router.get("")
async def get_instructions(
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = ChatInstructionsService(session)
    return await service.get_all(user.user_id)


@router.put("/user")
async def update_user_instructions(
    body: InstructionsBody,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    service = ChatInstructionsService(session)
    try:
        result = await service.update_user(user.user_id, body.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result


@router.put("/team")
async def update_team_instructions(
    body: InstructionsBody,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Solo administradores")
    service = ChatInstructionsService(session)
    try:
        result = await service.update_team(user.user_id, body.content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return result
