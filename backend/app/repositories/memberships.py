"""Data access for organisation memberships (service-role client; no authorisation here)."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.models.organisation import Membership
from app.repositories.base import run_query

_TABLE = "organisation_memberships"
_COLUMNS = "id, organisation_id, user_id, role, status"


class MembershipRepository:
    """Pure data access. Callers must authorise first (see OrganisationAccessService)."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def get_active(self, organisation_id: UUID, user_id: UUID) -> Membership | None:
        rows = run_query(
            "memberships.get_active",
            lambda: self._client.table(_TABLE)
            .select(_COLUMNS)
            .eq("organisation_id", str(organisation_id))
            .eq("user_id", str(user_id))
            .eq("status", "active")
            .limit(1)
            .execute(),
        )
        return Membership.model_validate(rows[0]) if rows else None

    def list_for_organisation(self, organisation_id: UUID) -> list[Membership]:
        rows = run_query(
            "memberships.list_for_organisation",
            lambda: self._client.table(_TABLE)
            .select(_COLUMNS)
            .eq("organisation_id", str(organisation_id))
            .execute(),
        )
        return [Membership.model_validate(row) for row in rows]
