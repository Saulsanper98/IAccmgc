"""Add missing is_legacy column to qa_feedback (006 applied before column existed)."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "007_qa_feedback_is_legacy"
down_revision: Union[str, None] = "006_validated_qa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE qa_feedback
        ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT false
        """
    )


def downgrade() -> None:
    op.drop_column("qa_feedback", "is_legacy")
