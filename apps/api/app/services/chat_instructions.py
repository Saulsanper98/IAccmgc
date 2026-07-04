from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TEAM_CHAT_INSTRUCTIONS_ID, TeamChatInstructions, UserChatInstructions
from app.services.validated_qa import ValidatedQaHit

MAX_INSTRUCTION_LENGTH = 4000

INSTRUCTIONS_PROMPT_RULES = """
8. Si hay instrucciones del equipo o personales, aplícalas al interpretar la pregunta y al priorizar fragmentos (páginas, rutas o temas indicados).
9. Las instrucciones orientan dónde buscar y cómo responder; no sustituyen la evidencia de los fragmentos. Si no hay fragmentos relevantes, dilo explícitamente."""


def format_validated_qa_prompt_section(hits: list[ValidatedQaHit]) -> str:
    if not hits:
        return ""

    lines = [
        "\n\n### Respuestas validadas por el equipo (máxima prioridad)",
        "Si la pregunta del usuario coincide con alguna de las siguientes, básate en la respuesta validada. Tiene prioridad sobre la documentación de la wiki si hay conflicto.",
        "",
    ]
    for hit in hits:
        date_str = hit.validated_at.date().isoformat()
        lines.append(f"[Q]: {hit.question}")
        lines.append(f"[A]: {hit.answer} (validada el {date_str})")
        lines.append("")
    return "\n".join(lines).rstrip()


def build_rag_system_prompt(
    base_prompt: str,
    *,
    team_instructions: str | None = None,
    user_instructions: str | None = None,
    validated_qa_hits: list[ValidatedQaHit] | None = None,
) -> str:
    parts = [base_prompt.rstrip(), INSTRUCTIONS_PROMPT_RULES]

    team_text = (team_instructions or "").strip()
    if team_text:
        parts.append(f"\n\nInstrucciones del equipo (aplicar a todos los usuarios):\n{team_text}")

    user_text = (user_instructions or "").strip()
    if user_text:
        parts.append(f"\n\nInstrucciones personales del usuario:\n{user_text}")

    validated_section = format_validated_qa_prompt_section(validated_qa_hits or [])
    if validated_section:
        parts.append(validated_section)

    return "".join(parts)


def build_rag_user_message_content(context_block: str, user_question: str) -> str:
    return (
        f"Fragmentos de documentación:\n\n{context_block}\n\n"
        f"Pregunta del usuario: {user_question}"
    )


class ChatInstructionsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_all(self, user_id: str) -> dict:
        user_row = await self._session.get(UserChatInstructions, user_id)
        team_row = await self._session.get(TeamChatInstructions, TEAM_CHAT_INSTRUCTIONS_ID)
        return {
            "user": self._serialize_user(user_row),
            "team": self._serialize_team(team_row),
        }

    async def get_for_prompt(self, user_id: str) -> tuple[str | None, str | None]:
        user_row = await self._session.get(UserChatInstructions, user_id)
        team_row = await self._session.get(TeamChatInstructions, TEAM_CHAT_INSTRUCTIONS_ID)
        user_text = user_row.content.strip() if user_row and user_row.content.strip() else None
        team_text = team_row.content.strip() if team_row and team_row.content.strip() else None
        return user_text, team_text

    async def update_user(self, user_id: str, content: str) -> dict:
        normalized = _normalize_content(content)
        row = await self._session.get(UserChatInstructions, user_id)
        if row is None:
            row = UserChatInstructions(user_id=user_id, content=normalized)
            self._session.add(row)
        else:
            row.content = normalized
        await self._session.commit()
        await self._session.refresh(row)
        return self._serialize_user(row)

    async def update_team(self, user_id: str, content: str) -> dict:
        normalized = _normalize_content(content)
        row = await self._session.get(TeamChatInstructions, TEAM_CHAT_INSTRUCTIONS_ID)
        if row is None:
            row = TeamChatInstructions(
                id=TEAM_CHAT_INSTRUCTIONS_ID,
                content=normalized,
                updated_by=user_id,
            )
            self._session.add(row)
        else:
            row.content = normalized
            row.updated_by = user_id
        await self._session.commit()
        await self._session.refresh(row)
        return self._serialize_team(row)

    @staticmethod
    def _serialize_user(row: UserChatInstructions | None) -> dict:
        if row is None:
            return {"content": "", "updated_at": None}
        return {
            "content": row.content,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        }

    @staticmethod
    def _serialize_team(row: TeamChatInstructions | None) -> dict:
        if row is None:
            return {"content": "", "updated_at": None, "updated_by": None}
        return {
            "content": row.content,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "updated_by": row.updated_by,
        }


def _normalize_content(content: str) -> str:
    text = content.strip()
    if len(text) > MAX_INSTRUCTION_LENGTH:
        raise ValueError(f"Máximo {MAX_INSTRUCTION_LENGTH} caracteres")
    return text
