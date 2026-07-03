"""Create initial schema with pgvector and full-text search support."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy import inspect
from sqlalchemy.dialects import postgresql

revision: str = "001_initial_ingest"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

EMBEDDING_DIM = 1024


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE ingest_job_type AS ENUM ('full', 'incremental');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE ingest_job_status AS ENUM ('pending', 'running', 'completed', 'failed');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    ingest_job_type = postgresql.ENUM(
        "full", "incremental", name="ingest_job_type", create_type=False
    )
    ingest_job_status = postgresql.ENUM(
        "pending",
        "running",
        "completed",
        "failed",
        name="ingest_job_status",
        create_type=False,
    )

    if "wiki_pages" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "wiki_pages",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("wikijs_page_id", sa.Integer(), nullable=False),
            sa.Column("path", sa.String(length=512), nullable=False),
            sa.Column("title", sa.String(length=512), nullable=False),
            sa.Column("locale", sa.String(length=16), nullable=False),
            sa.Column("tags", sa.ARRAY(sa.String()), nullable=False),
            sa.Column("content_raw", sa.Text(), nullable=False),
            sa.Column("content_hash", sa.String(length=128), nullable=False),
            sa.Column("wiki_updated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("wikijs_page_id"),
        )
        op.create_index("ix_wiki_pages_path", "wiki_pages", ["path"])
        op.create_index("ix_wiki_pages_wikijs_page_id", "wiki_pages", ["wikijs_page_id"])

    if "chunks" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "chunks",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("page_id", sa.UUID(), nullable=False),
            sa.Column("ordinal", sa.Integer(), nullable=False),
            sa.Column("heading_path", sa.String(length=1024), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("token_count", sa.Integer(), nullable=False),
            sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
            sa.Column("embedding_model", sa.String(length=128), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
            sa.ForeignKeyConstraint(["page_id"], ["wiki_pages.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("page_id", "ordinal", name="uq_chunk_page_ordinal"),
        )
        op.create_index("ix_chunks_page_id", "chunks", ["page_id"])
        op.execute(
            """
            ALTER TABLE chunks
            ADD COLUMN tsv tsvector
            GENERATED ALWAYS AS (to_tsvector('spanish', content)) STORED
            """
        )
        op.execute("CREATE INDEX ix_chunks_tsv ON chunks USING GIN (tsv)")
        op.execute(
            """
            CREATE INDEX ix_chunks_embedding_hnsw
            ON chunks USING hnsw (embedding vector_cosine_ops)
            """
        )

    if "ingest_jobs" not in inspect(op.get_bind()).get_table_names():
        op.create_table(
            "ingest_jobs",
            sa.Column("id", sa.UUID(), nullable=False),
            sa.Column("type", ingest_job_type, nullable=False),
            sa.Column("status", ingest_job_status, nullable=False),
            sa.Column("stats", sa.dialects.postgresql.JSONB(), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("error", sa.Text(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
        )


def downgrade() -> None:
    op.drop_table("ingest_jobs")
    op.drop_table("chunks")
    op.drop_table("wiki_pages")
    op.execute("DROP TYPE IF EXISTS ingest_job_status")
    op.execute("DROP TYPE IF EXISTS ingest_job_type")
