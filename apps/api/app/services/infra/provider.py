from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class InfraRecord:
    kind: str
    key: str
    value: str
    source: str


class InfraProvider(ABC):
    """Read-only infrastructure lookup — implemented in a future phase."""

    @abstractmethod
    async def lookup_host(self, hostname: str) -> InfraRecord | None: ...

    @abstractmethod
    async def lookup_ip(self, address: str) -> InfraRecord | None: ...

    @abstractmethod
    async def resolve_dns(self, name: str, record_type: str = "A") -> list[str]: ...

    @abstractmethod
    async def group_members(self, group_name: str) -> list[str]: ...
