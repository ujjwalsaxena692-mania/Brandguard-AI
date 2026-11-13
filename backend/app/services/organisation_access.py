"""Explicit organisation authorisation for privileged (service-role) backend operations.

The service-role client bypasses Row Level Security, so every privileged operation must
first obtain a *verified* ``Membership`` from here and derive organisation_id / actor_id
from it, never from request bodies, query strings or headers.

``user_id`` passed in must come from a verified JWT (see ``app.services.auth``). Nothing in
this module authenticates a user.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.core.errors import AppError, ForbiddenError
from app.models.organisation import (
    Membership,
    OrganisationContext,
    Permission,
    has_permission,
)
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

    def resolve_membership(
        self, user_id: UUID, requested_organisation_id: UUID | None = None
    ) -> Membership:
        """Find the caller's active membership. ``user_id`` must come from a verified JWT.

        * No ``requested_organisation_id``: use the caller's only active membership. Zero is
          refused; several require the caller to choose one (HTTP 400).
        * With ``requested_organisation_id``: it is only a *selector* among the caller's own
          memberships. It is looked up together with ``user_id``, so naming an organisation
          the caller does not actively belong to is refused exactly like having none.

        Suspended memberships never match. The result is re-checked defensively.
        """
        repository = MembershipRepository(self._db())
        membership: Membership | None
        if requested_organisation_id is not None:
            membership = repository.get_active(requested_organisation_id, user_id)
        else:
            memberships = repository.list_active_for_user(user_id)
            if len(memberships) > 1:
                raise AppError(
                    "You belong to several organisations; choose one with the "
                    "X-Organisation-Id header.",
                    status_code=400,
                    code="organisation_required",
                )
            membership = memberships[0] if memberships else None

        if (
            membership is None
            or not membership.is_active
            or membership.user_id != user_id
            or (
                requested_organisation_id is not None
                and membership.organisation_id != requested_organisation_id
            )
        ):
            raise ForbiddenError(_DENIED)
        return membership

    def resolve_context(
        self, user_id: UUID, requested_organisation_id: UUID | None = None
    ) -> OrganisationContext:
        return OrganisationContext.from_membership(
            self.resolve_membership(user_id, requested_organisation_id)
        )

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


def require_context_permission(context: OrganisationContext, permission: Permission) -> None:
    """Refuse (HTTP 403, same message as a non-member) unless the role grants ``permission``."""
    if not context.can(permission):
        raise ForbiddenError(_DENIED)
