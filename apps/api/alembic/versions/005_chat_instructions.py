"""Add chat instruction tables for user and team memory."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "005_chat_instructions"
down_revision: Union[str, None] = "004_runbooks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TEAM_ROW_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    op.create_table(
        "user_chat_instructions",
        sa.Column("user_id", sa.String(length=128), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_table(
        "team_chat_instructions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False, server_default=""),
        sa.Column("updated_by", sa.String(length=128), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.execute(
        sa.text(
            "INSERT INTO team_chat_instructions (id, content) "
            f"VALUES ('{TEAM_ROW_ID}'::uuid, '')"
        )
    )


def downgrade() -> None:
    op.drop_table("team_chat_instructions")
    op.drop_table("user_chat_instructions")
