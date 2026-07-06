from __future__ import annotations

import re
from dataclasses import dataclass

DIARY_BLOCK_PATTERN = re.compile(r"\b(diario|bitácora|bitacora)\b", re.IGNORECASE)


@dataclass(frozen=True)
class WikiSection:
    path_prefix: str
    label: str
    patterns: tuple[re.Pattern[str], ...]


WIKI_SECTIONS: tuple[WikiSection, ...] = (
    WikiSection(
        path_prefix="sistemas/vmware",
        label="Virtualización VMware vSphere",
        patterns=(
            re.compile(r"\bvmware\b", re.IGNORECASE),
            re.compile(r"\bvsphere\b", re.IGNORECASE),
            re.compile(r"\besxi\b", re.IGNORECASE),
            re.compile(r"\bvirtualiz", re.IGNORECASE),
        ),
    ),
    WikiSection(
        path_prefix="sistemas/almacenamiento",
        label="Almacenamiento e Infraestructura",
        patterns=(
            re.compile(r"\balmacenamiento\b", re.IGNORECASE),
            re.compile(r"\bqnap\b", re.IGNORECASE),
            re.compile(r"\bsynology\b", re.IGNORECASE),
            re.compile(r"\bnas\b", re.IGNORECASE),
            re.compile(r"\bdm5100", re.IGNORECASE),
            re.compile(r"\bde6400", re.IGNORECASE),
            re.compile(r"\bnetapp\b", re.IGNORECASE),
            re.compile(r"\bontap\b", re.IGNORECASE),
            re.compile(r"\bsan\b", re.IGNORECASE),
            re.compile(r"\bcabina", re.IGNORECASE),
        ),
    ),
    WikiSection(
        path_prefix="sistemas/redes",
        label="Redes y Conectividad FC",
        patterns=(
            re.compile(r"\bredes\b", re.IGNORECASE),
            re.compile(r"\bconectividad\b", re.IGNORECASE),
            re.compile(r"\bfibre\s*channel\b", re.IGNORECASE),
            re.compile(r"\bfc\b", re.IGNORECASE),
            re.compile(r"\bswitch(?:es)?\b", re.IGNORECASE),
            re.compile(r"\bvlan\b", re.IGNORECASE),
            re.compile(r"\bfirewall\b", re.IGNORECASE),
        ),
    ),
    WikiSection(
        path_prefix="sistemas/salas",
        label="Salas y Puestos Especiales",
        patterns=(
            re.compile(r"\bsalas\b", re.IGNORECASE),
            re.compile(r"\bpuestos?\s+especiales?\b", re.IGNORECASE),
            re.compile(r"\bsala\s+de\s+", re.IGNORECASE),
        ),
    ),
)


def parse_wiki_section_query(query: str) -> WikiSection | None:
    """Detect wiki subtree from keywords (e.g. vmware → sistemas/vmware)."""
    if DIARY_BLOCK_PATTERN.search(query):
        return None

    best: WikiSection | None = None
    best_score = 0
    for section in WIKI_SECTIONS:
        score = sum(1 for pattern in section.patterns if pattern.search(query))
        if score > best_score:
            best_score = score
            best = section

    return best if best_score > 0 else None
