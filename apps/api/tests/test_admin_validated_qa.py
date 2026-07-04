from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from app.api.routes import admin_validated_qa
from app.api.deps import AuthenticatedUser


def _admin() -> AuthenticatedUser:
    return AuthenticatedUser(user_id="admin-1", role="admin")


def _reader() -> AuthenticatedUser:
    return AuthenticatedUser(user_id="user-1", role="lector")


@pytest.mark.asyncio
async def test_list_validated_qa_forbidden_for_non_admin():
    with pytest.raises(HTTPException) as exc:
        await admin_validated_qa.list_validated_qa(
            status=None,
            limit=50,
            offset=0,
            user=_reader(),
            session=AsyncMock(),
            settings=MagicMock(),
        )
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_list_validated_qa_allowed_for_admin():
    session = AsyncMock()
    settings = MagicMock()
    with patch("app.api.routes.admin_validated_qa.ValidatedQaService") as mock_service_cls:
        mock_service = mock_service_cls.return_value
        mock_service.list_entries = AsyncMock(return_value={"items": [], "total": 0, "limit": 50, "offset": 0})

        result = await admin_validated_qa.list_validated_qa(
            status=None,
            limit=50,
            offset=0,
            user=_admin(),
            session=session,
            settings=settings,
        )

    assert result["total"] == 0
    mock_service.list_entries.assert_awaited_once()
