from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from typing import Protocol

from app.db.models import FindingSeverity, WikiPage


@dataclass(frozen=True)
class DetectorFinding:
    detector: str
    severity: FindingSeverity
    summary: str
    evidence: dict

    def evidence_hash(self) -> str:
        payload = json.dumps(self.evidence, sort_keys=True, ensure_ascii=False, default=str)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


class Detector(Protocol):
    name: str

    async def run(self, page: WikiPage, context: "DetectorContext") -> list[DetectorFinding]: ...


@dataclass
class DetectorContext:
    all_pages: list[WikiPage]
    paths_by_id: dict[int, str]
    paths_set: set[str]
    inbound_links: dict[str, int]
    settings: object
    ollama: object | None = None
