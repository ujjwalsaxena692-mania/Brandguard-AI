"""Explicit organisation authorisation for privileged (service-role) backend operations.

The service-role client bypasses Row Level Security, so every privileged operation must
first obtain a *verified* ``Membership`` from here and derive organisation_id / actor_id
from it, never from request bodies, query strings or headers.

``user_id`` passed in must come from a verified JWT (Part 02B). Nothing in this module
authenticates a user.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.errors import ForbiddenError
from app.models.organisation import Membership, Permission, has_permission
from app.repositories.audit_logs import AuditLogRepository
from app.repositories.memberships import MembershipRepository
from app.services.supabase_client import SupabaseService, get_supabase_service

# One message for "not a member" and "not allowed": do not reveal which organisations exist.
_DENIED = "You do not have access to this organisation."


class OrganisationAccessService:
    def __init__(self, supabase: SupabaseService | None = None, *, client: Any | None = None):
        # ``client`` lets tests inject a fake; production uses the shared service.
        self._supabase = supabase
        self._client = client

    def _db(self) -> Any:
        if self._client is not None:
            return self._client
        return (self._supabase or get_supabase_service()).get_client()

    def get_active_membership(self, organisation_id: UUID, user_id: UUID) -> Membership | None:
        return MembershipRepository(self._db()).get_active(organisation_id, user_id)

    def require_membership(self, organisation_id: UUID, user_id: UUID) -> Membership:
        membership = self.get_active_membership(organisation_id, user_id)
        if membership is None:
            raise ForbiddenError(_DENIED)
        return membership

    def require_permission(
        self, organisation_id: UUID, user_id: UUID, permission: Permission
    ) -> Membership:
        membership = self.require_membership(organisation_id, user_id)
        if not has_permission(membership.role, permission):
            raise ForbiddenError(_DENIED)
        return membership

    def list_members(self, organisation_id: UUID, actor_id: UUID) -> list[Membership]:
        """Example privileged read: authorised first, then scoped to the verified organisation."""
        actor = self.require_permission(organisation_id, actor_id, Permission.MEMBERS_VIEW)
        return MembershipRepository(self._db()).list_for_organisation(actor.organisation_id)

    def record_audit_event(
        self,
        actor: Membership,
        *,
        action: str,
        entity_type: str,
        entity_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Write an audit entry for a *verified* actor (organisation/actor come from it)."""
        if not actor.is_active:
            raise ForbiddenError(_DENIED)
        AuditLogRepository(self._db()).insert(
            organisation_id=actor.organisation_id,
            actor_id=actor.user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata=metadata or {},
        )
