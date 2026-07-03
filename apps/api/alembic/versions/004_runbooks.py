"""Add runbook tables."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "004_runbooks"
down_revision: Union[str, None] = "003_health"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE runbook_status AS ENUM ('draft', 'published', 'archived');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE session_outcome AS ENUM ('completed', 'aborted');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE session_step_status AS ENUM ('done', 'skipped', 'failed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        """
    )

    runbook_status = postgresql.ENUM(
        "draft", "published", "archived", name="runbook_status", create_type=False
    )
    session_outcome = postgresql.ENUM(
        "completed", "aborted", name="session_outcome", create_type=False
    )
    session_step_status = postgresql.ENUM(
        "done", "skipped", "failed", name="session_step_status", create_type=False
    )

    if "runbooks" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "runbooks",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("source_page_id", sa.UUID(), nullable=True),
            sa.Column("title", sa.String(length=512), nullable=False),
            sa.Column("description", sa.Text(), nullable=False, server_default=""),
            sa.Column("status", runbook_status, nullable=False, server_default="draft"),
            sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("created_by", sa.String(length=128), nullable=False),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["source_page_id"], ["wiki_pages.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_runbooks_status", "runbooks", ["status"])

    if "runbook_steps" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "runbook_steps",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("runbook_id", sa.UUID(), nullable=False),
            sa.Column("ordinal", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=512), nullable=False),
            sa.Column("instructions_md", sa.Text(), nullable=False, server_default=""),
            sa.Column("expected_result", sa.Text(), nullable=False, server_default=""),
            sa.Column("is_checkpoint", sa.Boolean(), nullable=False, server_default="false"),
            sa.Column("variables", postgresql.JSONB(), nullable=False, server_default="[]"),
            sa.ForeignKeyConstraint(["runbook_id"], ["runbooks.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("runbook_id", "ordinal", name="uq_runbook_step_ordinal"),
        )
        op.create_index("ix_runbook_steps_runbook_id", "runbook_steps", ["runbook_id"])

    if "runbook_sessions" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "runbook_sessions",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("runbook_id", sa.UUID(), nullable=False),
            sa.Column("runbook_version", sa.Integer(), nullable=False),
            sa.Column("executed_by", sa.String(length=128), nullable=False),
            sa.Column("context", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("outcome", session_outcome, nullable=True),
            sa.Column(
                "started_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["runbook_id"], ["runbooks.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_runbook_sessions_runbook_id", "runbook_sessions", ["runbook_id"])

    if "runbook_session_steps" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "runbook_session_steps",
            sa.Column("session_id", sa.UUID(), nullable=False),
            sa.Column("step_id", sa.UUID(), nullable=False),
            sa.Column("status", session_step_status, nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(["session_id"], ["runbook_sessions.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["step_id"], ["runbook_steps.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("session_id", "step_id"),
        )


def downgrade() -> None:
    op.drop_table("runbook_session_steps")
    op.drop_table("runbook_sessions")
    op.drop_table("runbook_steps")
    op.drop_table("runbooks")
    op.execute("DROP TYPE IF EXISTS session_step_status")
    op.execute("DROP TYPE IF EXISTS session_outcome")
    op.execute("DROP TYPE IF EXISTS runbook_status")
