#!/usr/bin/env python3
"""Carga manuales de ejemplo en la BD local (sin Wiki.js).

Uso:
    python scripts/seed_local_manuals.py
    python scripts/seed_local_manuals.py --clear   # borra datos previos de seed
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import sys
from datetime import UTC, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "manuals"
sys.path.insert(0, str(PROJECT_ROOT / "apps" / "api"))

from dotenv import load_dotenv

load_dotenv(PROJECT_ROOT / ".env")

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings
from app.db.models import Chunk, WikiPage
from app.services.chunking import chunk_markdown
from app.services.ollama import OllamaClient

# wikijs_page_id negativos para distinguir páginas seed de las reales
MANUALS: list[dict] = [
    {
        "wikijs_page_id": -1,
        "path": "sistemas/procedimientos/backup-servidores",
        "title": "Procedimiento de backup de servidores",
        "tags": ["procedimiento", "backup", "sistemas"],
        "file": "backup-servidores.md",
    },
    {
        "wikijs_page_id": -2,
        "path": "sistemas/referencias/configuracion-red",
        "title": "Configuración de red interna",
        "tags": ["referencia", "red", "dns", "dhcp"],
        "file": "configuracion-red.md",
    },
    {
        "wikijs_page_id": -3,
        "path": "sistemas/guias/acceso-vpn",
        "title": "Guía de acceso VPN",
        "tags": ["guia", "vpn", "acceso-remoto"],
        "file": "acceso-vpn.md",
    },
    {
        "wikijs_page_id": -4,
        "path": "sistemas/runbooks/reinicio-servicios",
        "title": "Runbook: Reinicio de servicios críticos",
        "tags": ["runbook", "procedimiento", "incidentes"],
        "file": "runbook-reinicio-servicios.md",
    },
]

SEED_IDS = {m["wikijs_page_id"] for m in MANUALS}


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


async def upsert_manual(
    session: AsyncSession,
    ollama: OllamaClient,
    settings,
    manual: dict,
) -> tuple[int, int]:
    """Inserta o actualiza una página manual. Retorna (chunks_creados, tokens_aprox)."""
    file_path = FIXTURES_DIR / manual["file"]
    if not file_path.exists():
        raise FileNotFoundError(f"Fixture no encontrado: {file_path}")

    content = file_path.read_text(encoding="utf-8")
    now = datetime.now(UTC)
    page_hash = content_hash(content)

    result = await session.execute(
        select(WikiPage).where(WikiPage.wikijs_page_id == manual["wikijs_page_id"])
    )
    page = result.scalar_one_or_none()

    if page and page.content_hash == page_hash and not page.is_deleted:
        print(f"  ⏭  {manual['title']} — sin cambios")
        return 0, 0

    if not page:
        page = WikiPage(wikijs_page_id=manual["wikijs_page_id"])
        session.add(page)

    page.path = manual["path"]
    page.title = manual["title"]
    page.locale = settings.wikijs_locale
    page.tags = manual["tags"]
    page.content_raw = content
    page.content_hash = page_hash
    page.wiki_updated_at = now
    page.last_synced_at = now
    page.is_deleted = False

    await session.flush()
    await session.execute(delete(Chunk).where(Chunk.page_id == page.id))

    drafts = chunk_markdown(
        content,
        min_tokens=settings.chunk_min_tokens,
        max_tokens=settings.chunk_max_tokens,
        overlap_tokens=settings.chunk_overlap_tokens,
    )

    chunks_created = 0
    total_tokens = 0
    for draft in drafts:
        embed_input = f"{draft.heading_path}\n\n{draft.content}"
        embedding = await ollama.embed_text(embed_input)
        chunk = Chunk(
            page_id=page.id,
            ordinal=draft.ordinal,
            heading_path=draft.heading_path,
            content=draft.content,
            token_count=draft.token_count,
            embedding=embedding,
            embedding_model=settings.embedding_model,
        )
        session.add(chunk)
        chunks_created += 1
        total_tokens += draft.token_count

    print(f"  ✓  {manual['title']} — {chunks_created} chunks")
    return chunks_created, total_tokens


async def clear_seed_pages(session: AsyncSession) -> int:
    result = await session.execute(
        select(WikiPage).where(WikiPage.wikijs_page_id.in_(SEED_IDS))
    )
    pages = list(result.scalars())
    for page in pages:
        await session.execute(delete(Chunk).where(Chunk.page_id == page.id))
        await session.delete(page)
    return len(pages)


async def main(clear: bool) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    ollama = OllamaClient(settings)

    print(f"Conectando a {settings.database_url.split('@')[-1]}")
    print(f"Ollama: {settings.ollama_base_url} (modelo: {settings.embedding_model})")
    print(f"Manuales en {FIXTURES_DIR}\n")

    async with session_factory() as session:
        if clear:
            removed = await clear_seed_pages(session)
            await session.commit()
            print(f"Eliminadas {removed} páginas seed previas.\n")

        total_chunks = 0
        for manual in MANUALS:
            chunks, _ = await upsert_manual(session, ollama, settings, manual)
            total_chunks += chunks

        await session.commit()

    await engine.dispose()
    print(f"\nListo: {len(MANUALS)} manuales, {total_chunks} chunks con embeddings.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cargar manuales de ejemplo sin Wiki.js")
    parser.add_argument("--clear", action="store_true", help="Eliminar páginas seed antes de cargar")
    args = parser.parse_args()
    asyncio.run(main(clear=args.clear))
