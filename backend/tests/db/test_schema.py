"""DATABASE INTEGRATION: schema assumptions and constraints (real PostgreSQL)."""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.db_integration

TABLES = (
    "organisations",
    "profiles",
    "organisation_memberships",
    "organisation_invitations",
    "audit_logs",
    "knowledge_documents",
    "content_submissions",
    "submission_attachments",
)


def test_rls_is_enabled_on_every_table(db):
    rows = db.rows(
        "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace "
        "where n.nspname = 'public' and c.relname = any(%s)",
        (list(TABLES),),
    )
    assert {r[0] for r in rows} == set(TABLES)
    assert all(r[1] for r in rows), rows


def test_pgvector_extension_is_installed(db):
    assert db.scalar("select count(*) from pg_extension where extname = 'vector'") == 1


def test_anon_has_no_privileges_on_any_table(db):
    for table in TABLES:
        for privilege in ("select", "insert", "update", "delete"):
            assert not db.scalar("select has_table_privilege('anon', %s, %s)", (f"public.{table}", privilege))


def test_authenticated_cannot_insert_organisations_memberships_or_audit_logs(db):
    for table in ("organisations", "organisation_memberships", "audit_logs", "profiles"):
        assert not db.scalar("select has_table_privilege('authenticated', %s, 'insert')", (f"public.{table}",))


def test_all_policies_apply_to_authenticated_only(db):
    rows = db.rows("select policyname, roles::text[] from pg_policies where schemaname = 'public'")
    assert len(rows) == 14  # 11 from 0004, +1 knowledge (0007), +2 submissions and attachments (0008)
    for name, roles in rows:
        assert list(roles) == ["authenticated"], (name, roles)


def test_security_definer_functions_pin_search_path_and_exclude_anon(db):
    rows = db.rows(
        "select p.oid, p.proname, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace "
        "where p.prosecdef and n.nspname in ('public', 'private')"
    )
    assert len(rows) >= 7
    for oid, name, config in rows:
        assert config and any(c.startswith("search_path=") for c in config), name
        assert not db.scalar("select has_function_privilege('anon', %s, 'execute')", (oid,)), name


def test_role_constraint_rejects_unknown_role(db):
    owner = db.create_user()
    org = db.create_org(owner)
    other = db.create_user()
    with db.expect_db_error("23514"):
        db.add_member(org, other, "superuser")


def test_status_constraint_rejects_unknown_status(db):
    owner = db.create_user()
    org = db.create_org(owner)
    other = db.create_user()
    with db.expect_db_error("23514"):
        db.add_member(org, other, "creator", status="banned")


def test_membership_is_unique_per_user_and_organisation(db):
    owner = db.create_user()
    org = db.create_org(owner)
    with db.expect_db_error("23505"):
        db.add_member(org, owner, "creator")


def test_slug_format_and_uniqueness(db):
    owner = db.create_user()
    with db.expect_db_error("23514"):
        db.execute("insert into public.organisations (name, slug) values ('X', 'Bad Slug')")
    slug = f"s-{uuid.uuid4().hex[:10]}"
    db.execute("insert into public.organisations (name, slug, created_by) values ('X', %s, %s)", (slug, owner))
    with db.expect_db_error("23505"):
        db.execute("insert into public.organisations (name, slug) values ('Y', %s)", (slug,))


def test_membership_requires_existing_organisation_and_user(db):
    with db.expect_db_error("23503"):
        db.add_member(uuid.uuid4(), db.create_user(), "creator")


def test_invitation_token_hash_must_be_sha256_hex_not_plaintext(db):
    owner = db.create_user()
    org = db.create_org(owner)
    with db.expect_db_error("23514"):
        db.create_invitation(org, "x@example.test", "creator", "plaintext-token-value", owner)
    with db.expect_db_error("23514"):
        db.create_invitation(org, "y@example.test", "creator", "A" * 64, owner)  # uppercase hex rejected


def test_invitation_cannot_grant_owner(db):
    owner = db.create_user()
    org = db.create_org(owner)
    with db.expect_db_error("23514"):
        db.create_invitation(org, "x@example.test", "owner", "b" * 64, owner)


def test_only_one_pending_invitation_per_email_and_organisation(db):
    owner = db.create_user()
    org = db.create_org(owner)
    db.create_invitation(org, "dup@example.test", "creator", "c" * 64, owner)
    with db.expect_db_error("23505"):
        db.create_invitation(org, "dup@example.test", "reviewer", "d" * 64, owner)


def test_invitation_email_must_be_lowercase(db):
    owner = db.create_user()
    org = db.create_org(owner)
    with db.expect_db_error("23514"):
        db.execute(
            "insert into public.organisation_invitations (organisation_id, email, role, invitation_token_hash) "
            "values (%s, 'Mixed@Example.test', 'creator', %s)",
            (org, "e" * 64),
        )


def test_audit_metadata_must_be_a_json_object(db):
    owner = db.create_user()
    org = db.create_org(owner)
    with db.expect_db_error("23514"):
        db.execute(
            "insert into public.audit_logs (organisation_id, action, entity_type, metadata) "
            "values (%s, 'a', 'b', '[1,2]'::jsonb)",
            (org,),
        )


def test_updated_at_trigger_overrides_supplied_value(db):
    owner = db.create_user()
    org = db.create_org(owner)
    db.execute("update public.organisations set name = 'Renamed', updated_at = '2000-01-01' where id = %s", (org,))
    assert db.scalar("select updated_at = now() from public.organisations where id = %s", (org,))


def test_deleting_an_organisation_cascades_memberships_and_invitations(db):
    owner = db.create_user()
    org = db.create_org(owner)
    db.create_invitation(org, "z@example.test", "creator", "f" * 64, owner)
    db.execute("delete from public.organisations where id = %s", (org,))
    assert db.scalar("select count(*) from public.organisation_memberships where organisation_id = %s", (org,)) == 0
    assert db.scalar("select count(*) from public.organisation_invitations where organisation_id = %s", (org,)) == 0
