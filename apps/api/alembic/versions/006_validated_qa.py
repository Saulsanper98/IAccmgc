"""Add validated Q&A learning tables and feedback correction column."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

revision: str = "006_validated_qa"
down_revision: Union[str, None] = "005_chat_instructions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 1024


def upgrade() -> None:
    op.add_column("feedback", sa.Column("correction", sa.Text(), nullable=True))

    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE validated_qa_status AS ENUM ('pending', 'validated', 'rejected');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    validated_qa_status = postgresql.ENUM(
        "pending",
        "validated",
        "rejected",
        name="validated_qa_status",
        create_type=False,
    )

    op.create_table(
        "validated_qa",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("question_embedding", Vector(EMBEDDING_DIM), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column(
            "status",
            validated_qa_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("source_feedback_id", sa.UUID(), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column("validated_by", sa.String(length=128), nullable=True),
        sa.Column(
            "valid_from",
            sa.Date(),
            nullable=False,
            server_default=sa.text("CURRENT_DATE"),
        ),
        sa.Column("notes", sa.Text(), nullable=True),
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
        sa.ForeignKeyConstraint(["source_feedback_id"], ["feedback.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_validated_qa_status", "validated_qa", ["status"])
    op.create_index("ix_validated_qa_source_feedback_id", "validated_qa", ["source_feedback_id"])
    op.execute(
        """
        CREATE INDEX ix_validated_qa_question_embedding_hnsw
        ON validated_qa USING hnsw (question_embedding vector_cosine_ops)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_validated_qa_question_embedding_hnsw")
    op.drop_table("validated_qa")
    op.execute("DROP TYPE IF EXISTS validated_qa_status")
    op.drop_column("feedback", "correction")
