"""Organisation context and role-based access tests.

MOCKED: a fake in-memory Supabase client stands in for the database, so these verify the
backend's own logic (who is resolved, what is refused). They say nothing about PostgreSQL or
Row Level Security; that is covered by tests/db. No test here can reach a real database: the
fake is always injected, and the app under test is built from unconfigured settings.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Annotated
from uuid import UUID, uuid4

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi import Depends, FastAPI  # noqa: E402
from pydantic import ValidationError  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.api.deps import (  # noqa: E402
    get_current_user,
    get_organisation_access_service,
    require_permission,
)
from app.core.config import Settings  # noqa: E402
from app.core.errors import AppError, ForbiddenError  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.organisation import (  # noqa: E402
    Membership,
    MembershipStatus,
    OrganisationContext,
    Permission,
    Role,
)
from app.repositories.memberships import MembershipRepository  # noqa: E402
from app.services.auth import AuthenticatedUser  # noqa: E402
from app.services.organisation_access import OrganisationAccessService  # noqa: E402

DENIED = "You do not have access to this organisation."

ORG_A, ORG_B = uuid4(), uuid4()
USER, OTHER_USER = uuid4(), uuid4()


# --- fake database ---------------------------------------------------------------------------


class FakeQuery:
    def __init__(self, client: FakeClient, table: str) -> None:
        self._client, self._table = client, table
        self._filters: list[tuple[str, str]] = []

    def select(self, *_a):
        return self

    def eq(self, column: str, value: str):
        self._filters.append((column, value))
        self._client.filters.append((self._table, column, value))
        return self

    def limit(self, _n: int):
        return self

    def execute(self):
        rows = self._client.tables.get(self._table, [])
        return SimpleNamespace(
            data=[r for r in rows if all(str(r.get(c)) == v for c, v in self._filters)]
        )


class FakeClient:
    def __init__(self, memberships: list[dict]) -> None:
        self.tables = {"organisation_memberships": memberships}
        self.filters: list[tuple[str, str, str]] = []

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)


def row(org: UUID, user: UUID, role: Role, status: str = "active") -> dict:
    return {
        "id": str(uuid4()),
        "organisation_id": str(org),
        "user_id": str(user),
        "role": role.value,
        "status": status,
    }


def membership(org: UUID, user: UUID, role: Role, status: MembershipStatus) -> Membership:
    return Membership(id=uuid4(), organisation_id=org, user_id=user, role=role, status=status)


# --- test app --------------------------------------------------------------------------------


def add_test_routes(app: FastAPI) -> None:
    """Routes that exercise the reusable dependencies, one per permission."""

    def ctx_body(context: OrganisationContext) -> dict:
        return {"organisation_id": str(context.organisation_id), "role": context.role.value}

    @app.get("/test/view")
    def view(c: Annotated[OrganisationContext, Depends(require_permission(Permission.ORG_VIEW))]):
        return ctx_body(c)

    @app.get("/test/audit")
    def audit(
        c: Annotated[OrganisationContext, Depends(require_permission(Permission.AUDIT_LOG_VIEW))],
    ):
        return ctx_body(c)

    @app.get("/test/invite")
    def invite(
        c: Annotated[
            OrganisationContext, Depends(require_permission(Permission.INVITATIONS_MANAGE))
        ],
    ):
        return ctx_body(c)

    @app.get("/test/privileged")
    def privileged(
        c: Annotated[
            OrganisationContext, Depends(require_permission(Permission.MEMBERS_MANAGE_PRIVILEGED))
        ],
    ):
        return ctx_body(c)

    @app.post("/test/write")
    def write(
        body: dict,
        c: Annotated[OrganisationContext, Depends(require_permission(Permission.ORG_VIEW))],
    ):
        return ctx_body(c)


def build(rows: list[dict], user: UUID = USER) -> tuple[TestClient, FakeClient]:
    """App whose caller is `user` (token verification itself is covered by
    test_auth_verification.py) and whose database is the in-memory fake."""
    app = create_app(Settings.from_env({"APP_ENV": "test"}))
    fake = FakeClient(rows)
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=user)
    app.dependency_overrides[get_organisation_access_service] = lambda: OrganisationAccessService(
        client=fake
    )
    add_test_routes(app)
    return TestClient(app), fake


def org_header(org: UUID) -> dict[str, str]:
    return {"X-Organisation-Id": str(org)}


# --- valid membership ------------------------------------------------------------------------


def test_valid_membership_resolves_organisation_and_role_from_the_database():
    client, _ = build([row(ORG_A, USER, Role.ADMIN)])
    response = client.get("/api/v1/organisation/context")
    assert response.status_code == 200
    body = response.json()
    assert body["organisation_id"] == str(ORG_A)
    assert body["role"] == "admin"
    assert "audit:view" in body["permissions"]
    assert "members:manage_privileged" not in body["permissions"]


def test_context_endpoint_lists_exactly_the_roles_permissions():
    expected = {
        Role.OWNER: sorted(permission.value for permission in Permission),
        Role.CREATOR: ["members:view", "org:view"],
        Role.REVIEWER: ["members:view", "org:view"],
    }
    for role, permissions in expected.items():
        client, _ = build([row(ORG_A, USER, role)])
        assert client.get("/api/v1/organisation/context").json()["permissions"] == permissions


# --- missing / suspended membership ----------------------------------------------------------


def test_user_without_any_membership_is_forbidden():
    client, _ = build([row(ORG_A, OTHER_USER, Role.OWNER)])
    response = client.get("/api/v1/organisation/context")
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"
    assert response.json()["error"]["message"] == DENIED


def test_suspended_membership_is_forbidden():
    client, _ = build([row(ORG_A, USER, Role.OWNER, status="suspended")])
    assert client.get("/api/v1/organisation/context").status_code == 403
    assert client.get("/test/view", headers=org_header(ORG_A)).status_code == 403


def test_suspended_membership_is_ignored_when_another_is_active():
    client, _ = build(
        [row(ORG_A, USER, Role.OWNER, status="suspended"), row(ORG_B, USER, Role.CREATOR)]
    )
    response = client.get("/api/v1/organisation/context")
    assert response.status_code == 200
    assert response.json()["organisation_id"] == str(ORG_B)
    assert client.get("/api/v1/organisation/context", headers=org_header(ORG_A)).status_code == 403


def test_service_rechecks_status_even_if_the_repository_returned_a_suspended_row(monkeypatch):
    suspended = membership(ORG_A, USER, Role.OWNER, MembershipStatus.SUSPENDED)
    monkeypatch.setattr(MembershipRepository, "list_active_for_user", lambda self, u: [suspended])
    monkeypatch.setattr(MembershipRepository, "get_active", lambda self, o, u: suspended)
    service = OrganisationAccessService(client=FakeClient([]))
    with pytest.raises(ForbiddenError):
        service.resolve_membership(USER)
    with pytest.raises(ForbiddenError):
        service.resolve_membership(USER, ORG_A)


def test_service_refuses_a_membership_that_belongs_to_someone_else(monkeypatch):
    foreign = membership(ORG_A, OTHER_USER, Role.OWNER, MembershipStatus.ACTIVE)
    monkeypatch.setattr(MembershipRepository, "list_active_for_user", lambda self, u: [foreign])
    monkeypatch.setattr(MembershipRepository, "get_active", lambda self, o, u: foreign)
    service = OrganisationAccessService(client=FakeClient([]))
    with pytest.raises(ForbiddenError):
        service.resolve_membership(USER)
    with pytest.raises(ForbiddenError):
        service.resolve_membership(USER, ORG_A)


def test_service_refuses_a_membership_for_a_different_organisation_than_requested(monkeypatch):
    other_org = membership(ORG_B, USER, Role.OWNER, MembershipStatus.ACTIVE)
    monkeypatch.setattr(MembershipRepository, "get_active", lambda self, o, u: other_org)
    service = OrganisationAccessService(client=FakeClient([]))
    with pytest.raises(ForbiddenError):
        service.resolve_membership(USER, ORG_A)


# --- organisation isolation ------------------------------------------------------------------


def test_client_supplied_organisation_id_cannot_bypass_membership():
    client, _ = build([row(ORG_A, USER, Role.OWNER), row(ORG_B, OTHER_USER, Role.OWNER)])
    # Header naming an organisation the caller is not in.
    denied = client.get("/test/view", headers=org_header(ORG_B))
    assert denied.status_code == 403
    assert denied.json()["error"]["message"] == DENIED
    # Query string and body ids are never consulted.
    via_query = client.get(
        "/api/v1/organisation/context",
        params={"organisation_id": str(ORG_B), "user_id": str(OTHER_USER)},
    )
    assert via_query.json()["organisation_id"] == str(ORG_A)
    via_body = client.post(
        "/test/write", json={"organisation_id": str(ORG_B), "user_id": str(OTHER_USER)}
    )
    assert via_body.json()["organisation_id"] == str(ORG_A)


def test_naming_an_unknown_organisation_looks_the_same_as_naming_someone_elses():
    client, _ = build([row(ORG_A, USER, Role.OWNER), row(ORG_B, OTHER_USER, Role.OWNER)])
    someone_elses = client.get("/test/view", headers=org_header(ORG_B))
    unknown = client.get("/test/view", headers=org_header(uuid4()))
    assert someone_elses.status_code == unknown.status_code == 403
    assert someone_elses.json()["error"]["message"] == unknown.json()["error"]["message"]


def test_every_membership_lookup_is_scoped_to_the_verified_user():
    client, fake = build([row(ORG_A, USER, Role.OWNER), row(ORG_B, OTHER_USER, Role.OWNER)])
    client.get("/api/v1/organisation/context")
    client.get("/test/view", headers=org_header(ORG_B))
    client.get("/test/view", headers=org_header(ORG_A))
    user_filters = {value for _t, column, value in fake.filters if column == "user_id"}
    assert user_filters == {str(USER)}  # never OTHER_USER, whatever the request named
    assert all(value == "active" for _t, column, value in fake.filters if column == "status")


def test_users_in_different_organisations_each_get_only_their_own():
    rows = [row(ORG_A, USER, Role.OWNER), row(ORG_B, OTHER_USER, Role.CREATOR)]
    mine, _ = build(rows, user=USER)
    theirs, _ = build(rows, user=OTHER_USER)
    assert mine.get("/test/view").json() == {"organisation_id": str(ORG_A), "role": "owner"}
    assert theirs.get("/test/view").json() == {"organisation_id": str(ORG_B), "role": "creator"}


def test_user_in_several_organisations_must_choose_and_role_follows_the_choice():
    client, _ = build([row(ORG_A, USER, Role.ADMIN), row(ORG_B, USER, Role.CREATOR)])
    ambiguous = client.get("/test/view")
    assert ambiguous.status_code == 400
    assert ambiguous.json()["error"]["code"] == "organisation_required"

    assert client.get("/test/audit", headers=org_header(ORG_A)).json()["role"] == "admin"
    # Same user, same endpoint: a creator in organisation B has no audit access there.
    assert client.get("/test/audit", headers=org_header(ORG_B)).status_code == 403


def test_malformed_organisation_header_is_a_400_not_a_lookup():
    client, fake = build([row(ORG_A, USER, Role.OWNER)])
    response = client.get("/test/view", headers={"X-Organisation-Id": "not-a-uuid"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_organisation_id"
    assert fake.filters == []  # rejected before touching the database


# --- role permissions ------------------------------------------------------------------------

# route -> expected HTTP status for each role (written out by hand, independent of the matrix code)
EXPECTED = {
    "/test/view": {Role.OWNER: 200, Role.ADMIN: 200, Role.REVIEWER: 200, Role.CREATOR: 200},
    "/test/audit": {Role.OWNER: 200, Role.ADMIN: 200, Role.REVIEWER: 403, Role.CREATOR: 403},
    "/test/invite": {Role.OWNER: 200, Role.ADMIN: 200, Role.REVIEWER: 403, Role.CREATOR: 403},
    "/test/privileged": {Role.OWNER: 200, Role.ADMIN: 403, Role.REVIEWER: 403, Role.CREATOR: 403},
}


@pytest.mark.parametrize("path", sorted(EXPECTED))
@pytest.mark.parametrize("role", list(Role))
def test_role_permissions_are_enforced(path, role):
    client, _ = build([row(ORG_A, USER, role)])
    response = client.get(path)
    assert response.status_code == EXPECTED[path][role]
    if response.status_code == 403:
        assert response.json()["error"]["message"] == DENIED  # same as a non-member


def test_only_the_four_existing_roles_are_accepted():
    assert {role.value for role in Role} == {"owner", "admin", "reviewer", "creator"}
    # An unknown role in the database is never treated as valid access (fails closed).
    service = OrganisationAccessService(
        client=FakeClient([row(ORG_A, USER, Role.OWNER) | {"role": "superuser"}])
    )
    with pytest.raises(ValidationError):
        service.resolve_membership(USER)


# --- existing behaviour preserved ------------------------------------------------------------


def test_health_remains_public():
    client, _ = build([])
    assert client.get("/health").status_code == 200


def test_context_endpoint_requires_a_token():
    # No dependency overrides: the real verifier rejects a request without credentials.
    client = TestClient(create_app(Settings.from_env({"APP_ENV": "test"})))
    response = client.get("/api/v1/organisation/context")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_database_not_configured_fails_closed_with_503():
    app = create_app(Settings.from_env({"APP_ENV": "test"}))  # no Supabase credentials
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=USER)
    response = TestClient(app).get("/api/v1/organisation/context")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "integration_not_configured"


def test_cors_preflight_allows_the_organisation_header():
    client, _ = build([])
    response = client.options(
        "/api/v1/organisation/context",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,x-organisation-id",
        },
    )
    assert response.status_code == 200
    assert "x-organisation-id" in response.headers["access-control-allow-headers"].lower()


def test_resolve_membership_error_types():
    service = OrganisationAccessService(client=FakeClient([]))
    with pytest.raises(ForbiddenError):
        service.resolve_membership(USER)
    several = OrganisationAccessService(
        client=FakeClient([row(ORG_A, USER, Role.OWNER), row(ORG_B, USER, Role.OWNER)])
    )
    with pytest.raises(AppError) as caught:
        several.resolve_membership(USER)
    assert caught.value.status_code == 400
