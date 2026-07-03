from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db.session import get_db
from app.services.health import run_health_checks

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(
    session: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> dict:
    report = await run_health_checks(session, settings)
    return report.to_dict()


@router.get("/")
async def root() -> dict:
    return {"service": "wikibridge-api", "status": "running"}
