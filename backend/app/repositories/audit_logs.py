"""Data access for audit logs. Clients cannot write this table; only the backend can."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.repositories.base import run_query

_TABLE = "audit_logs"


class AuditLogRepository:
    def __init__(self, client: Any) -> None:
        self._client = client

    def insert(
        self,
        *,
        organisation_id: UUID,
        actor_id: UUID,
        action: str,
        entity_type: str,
        entity_id: UUID | None,
        metadata: dict[str, Any],
    ) -> None:
        row = {
            "organisation_id": str(organisation_id),
            "actor_id": str(actor_id),
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "metadata": metadata,
        }
        run_query("audit_logs.insert", lambda: self._client.table(_TABLE).insert(row).execute())
