import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedUser, get_authenticated_user
from app.config import Settings, get_settings
from app.db.models import QaFeedbackRating
from app.db.session import get_db
from app.services.chat import ChatService
from app.services.validated_qa import ValidatedQAService

router = APIRouter(prefix="/chat", tags=["chat"])


class CreateConversationRequest(BaseModel):
    title: str = "Nueva conversación"


class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class FeedbackRequest(BaseModel):
    rating: QaFeedbackRating | int | str
    correction: str | None = Field(default=None, max_length=8000)
    comment: str | None = Field(default=None, max_length=500)  # legacy UI (Fase 3 retira)
    legacy: bool = False

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_feedback(cls, data: object) -> object:
        if not isinstance(data, dict):
            return data
        raw_rating = data.get("rating")
        if raw_rating in (1, "1", -1, "-1"):
            data["legacy"] = True
        if raw_rating in (1, "1"):
            data["rating"] = QaFeedbackRating.UP.value
        elif raw_rating in (-1, "-1"):
            data["rating"] = QaFeedbackRating.DOWN.value
        return data


@router.get("/conversations")
async def list_conversations(
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = ChatService(session, settings)
    items = await service.list_conversations(user.user_id)
    return {"items": items}


@router.post("/conversations")
async def create_conversation(
    body: CreateConversationRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = ChatService(session, settings)
    return await service.create_conversation(user.user_id, body.title)


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = ChatService(session, settings)
    conversation = await service.get_conversation(conversation_id, user.user_id)
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return conversation


@router.patch("/conversations/{conversation_id}")
async def rename_conversation(
    conversation_id: uuid.UUID,
    body: RenameConversationRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = ChatService(session, settings)
    result = await service.rename_conversation(conversation_id, user.user_id, body.title)
    if not result:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return result


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = ChatService(session, settings)
    deleted = await service.delete_conversation(conversation_id, user.user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversación no encontrada")
    return {"status": "deleted"}


@router.post("/conversations/{conversation_id}/messages")
async def send_message(
    conversation_id: uuid.UUID,
    body: SendMessageRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> StreamingResponse:
    service = ChatService(session, settings)

    async def event_stream():
        async for chunk in service.stream_response(conversation_id, user.user_id, body.content):
            yield chunk

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/messages/{message_id}/feedback")
async def submit_feedback(
    message_id: uuid.UUID,
    body: FeedbackRequest,
    user: AuthenticatedUser = Depends(get_authenticated_user),
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    service = ValidatedQAService(session, settings)
    try:
        result = await service.submit_message_feedback(
            message_id,
            user.user_id,
            body.rating,
            correction=body.correction,
            comment=body.comment,
            legacy=body.legacy,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not result:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    return result
