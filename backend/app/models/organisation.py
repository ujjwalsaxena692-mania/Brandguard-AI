"""Organisation roles, membership statuses and the permission matrix.

This module is pure (no I/O) and mirrors the Row Level Security policies in
``database/migrations/0004_rls_policies.sql``. The database remains the source of
truth: these rules let backend code fail fast and explain a refusal, they never grant
more than RLS would.
"""

from __future__ import annotations

from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Role(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    REVIEWER = "reviewer"
    CREATOR = "creator"


class MembershipStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"


class Permission(str, Enum):
    ORG_VIEW = "org:view"
    ORG_UPDATE = "org:update"
    MEMBERS_VIEW = "members:view"
    MEMBERS_MANAGE = "members:manage"  # reviewers/creators (owners and admins)
    MEMBERS_MANAGE_PRIVILEGED = "members:manage_privileged"  # admins/owners (owner only)
    INVITATIONS_MANAGE = "invitations:manage"
    AUDIT_LOG_VIEW = "audit:view"


_ALL = frozenset(Permission)

# Content-workflow permissions (submit, review, approve) arrive with those features.
ROLE_PERMISSIONS: dict[Role, frozenset[Permission]] = {
    Role.OWNER: _ALL,
    Role.ADMIN: _ALL - {Permission.MEMBERS_MANAGE_PRIVILEGED},
    Role.REVIEWER: frozenset({Permission.ORG_VIEW, Permission.MEMBERS_VIEW}),
    Role.CREATOR: frozenset({Permission.ORG_VIEW, Permission.MEMBERS_VIEW}),
}

# Roles an inviter may grant. 'owner' is never granted by invitation.
_ADMIN_ASSIGNABLE = frozenset({Role.REVIEWER, Role.CREATOR})
_OWNER_INVITABLE = frozenset({Role.ADMIN, Role.REVIEWER, Role.CREATOR})


class Membership(BaseModel):
    """A verified organisation membership row."""

    model_config = ConfigDict(frozen=True)

    id: UUID
    organisation_id: UUID
    user_id: UUID
    role: Role
    status: MembershipStatus

    @property
    def is_active(self) -> bool:
        return self.status is MembershipStatus.ACTIVE


def has_permission(role: Role, permission: Permission) -> bool:
    return permission in ROLE_PERMISSIONS[role]


class OrganisationContext(BaseModel):
    """Who is calling and in which organisation, as proven by the database.

    Built only from a verified, active ``Membership`` (see ``OrganisationAccessService
    .resolve_membership``); never from request input.
    """

    model_config = ConfigDict(frozen=True)

    organisation_id: UUID
    user_id: UUID
    role: Role

    @classmethod
    def from_membership(cls, membership: Membership) -> OrganisationContext:
        return cls(
            organisation_id=membership.organisation_id,
            user_id=membership.user_id,
            role=membership.role,
        )

    def can(self, permission: Permission) -> bool:
        return has_permission(self.role, permission)


def can_set_member_role(actor: Role, current: Role, new: Role) -> bool:
    """May ``actor`` change a member from ``current`` to ``new``? (mirrors memberships_update)"""
    if actor is Role.OWNER:
        return True
    if actor is Role.ADMIN:
        return current in _ADMIN_ASSIGNABLE and new in _ADMIN_ASSIGNABLE
    return False


def can_remove_member(actor: Role, target: Role, *, is_self: bool) -> bool:
    """May ``actor`` remove a member? Anyone may leave; the last-owner rule is DB-enforced."""
    if is_self:
        return True
    if actor is Role.OWNER:
        return True
    return actor is Role.ADMIN and target in _ADMIN_ASSIGNABLE


def can_invite_role(actor: Role, invited: Role) -> bool:
    """May ``actor`` invite someone with ``invited`` role? (mirrors invitations_insert_admin)"""
    if actor is Role.OWNER:
        return invited in _OWNER_INVITABLE
    if actor is Role.ADMIN:
        return invited in _ADMIN_ASSIGNABLE
    return False
