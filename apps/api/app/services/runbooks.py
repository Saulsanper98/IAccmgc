from __future__ import annotations

import json
import logging
import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm import attributes as orm_attributes

from app.config import Settings
from app.db.models import (
    Runbook,
    RunbookSession,
    RunbookSessionStep,
    RunbookStatus,
    RunbookStep,
    SessionOutcome,
    SessionStepStatus,
    WikiPage,
)
from app.services.ollama import OllamaClient

logger = logging.getLogger(__name__)

VARIABLE_RE = re.compile(r"\{\{(\w+)\}\}")


class RunbookService:
    def __init__(self, session: AsyncSession, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._ollama = OllamaClient(settings)

    async def list_runbooks(self, status: str | None = None) -> dict:
        query = select(Runbook).options(selectinload(Runbook.steps)).order_by(Runbook.updated_at.desc())
        if status:
            query = query.where(Runbook.status == RunbookStatus(status))
        runbooks = (await self._session.execute(query)).scalars().unique().all()
        return {"items": [_serialize_runbook(rb) for rb in runbooks]}

    async def get_runbook(self, runbook_id: uuid.UUID) -> dict:
        runbook = await self._load_runbook(runbook_id)
        return _serialize_runbook(runbook, include_steps=True)

    async def create_from_page(self, page_id: uuid.UUID, user_id: str) -> dict:
        page = await self._session.get(WikiPage, page_id)
        if not page or page.is_deleted:
            raise ValueError("P?gina no encontrada")

        draft_steps = await self._generate_steps_from_content(page.title, page.content_raw)
        runbook = Runbook(
            source_page_id=page.id,
            title=f"Runbook: {page.title}",
            description=f"Generado desde la wiki ({page.path})",
            status=RunbookStatus.DRAFT,
            version=1,
            created_by=user_id,
        )
        self._session.add(runbook)
        await self._session.flush()
        await self._replace_steps(runbook, draft_steps)
        await self._session.commit()
        return await self.get_runbook(runbook.id)

    async def update_runbook(self, runbook_id: uuid.UUID, payload: dict, user_id: str) -> dict:
        runbook = await self._load_runbook(runbook_id)
        if payload.get("title"):
            runbook.title = payload["title"][:512]
        if "description" in payload:
            runbook.description = payload["description"]
        if payload.get("steps"):
            await self._replace_steps(runbook, payload["steps"])
        runbook.updated_at = datetime.now(UTC)
        await self._session.commit()
        return await self.get_runbook(runbook.id)

    async def publish_runbook(self, runbook_id: uuid.UUID, user_id: str) -> dict:
        runbook = await self._load_runbook(runbook_id)
        if not _loaded_collection(runbook, "steps"):
            raise ValueError("El runbook no tiene pasos")
        runbook.status = RunbookStatus.PUBLISHED
        runbook.version += 1
        runbook.updated_at = datetime.now(UTC)
        await self._session.commit()
        return await self.get_runbook(runbook.id)

    async def regenerate_from_source(self, runbook_id: uuid.UUID, user_id: str) -> dict:
        runbook = await self._load_runbook(runbook_id)
        if not runbook.source_page_id:
            raise ValueError("Este runbook no tiene p?gina origen")
        page = await self._session.get(WikiPage, runbook.source_page_id)
        if not page or page.is_deleted:
            raise ValueError("P?gina origen no encontrada")

        draft_steps = await self._generate_steps_from_content(page.title, page.content_raw)
        await self._replace_steps(runbook, draft_steps)
        if runbook.status == RunbookStatus.PUBLISHED:
            runbook.version += 1
        runbook.updated_at = datetime.now(UTC)
        await self._session.commit()
        return await self.get_runbook(runbook.id)

    async def start_session(self, runbook_id: uuid.UUID, user_id: str, context: dict) -> dict:
        runbook = await self._load_runbook(runbook_id)
        if runbook.status != RunbookStatus.PUBLISHED:
            raise ValueError("Solo se pueden ejecutar runbooks publicados")

        session = RunbookSession(
            runbook_id=runbook.id,
            runbook_version=runbook.version,
            executed_by=user_id,
            context=context,
        )
        self._session.add(session)
        await self._session.flush()
        session_id = session.id
        await self._session.commit()
        session = await self._load_session(session_id)
        runbook = await self._load_runbook(runbook.id)
        return _serialize_session(session, runbook)

    async def complete_step(
        self,
        session_id: uuid.UUID,
        step_id: uuid.UUID,
        status: SessionStepStatus,
        note: str | None,
    ) -> dict:
        session = await self._load_session(session_id)
        if session.outcome:
            raise ValueError("Sesi?n no v?lida o ya finalizada")

        step = await self._session.get(RunbookStep, step_id)
        if not step or step.runbook_id != session.runbook_id:
            raise ValueError("Paso no pertenece al runbook")

        if step.is_checkpoint and status == SessionStepStatus.DONE and not (note or "").strip():
            raise ValueError("Los pasos checkpoint requieren una nota")

        existing = await self._session.get(RunbookSessionStep, (session_id, step_id))
        if existing:
            existing.status = status
            existing.note = note
            existing.completed_at = datetime.now(UTC)
        else:
            self._session.add(
                RunbookSessionStep(
                    session_id=session_id,
                    step_id=step_id,
                    status=status,
                    note=note,
                    completed_at=datetime.now(UTC),
                )
            )
        await self._session.commit()
        session = await self._load_session(session_id)
        runbook = await self._load_runbook(session.runbook_id)
        return _serialize_session(session, runbook)

    async def undo_last_step(self, session_id: uuid.UUID) -> dict:
        session = await self._load_session(session_id)
        if session.outcome:
            raise ValueError("Sesi?n no v?lida o ya finalizada")

        records = sorted(
            [r for r in session.step_records if r.completed_at],
            key=lambda r: r.completed_at or datetime.min.replace(tzinfo=UTC),
            reverse=True,
        )
        if not records:
            raise ValueError("No hay pasos completados para deshacer")

        last = records[0]
        await self._session.delete(last)
        await self._session.commit()
        session = await self._load_session(session_id)
        runbook = await self._load_runbook(session.runbook_id)
        return _serialize_session(session, runbook)

    async def finish_session(
        self, session_id: uuid.UUID, outcome: SessionOutcome
    ) -> dict:
        session = await self._load_session(session_id)
        if session.outcome:
            raise ValueError("Sesi?n no v?lida")
        session.outcome = outcome
        session.finished_at = datetime.now(UTC)
        await self._session.commit()
        session = await self._load_session(session_id)
        runbook = await self._load_runbook(session.runbook_id)
        return _serialize_session(session, runbook)

    async def list_sessions(self, runbook_id: uuid.UUID) -> dict:
        sessions = (
            await self._session.execute(
                select(RunbookSession)
                .where(RunbookSession.runbook_id == runbook_id)
                .order_by(RunbookSession.started_at.desc())
            )
        ).scalars().all()
        return {
            "items": [
                {
                    "id": str(s.id),
                    "runbook_version": s.runbook_version,
                    "executed_by": s.executed_by,
                    "outcome": s.outcome.value if s.outcome else None,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "finished_at": s.finished_at.isoformat() if s.finished_at else None,
                }
                for s in sessions
            ]
        }

    async def _load_runbook(self, runbook_id: uuid.UUID) -> Runbook:
        runbook = (
            await self._session.execute(
                select(Runbook).options(selectinload(Runbook.steps)).where(Runbook.id == runbook_id)
            )
        ).scalar_one_or_none()
        if not runbook:
            raise ValueError("Runbook no encontrado")
        return runbook

    async def _load_session(self, session_id: uuid.UUID) -> RunbookSession:
        session = (
            await self._session.execute(
                select(RunbookSession)
                .options(selectinload(RunbookSession.step_records))
                .where(RunbookSession.id == session_id)
            )
        ).scalar_one_or_none()
        if not session:
            raise ValueError("Sesi?n no encontrada")
        return session

    async def _replace_steps(self, runbook: Runbook, steps_data: list[dict]) -> None:
        await self._session.execute(delete(RunbookStep).where(RunbookStep.runbook_id == runbook.id))
        for idx, step in enumerate(steps_data, start=1):
            instructions = step.get("instructions_md") or step.get("instructions") or ""
            variables = _extract_variables(instructions)
            self._session.add(
                RunbookStep(
                    runbook_id=runbook.id,
                    ordinal=idx,
                    title=(step.get("title") or f"Paso {idx}")[:512],
                    instructions_md=instructions,
                    expected_result=step.get("expected_result", ""),
                    is_checkpoint=bool(step.get("is_checkpoint")),
                    variables=variables,
                )
            )
        await self._session.flush()

    async def _generate_steps_from_content(self, title: str, content: str) -> list[dict]:
        system = (
            "Eres un ingeniero de sistemas. Convierte documentaci?n en pasos de runbook. "
            "Responde SOLO JSON: {\"steps\": [{\"title\": \"...\", \"instructions_md\": \"...\", "
            "\"expected_result\": \"...\", \"is_checkpoint\": false}]}. Usa variables {{nombre}} cuando aplique."
        )
        prompt = f"T?tulo: {title}\n\nContenido:\n{content[:6000]}\n\nGenera 4-12 pasos ejecutables."
        try:
            raw = await self._ollama.generate_text(prompt, system=system)
            start = raw.find("{")
            end = raw.rfind("}") + 1
            if start >= 0 and end > start:
                data = json.loads(raw[start:end])
                steps = data.get("steps", [])
                if steps:
                    normalized = [_normalize_step(step, idx) for idx, step in enumerate(steps, start=1)]
                    if not _is_low_quality_steps(normalized):
                        return normalized
                    logger.info("Runbook LLM steps low quality, using section fallback")
        except Exception:
            logger.warning("Runbook LLM generation failed, using fallback", exc_info=True)

        return _fallback_steps(title, content)


def _is_low_quality_steps(steps: list[dict]) -> bool:
    if len(steps) < 2:
        return True
    generic_titles = sum(
        1 for step in steps if re.match(r"^Paso \d+$", (step.get("title") or "").strip())
    )
    if generic_titles / len(steps) >= 0.5:
        return True
    weak = 0
    for step in steps:
        instructions = _strip_markdown_noise((step.get("instructions_md") or "").strip())
        if not instructions:
            weak += 1
            continue
        if re.match(r"^#{1,3}\s+", instructions):
            weak += 1
            continue
        if len(instructions) < 40:
            weak += 1
    return weak / len(steps) >= 0.4


def _normalize_step(step: dict, ordinal: int) -> dict:
    title = (step.get("title") or f"Paso {ordinal}").strip()[:512]
    instructions = (step.get("instructions_md") or step.get("instructions") or "").strip()
    if instructions.startswith("{") and '"steps"' in instructions:
        instructions = title
    instructions = _strip_markdown_noise(instructions)
    expected = (step.get("expected_result") or "Paso completado sin incidencias").strip()
    return {
        "title": title or f"Paso {ordinal}",
        "instructions_md": instructions or title,
        "expected_result": expected,
        "is_checkpoint": bool(step.get("is_checkpoint")),
    }


def _strip_markdown_noise(text: str) -> str:
    cleaned = text.strip()
    if cleaned in {"---", "***", "___"}:
        return ""
    return cleaned


def _fallback_steps(title: str, content: str) -> list[dict]:
    sections = _split_content_into_sections(content)
    if not sections:
        return [
            {
                "title": f"Revisar {title}",
                "instructions_md": "Revisar la documentaci?n fuente y completar los pasos manualmente.",
                "expected_result": "Pasos definidos y listos para ejecutar",
                "is_checkpoint": False,
            }
        ]
    return [
        {
            "title": section["title"],
            "instructions_md": section["body"],
            "expected_result": "Secci?n completada sin incidencias",
            "is_checkpoint": bool(section.get("is_checkpoint")),
        }
        for section in sections
    ]


def _split_content_into_sections(content: str) -> list[dict]:
    lines = content.splitlines()
    sections: list[dict] = []
    current_title = ""
    current_body: list[str] = []

    def flush() -> None:
        body = "\n".join(current_body).strip()
        body = _strip_markdown_noise(body)
        if not current_title and not body:
            return
        title = current_title or (body.splitlines()[0][:120] if body else "Paso")
        if body.startswith("#"):
            body_lines = [line for line in body.splitlines() if not line.strip().startswith("#")]
            body = "\n".join(body_lines).strip()
        if not body or body == title:
            if not current_title:
                return
            body = f"Revisar y completar: {title}"
        sections.append(
            {
                "title": title[:512],
                "body": body or title,
                "is_checkpoint": False,
            }
        )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current_body:
                current_body.append("")
            continue
        if stripped in {"---", "***", "___"}:
            continue
        heading = re.match(r"^(#{1,3})\s+(.+)$", stripped)
        if heading:
            if current_title or current_body:
                flush()
                current_body = []
            current_title = heading.group(2).strip()
            continue
        numbered = re.match(r"^(\d+)[\).\]]\s+(.+)$", stripped)
        if numbered and not current_title:
            if current_body:
                flush()
                current_body = []
            current_title = numbered.group(2).strip()[:512]
            continue
        current_body.append(line.rstrip())

    if current_title or current_body:
        flush()

    if len(sections) > 12:
        merged: list[dict] = []
        chunk_size = max(2, len(sections) // 8)
        for idx in range(0, len(sections), chunk_size):
            chunk = sections[idx : idx + chunk_size]
            merged.append(
                {
                    "title": chunk[0]["title"],
                    "body": "\n\n".join(
                        f"### {part['title']}\n\n{part['body']}" if part["title"] != chunk[0]["title"] else part["body"]
                        for part in chunk
                    ),
                    "is_checkpoint": False,
                }
            )
        sections = merged

    return sections[:12]


def _extract_variables(text: str) -> list[dict]:
    names = sorted(set(VARIABLE_RE.findall(text)))
    return [{"name": name, "description": f"Valor para {name}", "default": ""} for name in names]


def _loaded_collection(instance: object, attribute: str) -> list:
    state = orm_attributes.instance_state(instance)
    if attribute in state.unloaded:
        raise RuntimeError(f"Relaci?n {attribute} no cargada antes de serializar")
    value = getattr(instance, attribute)
    return list(value) if value is not None else []


def _serialize_runbook(runbook: Runbook, include_steps: bool = False) -> dict:
    steps = _loaded_collection(runbook, "steps")
    data = {
        "id": str(runbook.id),
        "source_page_id": str(runbook.source_page_id) if runbook.source_page_id else None,
        "title": runbook.title,
        "description": runbook.description,
        "status": runbook.status.value,
        "version": runbook.version,
        "created_by": runbook.created_by,
        "created_at": runbook.created_at.isoformat() if runbook.created_at else None,
        "updated_at": runbook.updated_at.isoformat() if runbook.updated_at else None,
        "step_count": len(steps),
    }
    if include_steps:
        data["steps"] = [
            {
                "id": str(step.id),
                "ordinal": step.ordinal,
                "title": step.title,
                "instructions_md": step.instructions_md,
                "expected_result": step.expected_result,
                "is_checkpoint": step.is_checkpoint,
                "variables": step.variables,
            }
            for step in sorted(steps, key=lambda s: s.ordinal)
        ]
    return data


def _serialize_session(session: RunbookSession, runbook: Runbook) -> dict:
    step_records = _loaded_collection(session, "step_records")
    steps = _loaded_collection(runbook, "steps")
    step_status = {rec.step_id: rec for rec in step_records}
    return {
        "id": str(session.id),
        "runbook_id": str(session.runbook_id),
        "runbook_version": session.runbook_version,
        "executed_by": session.executed_by,
        "context": session.context,
        "outcome": session.outcome.value if session.outcome else None,
        "started_at": session.started_at.isoformat() if session.started_at else None,
        "finished_at": session.finished_at.isoformat() if session.finished_at else None,
        "steps": [
            {
                **{
                    "id": str(step.id),
                    "ordinal": step.ordinal,
                    "title": step.title,
                    "instructions_md": _render_variables(step.instructions_md, session.context),
                    "expected_result": step.expected_result,
                    "is_checkpoint": step.is_checkpoint,
                    "variables": step.variables,
                },
                "status": step_status[step.id].status.value if step.id in step_status else None,
                "note": step_status[step.id].note if step.id in step_status else None,
            }
            for step in sorted(steps, key=lambda s: s.ordinal)
        ],
    }


def _render_variables(text: str, context: dict) -> str:
    def repl(match: re.Match[str]) -> str:
        key = match.group(1)
        return str(context.get(key, match.group(0)))

    return VARIABLE_RE.sub(repl, text)
