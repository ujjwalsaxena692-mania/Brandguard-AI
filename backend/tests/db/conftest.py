"""Fixtures for the DATABASE INTEGRATION tests.

These run against a REAL PostgreSQL with the migrations applied and Row Level Security
enabled. They are skipped (and reported as skipped, never as passed) unless:

    TEST_DATABASE_URL=postgresql://...            a dedicated TEST database
    BRANDGUARD_TEST_DB_CONFIRM=this-is-a-test-database

Every test runs inside one transaction that is ROLLED BACK at the end, so no rows persist.
Statements run as the connecting (owner) role by default; `as_user` / `as_anon` switch to the
`authenticated` / `anon` roles with a JWT subject, exactly how Supabase evaluates RLS.
"""

from __future__ import annotations

import json
import os
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import pytest

URL_ENV = "TEST_DATABASE_URL"
CONFIRM_ENV = "BRANDGUARD_TEST_DB_CONFIRM"
CONFIRM_VALUE = "this-is-a-test-database"

REQUIRED_TABLES = {
    "organisations",
    "profiles",
    "organisation_memberships",
    "organisation_invitations",
    "audit_logs",
}


class Db:
    def __init__(self, conn: Any, psycopg: Any) -> None:
        self.conn = conn
        self._pg = psycopg

    # -- plain helpers -------------------------------------------------------
    def execute(self, sql: str, params: tuple | list | None = None):
        return self.conn.execute(sql, params)

    def one(self, sql: str, params: tuple | list | None = None):
        return self.conn.execute(sql, params).fetchone()

    def scalar(self, sql: str, params: tuple | list | None = None):
        row = self.one(sql, params)
        return None if row is None else row[0]

    def rows(self, sql: str, params: tuple | list | None = None) -> list[tuple]:
        return self.conn.execute(sql, params).fetchall()

    # -- fixtures-as-data (created as the owner role, rolled back at the end) --
    def create_user(
        self,
        *,
        full_name: str | None = None,
        avatar_url: str | None = None,
        confirmed: bool = True,
        email: str | None = None,
    ) -> uuid.UUID:
        uid = uuid.uuid4()
        meta: dict[str, str] = {}
        if full_name is not None:
            meta["full_name"] = full_name
        if avatar_url is not None:
            meta["avatar_url"] = avatar_url
        self.execute(
            "insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) "
            "values (%s, %s, case when %s then now() end, %s::jsonb)",
            (uid, (email or f"{uid}@example.test").lower(), confirmed, json.dumps(meta)),
        )
        return uid

    def create_org(self, owner: uuid.UUID, *, name: str = "Test Org") -> uuid.UUID:
        org = uuid.uuid4()
        self.execute(
            "insert into public.organisations (id, name, slug, created_by) values (%s, %s, %s, %s)",
            (org, name, f"t-{uuid.uuid4().hex[:12]}", owner),
        )
        self.add_member(org, owner, "owner")
        return org

    def add_member(self, org: uuid.UUID, user: uuid.UUID, role: str, status: str = "active") -> None:
        self.execute(
            "insert into public.organisation_memberships (organisation_id, user_id, role, status) "
            "values (%s, %s, %s, %s)",
            (org, user, role, status),
        )

    def create_invitation(
        self,
        org: uuid.UUID,
        email: str,
        role: str,
        token_hash: str,
        invited_by: uuid.UUID,
        *,
        expired: bool = False,
    ) -> uuid.UUID:
        inv = uuid.uuid4()
        if expired:
            self.execute(
                "insert into public.organisation_invitations "
                "(id, organisation_id, email, role, invitation_token_hash, invited_by, created_at, expires_at) "
                "values (%s,%s,%s,%s,%s,%s, now() - interval '2 days', now() - interval '1 day')",
                (inv, org, email.lower(), role, token_hash, invited_by),
            )
        else:
            self.execute(
                "insert into public.organisation_invitations "
                "(id, organisation_id, email, role, invitation_token_hash, invited_by) "
                "values (%s,%s,%s,%s,%s,%s)",
                (inv, org, email.lower(), role, token_hash, invited_by),
            )
        return inv

    # -- role switching (how Supabase evaluates RLS) ----------------------------
    @contextmanager
    def as_user(self, user_id: uuid.UUID) -> Iterator[None]:
        claims = json.dumps({"sub": str(user_id), "role": "authenticated"})
        self.execute("select set_config('request.jwt.claims', %s, true)", (claims,))
        self.execute("set local role authenticated")
        try:
            yield
        finally:
            self._reset()

    @contextmanager
    def as_anon(self) -> Iterator[None]:
        self.execute("select set_config('request.jwt.claims', %s, true)", (json.dumps({"role": "anon"}),))
        self.execute("set local role anon")
        try:
            yield
        finally:
            self._reset()

    def _reset(self) -> None:
        try:
            self.execute("reset role")
            self.execute("select set_config('request.jwt.claims', '', true)")
        except self._pg.Error:  # transaction already aborted by a failing test
            pass

    @contextmanager
    def expect_db_error(self, *sqlstates: str) -> Iterator[None]:
        """Assert the block raises a PostgreSQL error (optionally with one of the SQLSTATEs).

        Uses a savepoint so the surrounding test transaction stays usable.
        """
        try:
            with self.conn.transaction():
                yield
        except self._pg.Error as exc:
            if sqlstates and exc.sqlstate not in sqlstates:
                raise AssertionError(
                    f"expected SQLSTATE {sqlstates}, got {exc.sqlstate}: {exc}"
                ) from exc
            return
        raise AssertionError(f"expected a database error {sqlstates or ''} but the statement succeeded")


