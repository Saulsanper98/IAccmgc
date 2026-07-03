import enum
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import get_settings
from app.db.session import Base

settings = get_settings()


class IngestJobType(str, enum.Enum):
    FULL = "full"
    INCREMENTAL = "incremental"


class IngestJobStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


def _enum_values(enum_cls: type[enum.Enum]) -> list[str]:
    return [member.value for member in enum_cls]


class WikiPage(Base):
    __tablename__ = "wiki_pages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    wikijs_page_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False, index=True)
    path: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    locale: Mapped[str] = mapped_column(String(16), nullable=False, default="es")
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    content_raw: Mapped[str] = mapped_column(Text, nullable=False, default="")
    content_hash: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    wiki_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_deleted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    chunks: Mapped[list["Chunk"]] = relationship(back_populates="page", cascade="all, delete-orphan")


class Chunk(Base):
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wiki_pages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    heading_path: Mapped[str] = mapped_column(String(1024), nullable=False, default="")
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    embedding = mapped_column(Vector(settings.embedding_dim), nullable=True)
    embedding_model: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    page: Mapped["WikiPage"] = relationship(back_populates="chunks")

    __table_args__ = (UniqueConstraint("page_id", "ordinal", name="uq_chunk_page_ordinal"),)


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(256), nullable=False, default="Nueva conversación")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[MessageRole] = mapped_column(
        Enum(MessageRole, name="message_role", values_callable=_enum_values),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    cited_chunk_ids: Mapped[list[uuid.UUID]] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=False, default=list
    )
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    model: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    conversation: Mapped["Conversation"] = relationship(back_populates="messages")
    feedback_entries: Mapped[list["Feedback"]] = relationship(
        back_populates="message", cascade="all, delete-orphan"
    )


class Feedback(Base):
    __tablename__ = "feedback"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[str] = mapped_column(String(128), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    message: Mapped["Message"] = relationship(back_populates="feedback_entries")

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_feedback_message_user"),)


class IngestJob(Base):
    __tablename__ = "ingest_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[IngestJobType] = mapped_column(
        Enum(IngestJobType, name="ingest_job_type", values_callable=_enum_values),
        nullable=False,
    )
    status: Mapped[IngestJobStatus] = mapped_column(
        Enum(IngestJobStatus, name="ingest_job_status", values_callable=_enum_values),
        nullable=False,
        default=IngestJobStatus.PENDING,
    )
    stats: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)


class HealthScanStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class FindingSeverity(str, enum.Enum):
    INFO = "info"
    WARN = "warn"
    CRITICAL = "critical"


class FindingStatus(str, enum.Enum):
    OPEN = "open"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class HealthScanJob(Base):
    __tablename__ = "health_scan_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    status: Mapped[HealthScanStatus] = mapped_column(
        Enum(HealthScanStatus, name="health_scan_status", values_callable=_enum_values),
        nullable=False,
        default=HealthScanStatus.PENDING,
    )
    stats: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    trigger: Mapped[str] = mapped_column(String(32), nullable=False, default="manual")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str | None] = mapped_column(Text)


class StalenessFinding(Base):
    __tablename__ = "staleness_findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    page_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wiki_pages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    detector: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    severity: Mapped[FindingSeverity] = mapped_column(
        Enum(FindingSeverity, name="finding_severity", values_callable=_enum_values),
        nullable=False,
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    evidence: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    evidence_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[FindingStatus] = mapped_column(
        Enum(FindingStatus, name="finding_status", values_callable=_enum_values),
        nullable=False,
        default=FindingStatus.OPEN,
        index=True,
    )
    resolved_by: Mapped[str | None] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    page: Mapped["WikiPage"] = relationship()

    __table_args__ = (
        UniqueConstraint("page_id", "detector", "evidence_hash", name="uq_finding_dedup"),
    )


TEAM_CHAT_INSTRUCTIONS_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


class UserChatInstructions(Base):
    __tablename__ = "user_chat_instructions"

    user_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TeamChatInstructions(Base):
    __tablename__ = "team_chat_instructions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=TEAM_CHAT_INSTRUCTIONS_ID
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_by: Mapped[str | None] = mapped_column(String(128))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RunbookStatus(str, enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"


class SessionOutcome(str, enum.Enum):
    COMPLETED = "completed"
    ABORTED = "aborted"


class SessionStepStatus(str, enum.Enum):
    DONE = "done"
    SKIPPED = "skipped"
    FAILED = "failed"


class Runbook(Base):
    __tablename__ = "runbooks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_page_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("wiki_pages.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[RunbookStatus] = mapped_column(
        Enum(RunbookStatus, name="runbook_status", values_callable=_enum_values),
        nullable=False,
        default=RunbookStatus.DRAFT,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    steps: Mapped[list["RunbookStep"]] = relationship(
        back_populates="runbook", cascade="all, delete-orphan", order_by="RunbookStep.ordinal"
    )
    sessions: Mapped[list["RunbookSession"]] = relationship(back_populates="runbook")


class RunbookStep(Base):
    __tablename__ = "runbook_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    runbook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("runbooks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordinal: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    instructions_md: Mapped[str] = mapped_column(Text, nullable=False, default="")
    expected_result: Mapped[str] = mapped_column(Text, nullable=False, default="")
    is_checkpoint: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    variables: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    runbook: Mapped["Runbook"] = relationship(back_populates="steps")

    __table_args__ = (UniqueConstraint("runbook_id", "ordinal", name="uq_runbook_step_ordinal"),)


class RunbookSession(Base):
    __tablename__ = "runbook_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    runbook_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("runbooks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    runbook_version: Mapped[int] = mapped_column(Integer, nullable=False)
    executed_by: Mapped[str] = mapped_column(String(128), nullable=False)
    context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    outcome: Mapped[SessionOutcome | None] = mapped_column(
        Enum(SessionOutcome, name="session_outcome", values_callable=_enum_values)
    )
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    runbook: Mapped["Runbook"] = relationship(back_populates="sessions")
    step_records: Mapped[list["RunbookSessionStep"]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )


class RunbookSessionStep(Base):
    __tablename__ = "runbook_session_steps"

    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("runbook_sessions.id", ondelete="CASCADE"), primary_key=True
    )
    step_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("runbook_steps.id", ondelete="CASCADE"), primary_key=True
    )
    status: Mapped[SessionStepStatus] = mapped_column(
        Enum(SessionStepStatus, name="session_step_status", values_callable=_enum_values),
        nullable=False,
    )
    note: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped["RunbookSession"] = relationship(back_populates="step_records")
    step: Mapped["RunbookStep"] = relationship()
