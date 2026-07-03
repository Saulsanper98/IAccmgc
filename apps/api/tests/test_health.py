import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.health import (
    HealthStatus,
    aggregate_status,
    check_database,
    check_ollama,
    check_redis,
)


@pytest.mark.asyncio
async def test_check_database_ok():
    session = AsyncMock()
    result = MagicMock()
    result.scalar_one.return_value = 1
    session.execute.return_value = result

    health = await check_database(session)
    assert health.status == HealthStatus.OK
    assert health.name == "database"


@pytest.mark.asyncio
async def test_check_database_down_on_error():
    session = AsyncMock()
    session.execute.side_effect = Exception("connection refused")

    health = await check_database(session)
    assert health.status == HealthStatus.DOWN
    assert "connection refused" in (health.message or "")


@pytest.mark.asyncio
async def test_check_redis_ok():
    with patch("app.services.health.aioredis") as mock_redis_module:
        mock_client = AsyncMock()
        mock_client.ping.return_value = True
        mock_redis_module.from_url.return_value = mock_client

        health = await check_redis("redis://localhost:6379/0")
        assert health.status == HealthStatus.OK
        mock_client.aclose.assert_called_once()


@pytest.mark.asyncio
async def test_check_ollama_missing_models():
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"models": [{"name": "other:7b"}]}

    with patch("app.services.health.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__.return_value = mock_client
        mock_client.get.return_value = mock_response
        mock_client_cls.return_value = mock_client

        health = await check_ollama(
            "http://localhost:11434",
            "qwen2.5:7b-instruct",
            "bge-m3",
        )
        assert health.status == HealthStatus.DEGRADED
        assert "missing_models" in health.details


def test_aggregate_status_degraded_if_any_down():
    from app.services.health import ComponentHealth

    components = [
        ComponentHealth("database", HealthStatus.OK),
        ComponentHealth("ollama", HealthStatus.DOWN),
    ]
    assert aggregate_status(components) == HealthStatus.DEGRADED
