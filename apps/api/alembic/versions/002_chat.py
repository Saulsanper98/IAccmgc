"""Add chat tables: conversations, messages, feedback."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "002_chat"
down_revision: Union[str, None] = "001_initial_ingest"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    message_role = postgresql.ENUM(
        "user", "assistant", "system", name="message_role", create_type=False
    )

    if "conversations" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "conversations",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.String(length=128), nullable=False),
            sa.Column("title", sa.String(length=256), nullable=False, server_default="Nueva conversación"),
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
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_conversations_user_id", "conversations", ["user_id"])
        op.create_index("ix_conversations_updated_at", "conversations", ["updated_at"])

    if "messages" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "messages",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("conversation_id", sa.UUID(), nullable=False),
            sa.Column("role", message_role, nullable=False),
            sa.Column("content", sa.Text(), nullable=False, server_default=""),
            sa.Column(
                "cited_chunk_ids",
                postgresql.ARRAY(sa.UUID()),
                nullable=False,
                server_default="{}",
            ),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("model", sa.String(length=128), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["conversation_id"], ["conversations.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_messages_conversation_id", "messages", ["conversation_id"])

    if "feedback" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "feedback",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("message_id", sa.UUID(), nullable=False),
            sa.Column("user_id", sa.String(length=128), nullable=False),
            sa.Column("rating", sa.SmallInteger(), nullable=False),
            sa.Column("comment", sa.Text(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["message_id"], ["messages.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("message_id", "user_id", name="uq_feedback_message_user"),
        )
        op.create_index("ix_feedback_message_id", "feedback", ["message_id"])


def downgrade() -> None:
    op.drop_table("feedback")
    op.drop_table("messages")
    op.drop_table("conversations")
    op.execute("DROP TYPE IF EXISTS message_role")
