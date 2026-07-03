import time
from dataclasses import dataclass, field
from enum import StrEnum

import httpx
import redis.asyncio as aioredis
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings


class HealthStatus(StrEnum):
    OK = "ok"
    DEGRADED = "degraded"
    DOWN = "down"


@dataclass
class ComponentHealth:
    name: str
    status: HealthStatus
    latency_ms: float | None = None
    message: str | None = None
    details: dict = field(default_factory=dict)


@dataclass
class HealthReport:
    status: HealthStatus
    components: list[ComponentHealth]
    version: str = "0.1.0"

    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "version": self.version,
            "components": [
                {
                    "name": c.name,
                    "status": c.status.value,
                    "latency_ms": c.latency_ms,
                    "message": c.message,
                    "details": c.details,
                }
                for c in self.components
            ],
        }


async def check_database(session: AsyncSession) -> ComponentHealth:
    start = time.perf_counter()
    try:
        result = await session.execute(text("SELECT 1"))
        value = result.scalar_one()
        latency = (time.perf_counter() - start) * 1000
        if value == 1:
            return ComponentHealth(name="database", status=HealthStatus.OK, latency_ms=round(latency, 2))
        return ComponentHealth(
            name="database",
            status=HealthStatus.DOWN,
            latency_ms=round(latency, 2),
            message="Unexpected query result",
        )
    except Exception as exc:
        latency = (time.perf_counter() - start) * 1000
        return ComponentHealth(
            name="database",
            status=HealthStatus.DOWN,
            latency_ms=round(latency, 2),
            message=str(exc),
        )


async def check_redis(redis_url: str) -> ComponentHealth:
    start = time.perf_counter()
    client = aioredis.from_url(redis_url, decode_responses=True)
    try:
        pong = await client.ping()
        latency = (time.perf_counter() - start) * 1000
        if pong:
            return ComponentHealth(name="redis", status=HealthStatus.OK, latency_ms=round(latency, 2))
        return ComponentHealth(
            name="redis",
            status=HealthStatus.DOWN,
            latency_ms=round(latency, 2),
            message="Ping returned falsy response",
        )
    except Exception as exc:
        latency = (time.perf_counter() - start) * 1000
        return ComponentHealth(
            name="redis",
            status=HealthStatus.DOWN,
            latency_ms=round(latency, 2),
            message=str(exc),
        )
    finally:
        await client.aclose()


async def check_ollama(base_url: str, chat_model: str, embedding_model: str) -> ComponentHealth:
    start = time.perf_counter()
    url = base_url.rstrip("/") + "/api/tags"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url)
            latency = (time.perf_counter() - start) * 1000
            if response.status_code != 200:
                return ComponentHealth(
                    name="ollama",
                    status=HealthStatus.DOWN,
                    latency_ms=round(latency, 2),
                    message=f"HTTP {response.status_code}",
                )

            data = response.json()
            models = {m.get("name", "").split(":")[0] for m in data.get("models", [])}
            chat_base = chat_model.split(":")[0]
            embed_base = embedding_model.split(":")[0]

            missing = []
            if chat_base not in models and chat_model not in {m.get("name") for m in data.get("models", [])}:
                missing.append(chat_model)
            if embed_base not in models and embedding_model not in {m.get("name") for m in data.get("models", [])}:
                missing.append(embedding_model)

            if missing:
                return ComponentHealth(
                    name="ollama",
                    status=HealthStatus.DEGRADED,
                    latency_ms=round(latency, 2),
                    message="Ollama reachable but required models missing",
                    details={"missing_models": missing, "available_models": list(data.get("models", []))},
                )

            return ComponentHealth(
                name="ollama",
                status=HealthStatus.OK,
                latency_ms=round(latency, 2),
                details={"chat_model": chat_model, "embedding_model": embedding_model},
            )
    except Exception as exc:
        latency = (time.perf_counter() - start) * 1000
        return ComponentHealth(
            name="ollama",
            status=HealthStatus.DOWN,
            latency_ms=round(latency, 2),
            message=str(exc),
        )


def aggregate_status(components: list[ComponentHealth]) -> HealthStatus:
    if any(c.status == HealthStatus.DOWN for c in components):
        return HealthStatus.DEGRADED
    if any(c.status == HealthStatus.DEGRADED for c in components):
        return HealthStatus.DEGRADED
    return HealthStatus.OK


async def run_health_checks(session: AsyncSession, settings: Settings) -> HealthReport:
    db_health = await check_database(session)
    redis_health = await check_redis(settings.redis_url)
    ollama_health = await check_ollama(
        settings.ollama_base_url,
        settings.chat_model,
        settings.embedding_model,
    )

    components = [db_health, redis_health, ollama_health]
    return HealthReport(status=aggregate_status(components), components=components)
