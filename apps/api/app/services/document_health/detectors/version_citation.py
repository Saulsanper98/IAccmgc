from __future__ import annotations

import re

from app.db.models import FindingSeverity, WikiPage
from app.services.document_health.base import DetectorContext, DetectorFinding

VERSION_PATTERNS = [
    re.compile(
        r"\b([A-Za-z][\w.-]{1,40})\s+(?:v(?:ersión|ersion)?\.?\s*)?(\d+\.\d+(?:\.\d+)?(?:[a-z0-9-]*)?)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(Windows|Ubuntu|Debian|CentOS|RHEL|PostgreSQL|MySQL|MariaDB|Docker|Kubernetes|"
        r"Ollama|Wiki\.js|GLPI|Active\s*Directory|Exchange|VMware|Hyper-V)\s+(\d+(?:\.\d+)+)\b",
        re.IGNORECASE,
    ),
]


class VersionCitationDetector:
    name = "version_citation"

    async def run(self, page: WikiPage, context: DetectorContext) -> list[DetectorFinding]:
        findings: list[DetectorFinding] = []
        seen: set[tuple[str, str]] = set()

        for pattern in VERSION_PATTERNS:
            for match in pattern.finditer(page.content_raw):
                product = match.group(1).strip()
                version = match.group(2).strip()
                key = (product.lower(), version)
                if key in seen:
                    continue
                seen.add(key)
                findings.append(
                    DetectorFinding(
                        detector=self.name,
                        severity=FindingSeverity.INFO,
                        summary=f"Mención de versión: {product} {version} — requiere verificación",
                        evidence={
                            "product": product,
                            "version": version,
                            "snippet": _snippet(page.content_raw, match.start(), match.end()),
                        },
                    )
                )

        return findings


def _snippet(text: str, start: int, end: int, radius: int = 60) -> str:
    lo = max(0, start - radius)
    hi = min(len(text), end + radius)
    return text[lo:hi].replace("\n", " ").strip()
