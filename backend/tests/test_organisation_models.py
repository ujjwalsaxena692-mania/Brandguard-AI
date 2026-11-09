"""PURE UNIT tests of role/permission logic. No database, no network."""

from __future__ import annotations

import re
from pathlib import Path

from app.models.organisation import (
    ROLE_PERMISSIONS,
    MembershipStatus,
    Permission,
    Role,
    can_invite_role,
    can_remove_member,
    can_set_member_role,
    has_permission,
)

MIGRATION_0002 = Path(__file__).resolve().parents[2] / "database/migrations/0002_core_tables.sql"


def test_role_values_match_database_constraint():
    sql = MIGRATION_0002.read_text(encoding="utf-8")
    match = re.search(r"organisation_memberships_role_valid\s+check \(role in \(([^)]*)\)", sql)
    assert match
    db_roles = set(re.findall(r"'(\w+)'", match.group(1)))
    assert db_roles == {r.value for r in Role}


def test_status_values_match_database_constraint():
    sql = MIGRATION_0002.read_text(encoding="utf-8")
    match = re.search(r"organisation_memberships_status_valid\s+check \(status in \(([^)]*)\)", sql)
    assert match
    assert set(re.findall(r"'(\w+)'", match.group(1))) == {s.value for s in MembershipStatus}


def test_owner_has_every_permission():
    assert ROLE_PERMISSIONS[Role.OWNER] == frozenset(Permission)


def test_admin_cannot_manage_privileged_members():
    assert has_permission(Role.ADMIN, Permission.MEMBERS_MANAGE)
    assert not has_permission(Role.ADMIN, Permission.MEMBERS_MANAGE_PRIVILEGED)


def test_creator_and_reviewer_have_read_only_organisation_access():
    for role in (Role.CREATOR, Role.REVIEWER):
        assert ROLE_PERMISSIONS[role] == {Permission.ORG_VIEW, Permission.MEMBERS_VIEW}
        assert not has_permission(role, Permission.AUDIT_LOG_VIEW)
        assert not has_permission(role, Permission.INVITATIONS_MANAGE)
        assert not has_permission(role, Permission.MEMBERS_MANAGE)


def test_owner_may_set_any_role_admin_only_low_roles():
    assert can_set_member_role(Role.OWNER, Role.CREATOR, Role.OWNER)
    assert can_set_member_role(Role.ADMIN, Role.CREATOR, Role.REVIEWER)
    assert not can_set_member_role(Role.ADMIN, Role.REVIEWER, Role.ADMIN)
    assert not can_set_member_role(Role.ADMIN, Role.REVIEWER, Role.OWNER)
    assert not can_set_member_role(Role.ADMIN, Role.OWNER, Role.CREATOR)
    assert not can_set_member_role(Role.ADMIN, Role.ADMIN, Role.CREATOR)


def test_reviewer_and_creator_cannot_change_roles_at_all():
    for actor in (Role.REVIEWER, Role.CREATOR):
        for current in Role:
            for new in Role:
                assert not can_set_member_role(actor, current, new)


def test_invitation_rules():
    assert not can_invite_role(Role.OWNER, Role.OWNER)
    assert can_invite_role(Role.OWNER, Role.ADMIN)
    assert can_invite_role(Role.ADMIN, Role.CREATOR)
    assert not can_invite_role(Role.ADMIN, Role.ADMIN)
    assert not can_invite_role(Role.REVIEWER, Role.CREATOR)
    assert not can_invite_role(Role.CREATOR, Role.CREATOR)


def test_removal_rules():
    assert can_remove_member(Role.CREATOR, Role.CREATOR, is_self=True)
    assert not can_remove_member(Role.CREATOR, Role.REVIEWER, is_self=False)
    assert can_remove_member(Role.ADMIN, Role.CREATOR, is_self=False)
    assert not can_remove_member(Role.ADMIN, Role.ADMIN, is_self=False)
    assert not can_remove_member(Role.ADMIN, Role.OWNER, is_self=False)
    assert can_remove_member(Role.OWNER, Role.ADMIN, is_self=False)
