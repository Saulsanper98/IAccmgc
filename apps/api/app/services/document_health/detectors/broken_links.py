from __future__ import annotations

import re
from urllib.parse import urlparse

import httpx

from app.config import Settings
from app.db.models import FindingSeverity, WikiPage
from app.services.document_health.base import DetectorContext, DetectorFinding

WIKI_LINK_RE = re.compile(r"\[([^\]]*)\]\(([^)]+)\)")
RAW_URL_RE = re.compile(r"https?://[^\s\])<>\"']+", re.IGNORECASE)


class BrokenLinksDetector:
    name = "broken_links"

    async def run(self, page: WikiPage, context: DetectorContext) -> list[DetectorFinding]:
        settings: Settings = context.settings  # type: ignore[assignment]
        findings: list[DetectorFinding] = []

        for match in WIKI_LINK_RE.finditer(page.content_raw):
            target = match.group(2).strip()
            if target.startswith("http://") or target.startswith("https://"):
                finding = await _check_http_link(target, settings)
                if finding:
                    findings.append(
                        DetectorFinding(
                            detector=self.name,
                            severity=finding["severity"],
                            summary=f"Enlace externo no accesible: {target}",
                            evidence={"url": target, **finding},
                        )
                    )
                continue

            normalized = _normalize_wiki_path(target)
            if normalized and normalized not in context.paths_set:
                findings.append(
                    DetectorFinding(
                        detector=self.name,
                        severity=FindingSeverity.WARN,
                        summary=f"Enlace interno roto: {target}",
                        evidence={"link": target, "normalized_path": normalized},
                    )
                )

        for url in RAW_URL_RE.findall(page.content_raw):
            finding = await _check_http_link(url.rstrip(".,;"), settings)
            if finding:
                findings.append(
                    DetectorFinding(
                        detector=self.name,
                        severity=finding["severity"],
                        summary=f"URL interna no accesible: {url}",
                        evidence={"url": url, **finding},
                    )
                )

        return findings


def _normalize_wiki_path(path: str) -> str:
    path = path.strip().lstrip("/")
    if path.startswith("es/"):
        path = path[3:]
    return path


def _host_allowed(host: str, whitelist: str) -> bool:
    if not whitelist.strip():
        return False
    host = host.lower()
    for entry in whitelist.split(","):
        entry = entry.strip().lower()
        if not entry:
            continue
        if entry.startswith("*."):
            if host.endswith(entry[1:]) or host == entry[2:]:
                return True
        elif "/" in entry:
            # CIDR not fully implemented — allow private ranges by prefix match
            prefix = entry.split("/")[0]
            if host.startswith(prefix.rsplit(".", 1)[0]):
                return True
        elif host == entry or host.endswith("." + entry):
            return True
    return False


async def _check_http_link(url: str, settings: Settings) -> dict | None:
    try:
        parsed = urlparse(url)
    except Exception:
        return None
    if not parsed.hostname:
        return None
    if not _host_allowed(parsed.hostname, settings.internal_host_whitelist):
        return None

    try:
        async with httpx.AsyncClient(timeout=8.0, verify=settings.wikijs_ssl_verify) as client:
            response = await client.head(url, follow_redirects=True)
            if response.status_code >= 400:
                return {"http_status": response.status_code, "severity": FindingSeverity.WARN}
    except Exception as exc:
        return {"error": str(exc), "severity": FindingSeverity.WARN}
    return None
