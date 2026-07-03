from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from ldap3 import ALL, Connection, Server, SUBTREE
from ldap3.core.exceptions import LDAPException
from pydantic import BaseModel

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


class LdapAuthRequest(BaseModel):
    username: str
    password: str


@router.post("/ldap")
async def ldap_login(body: LdapAuthRequest, settings: Settings = Depends(get_settings)) -> dict:
    if not settings.ldap_url or not settings.ldap_base_dn:
        return {"ok": False, "detail": "LDAP no configurado"}

    try:
        user = _authenticate_ldap(body.username, body.password, settings)
        return {"ok": True, "user": user}
    except LDAPException as exc:
        logger.warning("LDAP auth failed for %s: %s", body.username, exc)
        return {"ok": False, "detail": "Credenciales inválidas"}
    except Exception:
        logger.exception("LDAP unexpected error")
        return {"ok": False, "detail": "Error de autenticación LDAP"}


def _authenticate_ldap(username: str, password: str, settings: Settings) -> dict:
    server = Server(settings.ldap_url, get_info=ALL)
    user_dn = _find_user_dn(server, username, settings)
    if not user_dn:
        raise LDAPException("User not found")

    conn = Connection(server, user=user_dn, password=password, auto_bind=True)
    conn.search(
        user_dn,
        "(objectClass=*)",
        attributes=["displayName", "mail", "department", "cn"],
    )
    display_name = username
    email = f"{username}@local"
    department = None
    if conn.entries:
        entry = conn.entries[0]
        display_name = str(entry.displayName or entry.cn or username)
        email = str(entry.mail or email)
        department = str(entry.department) if entry.department else None
    conn.unbind()

    role = _resolve_role(server, user_dn, settings)
    return {
        "id": username,
        "name": display_name,
        "email": email,
        "role": role,
        "department": department,
    }


def _find_user_dn(server: Server, username: str, settings: Settings) -> str | None:
    if settings.ldap_bind_dn:
        conn = Connection(
            server,
            user=settings.ldap_bind_dn,
            password=settings.ldap_bind_password,
            auto_bind=True,
        )
    else:
        conn = Connection(server, auto_bind=True)

    search_filter = settings.ldap_user_filter.format(username=username)
    conn.search(settings.ldap_base_dn, search_filter, search_scope=SUBTREE, attributes=["dn"])
    if not conn.entries:
        conn.unbind()
        return None
    dn = conn.entries[0].entry_dn
    conn.unbind()
    return dn


def _resolve_role(server: Server, user_dn: str, settings: Settings) -> str:
    if not settings.ldap_bind_dn:
        return "lector"
    conn = Connection(
        server,
        user=settings.ldap_bind_dn,
        password=settings.ldap_bind_password,
        auto_bind=True,
    )
    if settings.ldap_admin_group:
        conn.search(
            settings.ldap_base_dn,
            f"(&(member={user_dn})(cn={settings.ldap_admin_group}))",
            search_scope=SUBTREE,
            attributes=["cn"],
        )
        if conn.entries:
            conn.unbind()
            return "admin"
    if settings.ldap_editor_group:
        conn.search(
            settings.ldap_base_dn,
            f"(&(member={user_dn})(cn={settings.ldap_editor_group}))",
            search_scope=SUBTREE,
            attributes=["cn"],
        )
        if conn.entries:
            conn.unbind()
            return "editor"
    conn.unbind()
    return "lector"
