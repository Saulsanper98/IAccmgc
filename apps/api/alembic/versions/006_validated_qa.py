"""Add validated Q&A feedback tables for learning circuit."""

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
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE qa_feedback_rating AS ENUM ('up', 'down');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE validated_qa_status AS ENUM ('pending', 'validated', 'rejected');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    qa_rating = postgresql.ENUM("up", "down", name="qa_feedback_rating", create_type=False)
    validated_status = postgresql.ENUM(
        "pending", "validated", "rejected", name="validated_qa_status", create_type=False
    )

    op.create_table(
        "qa_feedback",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("chat_message_id", sa.UUID(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("rating", qa_rating, nullable=False),
        sa.Column("correction", sa.Text(), nullable=True),
        sa.Column(
            "is_legacy",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["chat_message_id"], ["messages.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chat_message_id", "created_by", name="uq_qa_feedback_message_user"),
    )
    op.create_index("ix_qa_feedback_chat_message_id", "qa_feedback", ["chat_message_id"])
    op.create_index("ix_qa_feedback_created_by", "qa_feedback", ["created_by"])

    op.create_table(
        "validated_qa",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("question_embedding", Vector(EMBEDDING_DIM), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column(
            "status",
            validated_status,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("source_feedback_id", sa.UUID(), nullable=True),
        sa.Column("created_by", sa.String(length=128), nullable=False),
        sa.Column("validated_by", sa.String(length=128), nullable=True),
        sa.Column(
            "valid_from",
            sa.Date(),
            server_default=sa.text("CURRENT_DATE"),
            nullable=False,
        ),
        sa.Column("valid_until", sa.Date(), nullable=True),
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
        sa.ForeignKeyConstraint(["source_feedback_id"], ["qa_feedback.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_validated_qa_status", "validated_qa", ["status"])
    op.create_index("ix_validated_qa_created_by", "validated_qa", ["created_by"])
    op.execute(
        """
        CREATE INDEX ix_validated_qa_question_embedding_hnsw
        ON validated_qa USING hnsw (question_embedding vector_cosine_ops)
        """
    )

    op.add_column(
        "messages",
        sa.Column("used_validated_qa", postgresql.JSONB(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("messages", "used_validated_qa")
    op.execute("DROP INDEX IF EXISTS ix_validated_qa_question_embedding_hnsw")
    op.drop_table("validated_qa")
    op.drop_table("qa_feedback")
    op.execute("DROP TYPE IF EXISTS validated_qa_status")
    op.execute("DROP TYPE IF EXISTS qa_feedback_rating")
