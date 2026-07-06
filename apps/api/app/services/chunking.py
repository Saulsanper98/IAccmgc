from __future__ import annotations

import re
from dataclasses import dataclass

HEADER_RE = re.compile(r"^(#{1,6})\s+(.+)$", re.MULTILINE)


@dataclass
class ChunkDraft:
    ordinal: int
    heading_path: str
    content: str
    token_count: int


def estimate_tokens(text: str) -> int:
    words = len(re.findall(r"\S+", text))
    return max(1, int(words * 1.3))


def split_markdown_sections(content: str) -> list[tuple[str, str]]:
    """Split markdown into (heading_path, body) sections."""
    if not content.strip():
        return []

    lines = content.splitlines()
    sections: list[tuple[str, str]] = []
    heading_stack: list[tuple[int, str]] = []
    current_lines: list[str] = []

    def flush() -> None:
        if not current_lines:
            return
        body = "\n".join(current_lines).strip()
        if body:
            path = " > ".join(title for _, title in heading_stack) or "Documento"
            sections.append((path, body))
        current_lines.clear()

    for line in lines:
        match = HEADER_RE.match(line)
        if match:
            flush()
            level = len(match.group(1))
            title = match.group(2).strip()
            heading_stack = [(lvl, name) for lvl, name in heading_stack if lvl < level]
            heading_stack.append((level, title))
            current_lines.append(line)
        else:
            current_lines.append(line)

    flush()
    if not sections:
        return [("Documento", content.strip())]
    return sections


def _split_by_paragraphs(text: str, max_tokens: int, overlap_tokens: int) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    if not paragraphs:
        return [text]

    chunks: list[str] = []
    current: list[str] = []
    current_tokens = 0

    def current_text() -> str:
        return "\n\n".join(current)

    for paragraph in paragraphs:
        paragraph_tokens = estimate_tokens(paragraph)
        if paragraph_tokens > max_tokens:
            if current:
                chunks.append(current_text())
                current = []
                current_tokens = 0
            sentences = re.split(r"(?<=[.!?])\s+", paragraph)
            buffer: list[str] = []
            buffer_tokens = 0
            for sentence in sentences:
                sentence_tokens = estimate_tokens(sentence)
                if buffer_tokens + sentence_tokens > max_tokens and buffer:
                    chunks.append(" ".join(buffer))
                    overlap = " ".join(buffer[-2:]) if len(buffer) > 1 else buffer[-1]
                    buffer = [overlap, sentence] if overlap_tokens > 0 else [sentence]
                    buffer_tokens = estimate_tokens(" ".join(buffer))
                else:
                    buffer.append(sentence)
                    buffer_tokens += sentence_tokens
            if buffer:
                chunks.append(" ".join(buffer))
            continue

        if current_tokens + paragraph_tokens > max_tokens and current:
            chunks.append(current_text())
            overlap_text = current_text()
            overlap_words = overlap_text.split()
            keep_words = max(1, int(overlap_tokens / 1.3))
            overlap_prefix = " ".join(overlap_words[-keep_words:]) if overlap_words else ""
            current = [overlap_prefix, paragraph] if overlap_prefix else [paragraph]
            current_tokens = estimate_tokens("\n\n".join(current))
        else:
            current.append(paragraph)
            current_tokens += paragraph_tokens

    if current:
        chunks.append(current_text())
    return chunks


def chunk_markdown(
    content: str,
    *,
    min_tokens: int = 300,
    max_tokens: int = 600,
    overlap_tokens: int = 50,
) -> list[ChunkDraft]:
    sections = split_markdown_sections(content)
    drafts: list[ChunkDraft] = []
    ordinal = 0

    for heading_path, body in sections:
        section_tokens = estimate_tokens(body)
        if section_tokens <= max_tokens:
            pieces = [body]
        else:
            pieces = _split_by_paragraphs(body, max_tokens=max_tokens, overlap_tokens=overlap_tokens)

        for piece in pieces:
            token_count = estimate_tokens(piece)
            if token_count < min_tokens // 3 and drafts:
                prev = drafts[-1]
                merged = f"{prev.content}\n\n{piece}".strip()
                drafts[-1] = ChunkDraft(
                    ordinal=prev.ordinal,
                    heading_path=prev.heading_path,
                    content=merged,
                    token_count=estimate_tokens(merged),
                )
                continue

            drafts.append(
                ChunkDraft(
                    ordinal=ordinal,
                    heading_path=heading_path,
                    content=piece.strip(),
                    token_count=token_count,
                )
            )
            ordinal += 1

    return drafts


def build_chunk_embed_input(
    *,
    page_title: str,
    page_path: str,
    tags: list[str],
    heading_path: str,
    content: str,
) -> str:
    """Text fed to the embedding model (richer than stored chunk content)."""
    lines = [f"Página: {page_title}", f"Ruta: {page_path}"]
    if tags:
        lines.append(f"Tags: {', '.join(tags)}")
    lines.extend(["", heading_path, "", content])
    return "\n".join(lines)
