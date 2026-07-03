"""Add document health tables: health_scan_jobs, staleness_findings."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "003_health"
down_revision: Union[str, None] = "002_chat"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE health_scan_status AS ENUM ('pending', 'running', 'completed', 'failed');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE finding_severity AS ENUM ('info', 'warn', 'critical');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE finding_status AS ENUM ('open', 'acknowledged', 'resolved', 'false_positive');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        """
    )

    health_scan_status = postgresql.ENUM(
        "pending", "running", "completed", "failed", name="health_scan_status", create_type=False
    )
    finding_severity = postgresql.ENUM(
        "info", "warn", "critical", name="finding_severity", create_type=False
    )
    finding_status = postgresql.ENUM(
        "open", "acknowledged", "resolved", "false_positive", name="finding_status", create_type=False
    )

    if "health_scan_jobs" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "health_scan_jobs",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("status", health_scan_status, nullable=False, server_default="pending"),
            sa.Column("stats", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("trigger", sa.String(length=32), nullable=False, server_default="manual"),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )

    if "staleness_findings" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "staleness_findings",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("page_id", sa.UUID(), nullable=False),
            sa.Column("detector", sa.String(length=64), nullable=False),
            sa.Column("severity", finding_severity, nullable=False),
            sa.Column("summary", sa.Text(), nullable=False),
            sa.Column("evidence", postgresql.JSONB(), nullable=False, server_default="{}"),
            sa.Column("evidence_hash", sa.String(length=64), nullable=False),
            sa.Column("status", finding_status, nullable=False, server_default="open"),
            sa.Column("resolved_by", sa.String(length=128), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["page_id"], ["wiki_pages.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("page_id", "detector", "evidence_hash", name="uq_finding_dedup"),
        )
        op.create_index("ix_staleness_findings_page_id", "staleness_findings", ["page_id"])
        op.create_index("ix_staleness_findings_detector", "staleness_findings", ["detector"])
        op.create_index("ix_staleness_findings_status", "staleness_findings", ["status"])
        op.create_index("ix_staleness_findings_severity", "staleness_findings", ["severity"])


def downgrade() -> None:
    op.drop_table("staleness_findings")
    op.drop_table("health_scan_jobs")
    op.execute("DROP TYPE IF EXISTS finding_status")
    op.execute("DROP TYPE IF EXISTS finding_severity")
    op.execute("DROP TYPE IF EXISTS health_scan_status")