def _assert_migrations_applied(db: Db) -> None:
    tables = {r[0] for r in db.rows("select tablename from pg_tables where schemaname = 'public'")}
    missing = REQUIRED_TABLES - tables
    if missing:
        pytest.fail(
            f"Migrations 0002-0006 are not applied to the test database (missing: {sorted(missing)}). "
            "See docs/MIGRATION_GUIDE.md.",
            pytrace=False,
        )
    for signature in (
        "public.create_organisation(text, text)",
        "public.accept_invitation(text)",
        "private.is_org_member(uuid)",
    ):
        if db.scalar("select to_regprocedure(%s)", (signature,)) is None:
            pytest.fail(f"Function {signature} is missing: apply all migrations.", pytrace=False)
    for role in ("anon", "authenticated"):
        if not db.scalar("select exists (select 1 from pg_roles where rolname = %s)", (role,)):
            pytest.fail(f"Database role '{role}' does not exist (not a Supabase-like database).", pytrace=False)


@pytest.fixture
def db() -> Iterator[Db]:
    url = os.environ.get(URL_ENV)
    if not url:
        pytest.skip(f"{URL_ENV} is not set: database integration tests did NOT run")
    if os.environ.get(CONFIRM_ENV) != CONFIRM_VALUE:
        pytest.fail(
            f"{URL_ENV} is set but {CONFIRM_ENV}={CONFIRM_VALUE!r} is not. Refusing to run "
            "against a database that has not been explicitly confirmed as a test database.",
            pytrace=False,
        )
    psycopg = pytest.importorskip("psycopg", reason="psycopg is required for database tests")
    conn = psycopg.connect(url, autocommit=False)
    helper = Db(conn, psycopg)
    try:
        _assert_migrations_applied(helper)
        yield helper
    finally:
        conn.rollback()
        conn.close()


@pytest.fixture
def two_orgs(db: Db) -> dict[str, Any]:
    """Org A (owner, admin, reviewer, creator) and Org B (owner) with one invitation and audit row in A."""
    ids = {name: db.create_user() for name in ("a_owner", "a_admin", "a_reviewer", "a_creator", "b_owner")}
    org_a = db.create_org(ids["a_owner"], name="Org A")
    org_b = db.create_org(ids["b_owner"], name="Org B")
    db.add_member(org_a, ids["a_admin"], "admin")
    db.add_member(org_a, ids["a_reviewer"], "reviewer")
    db.add_member(org_a, ids["a_creator"], "creator")
    inv = db.create_invitation(org_a, "invitee@example.test", "creator", "a" * 64, ids["a_owner"])
    db.execute(
        "insert into public.audit_logs (organisation_id, actor_id, action, entity_type) "
        "values (%s, %s, 'test.event', 'organisation')",
        (org_a, ids["a_owner"]),
    )
    return {**ids, "org_a": org_a, "org_b": org_b, "invitation_a": inv}
