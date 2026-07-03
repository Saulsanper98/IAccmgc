from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

from app.config import Settings

logger = logging.getLogger(__name__)

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


@dataclass
class WikiPageListItem:
    id: int
    path: str
    title: str
    locale: str
    updated_at: datetime | None


@dataclass
class WikiPageDetail:
    id: int
    path: str
    hash: str
    title: str
    locale: str
    content: str
    tags: list[str]
    updated_at: datetime | None
    is_published: bool


class WikiJsClient:
    def __init__(self, settings: Settings) -> None:
        self._endpoint = settings.wikijs_url.rstrip("/") + "/graphql"
        self._headers = {
            "Authorization": f"Bearer {settings.wikijs_api_key}",
            "Content-Type": "application/json",
        }
        self._verify = settings.wikijs_ssl_verify
        self._locale = settings.wikijs_locale

    async def _graphql(self, query: str, variables: dict[str, Any] | None = None) -> dict:
        payload: dict[str, Any] = {"query": query}
        if variables:
            payload["variables"] = variables

        async with httpx.AsyncClient(timeout=120.0, verify=self._verify, headers=self._headers) as client:
            response = await client.post(self._endpoint, json=payload)
            response.raise_for_status()
            data = response.json()

        if data.get("errors"):
            raise RuntimeError(f"Wiki.js GraphQL error: {data['errors']}")
        return data["data"]

    @staticmethod
    def _parse_dt(value: str | None) -> datetime | None:
        if not value:
            return None
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    async def list_pages(self) -> list[WikiPageListItem]:
        data = await self._graphql(PAGES_LIST_QUERY)
        items: list[WikiPageListItem] = []
        for row in data["pages"]["list"]:
            if row.get("locale") != self._locale:
                continue
            items.append(
                WikiPageListItem(
                    id=row["id"],
                    path=row["path"],
                    title=row["title"],
                    locale=row["locale"],
                    updated_at=self._parse_dt(row.get("updatedAt")),
                )
            )
        return items

    async def get_page(self, page_id: int) -> WikiPageDetail | None:
        data = await self._graphql(PAGES_SINGLE_QUERY, {"id": page_id})
        row = data["pages"]["single"]
        if not row:
            return None
        if row.get("locale") != self._locale:
            return None
        if row.get("isPrivate"):
            return None
        if row.get("isPublished") is False:
            return None

        tags = [t["tag"] for t in row.get("tags") or [] if t.get("tag")]
        return WikiPageDetail(
            id=row["id"],
            path=row["path"],
            hash=row.get("hash") or "",
            title=row.get("title") or row["path"],
            locale=row["locale"],
            content=row.get("content") or "",
            tags=tags,
            updated_at=self._parse_dt(row.get("updatedAt")),
            is_published=bool(row.get("isPublished", True)),
        )
