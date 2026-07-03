import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedUser, get_authenticated_user
from app.config import Settings, get_settings
from app.db.session import get_db
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["chat"])


class CreateConversationRequest(BaseModel):
    title: str = "Nueva conversación"


class RenameConversationRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


class FeedbackRequest(BaseModel):
    rating: int = Field(description="1 for positive, -1 for negative")
    comment: str | None = None


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
    service = ChatService(session, settings)
    try:
        result = await service.submit_feedback(
            message_id, user.user_id, body.rating, body.comment
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not result:
        raise HTTPException(status_code=404, detail="Mensaje no encontrado")
    return result
