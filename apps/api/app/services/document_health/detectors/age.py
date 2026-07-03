from __future__ import annotations

import re
from datetime import UTC, datetime

from app.config import Settings
from app.db.models import FindingSeverity, WikiPage
from app.services.document_health.base import DetectorContext, DetectorFinding

PROCEDURE_HINTS = ("procedimiento", "runbook", "manual", "guia", "guía", "paso", "checklist")


class AgeDetector:
    name = "age"

    async def run(self, page: WikiPage, context: DetectorContext) -> list[DetectorFinding]:
        settings: Settings = context.settings  # type: ignore[assignment]
        if not page.wiki_updated_at:
            return []

        updated = page.wiki_updated_at
        if updated.tzinfo is None:
            updated = updated.replace(tzinfo=UTC)

        age_days = (datetime.now(UTC) - updated).days
        is_procedure = _is_procedure_page(page)
        threshold = (
            settings.staleness_procedure_days if is_procedure else settings.staleness_reference_days
        )

        if age_days <= threshold:
            return []

        severity = FindingSeverity.WARN if age_days < threshold * 1.5 else FindingSeverity.CRITICAL
        kind = "procedimiento" if is_procedure else "referencia"
        return [
            DetectorFinding(
                detector=self.name,
                severity=severity,
                summary=f"Página sin editar en {age_days} días (umbral {kind}: {threshold} días)",
                evidence={
                    "age_days": age_days,
                    "threshold_days": threshold,
                    "wiki_updated_at": page.wiki_updated_at.isoformat(),
                    "page_kind": kind,
                },
            )
        ]


def _is_procedure_page(page: WikiPage) -> bool:
    haystack = " ".join(
        [page.path.lower(), page.title.lower(), " ".join(t.lower() for t in page.tags)]
    )
    return any(hint in haystack for hint in PROCEDURE_HINTS)
