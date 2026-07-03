from __future__ import annotations

from app.db.models import FindingSeverity, WikiPage
from app.services.document_health.base import DetectorContext, DetectorFinding


class OrphanDetector:
    name = "orphan"

    async def run(self, page: WikiPage, context: DetectorContext) -> list[DetectorFinding]:
        inbound = context.inbound_links.get(page.path, 0)
        if inbound > 0:
            return []

        # Home-like pages are expected to have no inbound links
        if page.path in ("", "home", "inicio", "es/home", "es/inicio"):
            return []

        return [
            DetectorFinding(
                detector=self.name,
                severity=FindingSeverity.INFO,
                summary="Página huérfana: ninguna otra página enlaza aquí",
                evidence={"path": page.path, "inbound_links": 0},
            )
        ]
