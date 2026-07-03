# Fase B — Drift contra infraestructura real

> **Estado:** Solo diseño (Fase 6). No implementado.

## Objetivo

Contrastar afirmaciones de la documentación wiki (hostnames, IPs, miembros de grupos AD, registros DNS) contra el estado real de la infraestructura, sin modificar nada en los sistemas fuente.

## Interfaz `InfraProvider`

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class InfraRecord:
    kind: str  # host, ip, dns, ad_group_member
    key: str
    value: str
    source: str  # ldap, dns, glpi


class InfraProvider(ABC):
    @abstractmethod
    async def lookup_host(self, hostname: str) -> InfraRecord | None: ...

    @abstractmethod
    async def lookup_ip(self, address: str) -> InfraRecord | None: ...

    @abstractmethod
    async def resolve_dns(self, name: str, record_type: str = "A") -> list[str]: ...

    @abstractmethod
    async def group_members(self, group_name: str) -> list[str]: ...
```

## Conectores planificados

| Conector | Librería | Uso |
|----------|----------|-----|
| `LdapInfraProvider` | `ldap3` | Hostnames en AD, miembros de grupos |
| `DnsInfraProvider` | `dnspython` | Resolución directa/inversa |
| `GlpiInfraProvider` | REST GLPI | Inventario de activos |

## Detector de drift (futuro)

1. Extraer entidades de chunks (regex + LLM): IPs, FQDNs, grupos AD.
2. Consultar `InfraProvider` read-only.
3. Emitir `staleness_findings` con `detector=infra_drift` cuando doc ≠ realidad.

## Integración

- Ejecutar tras sync de ingesta (worker), igual que detectores Fase A.
- Umbrales y proveedores activos vía `.env` (`INFRA_PROVIDERS=ldap,dns`).
- Sin credenciales de escritura en ningún sistema.

## Seguridad

- Credenciales de servicio en env del worker únicamente.
- Rate limiting por proveedor.
- Cache TTL corto en Redis para consultas repetidas.
