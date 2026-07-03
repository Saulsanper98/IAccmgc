#!/usr/bin/env python3
"""Explore Wiki.js GraphQL API against the configured instance."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

import httpx
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DOCS_OUTPUT = PROJECT_ROOT / "docs" / "wikijs-api.md"


def load_config() -> tuple[str, str, bool]:
    load_dotenv(PROJECT_ROOT / ".env")
    base_url = os.environ.get("WIKIJS_URL", "").rstrip("/")
    api_key = os.environ.get("WIKIJS_API_KEY", "")
    ssl_verify = os.environ.get("WIKIJS_SSL_VERIFY", "false").lower() in {"1", "true", "yes"}
    if not base_url or not api_key:
        raise SystemExit("WIKIJS_URL and WIKIJS_API_KEY must be set in .env")
    return base_url, api_key, ssl_verify


def graphql(
    client: httpx.Client,
    endpoint: str,
    query: str,
    variables: dict | None = None,
) -> dict:
    payload: dict = {"query": query}
    if variables:
        payload["variables"] = variables
    response = client.post(endpoint, json=payload)
    response.raise_for_status()
    data = response.json()
    if data.get("errors"):
        raise RuntimeError(json.dumps(data["errors"], ensure_ascii=False, indent=2))
    return data


TYPE_INTROSPECTION = """
query TypeFields($name: String!) {
  type: __type(name: $name) {
    name
    fields {
      name
      args { name type { name kind ofType { name kind } } }
      type { name kind ofType { name kind ofType { name kind } } }
    }
  }
}
"""

PAGES_LIST_QUERY = """
{
  pages {
    list {
      id
      path
      title
      locale
      updatedAt
    }
  }
}
"""

PAGES_SINGLE_QUERY = """
query PageSingle($id: Int!) {
  pages {
    single(id: $id) {
      id
      path
      hash
      title
      description
      isPrivate
      isPublished
      createdAt
      updatedAt
      locale
      contentType
      content
      tags { tag }
      authorName
    }
  }
}
"""


def explore(client: httpx.Client, endpoint: str) -> dict:
    root = graphql(client, endpoint, "{ __schema { queryType { fields { name } } } }")
    query_fields = [f["name"] for f in root["data"]["__schema"]["queryType"]["fields"]]

    type_names = ["PageQuery", "PageListItem", "Page"]
    types: dict[str, dict] = {}
    for type_name in type_names:
        try:
            result = graphql(client, endpoint, TYPE_INTROSPECTION, {"name": type_name})
            types[type_name] = result["data"]["type"]
        except RuntimeError as exc:
            types[type_name] = {"error": str(exc)}

    list_result = graphql(client, endpoint, PAGES_LIST_QUERY)
    pages = list_result["data"]["pages"]["list"]
    es_pages = [p for p in pages if p.get("locale") == "es"]

    sample_single = None
    if pages:
        sample_id = pages[0]["id"]
        single_result = graphql(client, endpoint, PAGES_SINGLE_QUERY, {"id": sample_id})
        sample_single = single_result["data"]["pages"]["single"]
        if sample_single and sample_single.get("content"):
            content = sample_single["content"]
            sample_single = {**sample_single, "content_preview": content[:400], "content_length": len(content)}
            sample_single.pop("content", None)

    return {
        "explored_at": datetime.now(UTC).isoformat(),
        "endpoint": endpoint,
        "query_root_fields": query_fields,
        "types": types,
        "stats": {
            "total_pages": len(pages),
            "es_pages": len(es_pages),
            "locales": sorted({p.get("locale") for p in pages}),
        },
        "pages_list_sample": pages[:5],
        "pages_single_sample": sample_single,
    }


def render_markdown(report: dict, base_url: str) -> str:
    lines = [
        "# Wiki.js API — Instancia CCMGC",
        "",
        f"> Generado automáticamente el {report['explored_at']}",
        f"> Instancia: `{base_url}`",
        "",
        "## Endpoint",
        "",
        f"- **GraphQL:** `{report['endpoint']}`",
        "- **Autenticación:** `Authorization: Bearer <WIKIJS_API_KEY>`",
        "- **SSL:** certificado interno; usar `WIKIJS_SSL_VERIFY=false` en desarrollo si aplica",
        "",
        "## Campos raíz disponibles",
        "",
    ]
    for field in report["query_root_fields"]:
        lines.append(f"- `{field}`")

    lines.extend(
        [
            "",
            "## Estadísticas de páginas",
            "",
            f"- Total páginas listadas: **{report['stats']['total_pages']}**",
            f"- Páginas en español (`es`): **{report['stats']['es_pages']}**",
            f"- Locales detectados: `{', '.join(report['stats']['locales'])}`",
            "",
            "## Tipo `PageQuery`",
            "",
            "```json",
            json.dumps(report["types"].get("PageQuery"), indent=2, ensure_ascii=False),
            "```",
            "",
            "## Tipo `PageListItem` (pages.list)",
            "",
            "```json",
            json.dumps(report["types"].get("PageListItem"), indent=2, ensure_ascii=False),
            "```",
            "",
            "## Tipo `Page` (pages.single)",
            "",
            "```json",
            json.dumps(report["types"].get("Page"), indent=2, ensure_ascii=False),
            "```",
            "",
            "## Muestra `pages.list`",
            "",
            "```json",
            json.dumps(report["pages_list_sample"], indent=2, ensure_ascii=False),
            "```",
            "",
            "## Muestra `pages.single`",
            "",
            "```json",
            json.dumps(report["pages_single_sample"], indent=2, ensure_ascii=False),
            "```",
            "",
            "## Queries usadas por WikiBridge",
            "",
            "### Listado completo",
            "",
            "```graphql",
            PAGES_LIST_QUERY.strip(),
            "```",
            "",
            "### Página individual",
            "",
            "```graphql",
            PAGES_SINGLE_QUERY.strip(),
            "```",
            "",
            "## Notas de implementación",
            "",
            "- La ingesta filtra por `locale = \"es\"` según configuración del proyecto.",
            "- Sync incremental compara `updatedAt` y `hash` de Wiki.js con `content_hash` local.",
            "- Páginas ausentes en listados posteriores se marcan `is_deleted = true`.",
            "- Deep-link a wiki: `{WIKIJS_URL}/{path}`",
            "",
        ]
    )
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Explore Wiki.js GraphQL schema")
    parser.add_argument("--write-docs", action="store_true", help="Write docs/wikijs-api.md")
    parser.add_argument("--json", action="store_true", help="Print JSON report to stdout")
    args = parser.parse_args()

    base_url, api_key, ssl_verify = load_config()
    endpoint = f"{base_url}/graphql"
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}

    with httpx.Client(timeout=60.0, verify=ssl_verify, headers=headers) as client:
        report = explore(client, endpoint)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))

    markdown = render_markdown(report, base_url)
    if args.write_docs:
        DOCS_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        DOCS_OUTPUT.write_text(markdown, encoding="utf-8")
        print(f"Wrote {DOCS_OUTPUT}", file=sys.stderr)
    elif not args.json:
        print(markdown)

    print(
        f"\nOK: {report['stats']['total_pages']} pages, {report['stats']['es_pages']} in Spanish",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
