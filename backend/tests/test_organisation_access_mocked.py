"""MOCKED unit tests: a fake in-memory client stands in for Supabase.

These verify the backend's own authorisation logic and error translation. They say
NOTHING about PostgreSQL or Row Level Security behaviour.
"""

from __future__ import annotations

from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest

from app.core.config import Settings
from app.core.errors import ConflictError, DatabaseError, ForbiddenError, InvalidDataError
from app.models.organisation import Membership, MembershipStatus, Permission, Role
from app.repositories.base import run_query
from app.services.organisation_access import OrganisationAccessService


class FakeQuery:
    def __init__(self, client: FakeClient, table: str) -> None:
        self._client, self._table = client, table
        self._filters: list[tuple[str, str]] = []
        self._insert: dict | None = None

    def select(self, *_a):
        return self

    def eq(self, column: str, value: str):
        self._filters.append((column, value))
        self._client.filters.append((self._table, column, value))
        return self

    def limit(self, _n: int):
        return self

    def insert(self, row: dict):
        self._insert = row
        return self

    def execute(self):
        if self._insert is not None:
            self._client.inserts.setdefault(self._table, []).append(self._insert)
            return SimpleNamespace(data=[self._insert])
        rows = self._client.tables.get(self._table, [])
        matched = [r for r in rows if all(str(r.get(c)) == v for c, v in self._filters)]
        return SimpleNamespace(data=matched)


class FakeClient:
    def __init__(self, memberships: list[dict] | None = None) -> None:
        self.tables = {"organisation_memberships": memberships or []}
        self.inserts: dict[str, list[dict]] = {}
        self.filters: list[tuple[str, str, str]] = []

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)


def _row(org: UUID, user: UUID, role: Role, status: str = "active") -> dict:
    return {
        "id": str(uuid4()),
        "organisation_id": str(org),
        "user_id": str(user),
        "role": role.value,
        "status": status,
    }


ORG, OTHER_ORG = uuid4(), uuid4()
OWNER, ADMIN, CREATOR, OUTSIDER = uuid4(), uuid4(), uuid4(), uuid4()


@pytest.fixture
def service() -> OrganisationAccessService:
    client = FakeClient(
        [
            _row(ORG, OWNER, Role.OWNER),
            _row(ORG, ADMIN, Role.ADMIN),
            _row(ORG, CREATOR, Role.CREATOR),
            _row(ORG, OUTSIDER, Role.CREATOR, status="suspended"),
        ]
    )
    return OrganisationAccessService(client=client)


def test_active_member_is_allowed(service):
    membership = service.require_permission(ORG, ADMIN, Permission.AUDIT_LOG_VIEW)
    assert membership.role is Role.ADMIN


def test_non_member_is_forbidden(service):
    with pytest.raises(ForbiddenError):
        service.require_membership(OTHER_ORG, ADMIN)


def test_suspended_member_is_forbidden(service):
    with pytest.raises(ForbiddenError):
        service.require_membership(ORG, OUTSIDER)


def test_member_of_org_a_gets_nothing_in_org_b(service):
    with pytest.raises(ForbiddenError):
        service.require_permission(OTHER_ORG, OWNER, Permission.ORG_VIEW)


def test_creator_lacks_privileged_permissions(service):
    for permission in (Permission.AUDIT_LOG_VIEW, Permission.INVITATIONS_MANAGE):
        with pytest.raises(ForbiddenError):
            service.require_permission(ORG, CREATOR, permission)


def test_admin_cannot_manage_privileged_members(service):
    with pytest.raises(ForbiddenError):
        service.require_permission(ORG, ADMIN, Permission.MEMBERS_MANAGE_PRIVILEGED)


def test_denial_message_is_identical_for_non_member_and_insufficient_role(service):
    with pytest.raises(ForbiddenError) as non_member:
        service.require_membership(OTHER_ORG, CREATOR)
    with pytest.raises(ForbiddenError) as low_role:
        service.require_permission(ORG, CREATOR, Permission.AUDIT_LOG_VIEW)
    assert non_member.value.message == low_role.value.message


def test_list_members_authorises_before_querying_and_scopes_to_verified_org(service):
    client = service._client
    with pytest.raises(ForbiddenError):
        service.list_members(OTHER_ORG, OWNER)
    assert client.filters  # the membership check ran...
    members = service.list_members(ORG, CREATOR)
    assert {m.user_id for m in members} == {OWNER, ADMIN, CREATOR, OUTSIDER}


def test_audit_event_takes_org_and_actor_from_verified_membership(service):
    actor = service.require_membership(ORG, ADMIN)
    service.record_audit_event(actor, action="member.invited", entity_type="invitation")
    (row,) = service._client.inserts["audit_logs"]
    assert row["organisation_id"] == str(ORG)
    assert row["actor_id"] == str(ADMIN)


def test_audit_event_rejected_for_inactive_actor(service):
    actor = Membership(
        id=uuid4(),
        organisation_id=ORG,
        user_id=OUTSIDER,
        role=Role.OWNER,
        status=MembershipStatus.SUSPENDED,
    )
    with pytest.raises(ForbiddenError):
        service.record_audit_event(actor, action="x", entity_type="y")
    assert "audit_logs" not in service._client.inserts


class _DbError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@pytest.mark.parametrize(
    ("sqlstate", "expected"),
    [
        ("23505", ConflictError),
        ("23514", InvalidDataError),
        ("23503", InvalidDataError),
        ("42501", ForbiddenError),
        ("XX000", DatabaseError),
    ],
)
def test_database_errors_are_translated_without_leaking_details(sqlstate, expected):
    def boom():
        raise _DbError(sqlstate, 'duplicate key value violates "secret_table_key"')

    with pytest.raises(expected) as caught:
        run_query("test", boom)
    assert "secret_table_key" not in caught.value.message


def test_publishable_key_is_rejected_as_service_role_key():
    with pytest.raises(ValueError):
        Settings.from_env(
            {"SUPABASE_URL": "https://x.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "sb_publishable_abc"}
        )
