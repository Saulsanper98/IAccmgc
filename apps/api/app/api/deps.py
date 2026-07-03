from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException

from app.config import Settings, get_settings


@dataclass(frozen=True)
class AuthenticatedUser:
    user_id: str
    role: str


def verify_internal_token(
    x_internal_token: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> None:
    if not x_internal_token or x_internal_token != settings.internal_service_token:
        raise HTTPException(status_code=401, detail="No autorizado")


def get_authenticated_user(
    x_internal_token: str | None = Header(default=None),
    x_user_id: str | None = Header(default=None),
    x_user_role: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    if not x_internal_token or x_internal_token != settings.internal_service_token:
        raise HTTPException(status_code=401, detail="No autorizado")
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Usuario no identificado")
    return AuthenticatedUser(user_id=x_user_id, role=x_user_role or "lector")
