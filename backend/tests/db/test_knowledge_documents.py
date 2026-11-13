"""DATABASE INTEGRATION: knowledge_documents isolation, privileges, constraints and bucket.

Runs only against the disposable test database (see conftest.py); skipped when
TEST_DATABASE_URL is not set. Requires migrations 0001-0007.
"""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.db_integration


def add_doc(db, org, *, status="ready", text="hello", path=None, size=5, mime="text/plain", doc=None):
    """Insert as the migration role (bypasses RLS), like the backend's service role does."""
    doc = doc or uuid.uuid4()
    path = path or f"{org}/{doc}.txt"
    db.execute(
        "insert into public.knowledge_documents "
        "(id, organisation_id, original_filename, storage_path, mime_type, size_bytes, status, "
        "extracted_text, text_length) values (%s, %s, 'guide.txt', %s, %s, %s, %s, %s, %s)",
        (doc, org, path, mime, size, status, text if status == "ready" else None, len(text)),
    )
    return doc


def visible(db, user) -> set:
    with db.as_user(user):
        return {r[0] for r in db.rows("select id from public.knowledge_documents")}


# --- isolation and privileges ----------------------------------------------------------------


def test_every_active_member_sees_only_their_own_organisations_documents(db, two_orgs):
    doc_a, doc_b = add_doc(db, two_orgs["org_a"]), add_doc(db, two_orgs["org_b"])
    for role in ("a_owner", "a_admin", "a_reviewer", "a_creator"):
        assert visible(db, two_orgs[role]) == {doc_a}, role
    assert visible(db, two_orgs["b_owner"]) == {doc_b}


def test_non_members_and_suspended_members_see_nothing(db, two_orgs):
    add_doc(db, two_orgs["org_a"])
    outsider, suspended = db.create_user(), db.create_user()
    db.add_member(two_orgs["org_a"], suspended, "admin", status="suspended")
    assert visible(db, outsider) == set()
    assert visible(db, suspended) == set()


def test_anon_has_no_access(db, two_orgs):
    add_doc(db, two_orgs["org_a"])
    with db.as_anon():
        with db.expect_db_error("42501"):
            db.execute("select * from public.knowledge_documents")


def test_clients_cannot_write_documents_even_as_owner(db, two_orgs):
    doc = add_doc(db, two_orgs["org_a"])
    with db.as_user(two_orgs["a_owner"]):
        with db.expect_db_error("42501"):
            db.execute(
                "insert into public.knowledge_documents (organisation_id, original_filename, storage_path, "
                "mime_type, size_bytes) values (%s, 'x.txt', %s, 'text/plain', 1)",
                (two_orgs["org_a"], f"{two_orgs['org_a']}/{uuid.uuid4()}.txt"),
            )
        with db.expect_db_error("42501"):
            db.execute("update public.knowledge_documents set original_filename = 'hijack' where id = %s", (doc,))
        with db.expect_db_error("42501"):
            db.execute("delete from public.knowledge_documents where id = %s", (doc,))


# --- constraints -----------------------------------------------------------------------------


def test_storage_path_must_sit_under_the_documents_own_organisation(db, two_orgs):
    with db.expect_db_error("23514"):
        add_doc(db, two_orgs["org_a"], path=f"{two_orgs['org_b']}/{uuid.uuid4()}.txt")


def test_storage_path_is_unique(db, two_orgs):
    doc = add_doc(db, two_orgs["org_a"])
    with db.expect_db_error("23505"):
        add_doc(db, two_orgs["org_a"], path=f"{two_orgs['org_a']}/{doc}.txt")


def test_size_status_mime_and_ready_text_rules(db, two_orgs):
    org = two_orgs["org_a"]
    with db.expect_db_error("23514"):
        add_doc(db, org, size=0)
    with db.expect_db_error("23514"):
        add_doc(db, org, size=10 * 1024 * 1024 + 1)
    with db.expect_db_error("23514"):
        add_doc(db, org, status="archived")
    with db.expect_db_error("23514"):
        add_doc(db, org, mime="image/png")
    with db.expect_db_error("23514"):  # a "ready" document must have its text
        db.execute(
            "insert into public.knowledge_documents (organisation_id, original_filename, storage_path, "
            "mime_type, size_bytes, status) values (%s, 'x.txt', %s, 'text/plain', 1, 'ready')",
            (org, f"{org}/{uuid.uuid4()}.txt"),
        )


def test_organisation_must_exist_and_deleting_it_removes_its_documents(db, two_orgs):
    with db.expect_db_error("23503"):
        add_doc(db, uuid.uuid4())
    add_doc(db, two_orgs["org_b"])
    db.execute("delete from public.organisations where id = %s", (two_orgs["org_b"],))
    assert db.scalar("select count(*) from public.knowledge_documents where organisation_id = %s", (two_orgs["org_b"],)) == 0


def test_updated_at_is_maintained(db, two_orgs):
    # Each test runs in ONE transaction and now() is frozen at its start, so a row inserted with
    # the default would already carry the same instant the trigger writes. Insert the row with an
    # old updated_at instead (the trigger fires on UPDATE only, so the insert keeps it).
    doc, org = uuid.uuid4(), two_orgs["org_a"]
    db.execute(
        "insert into public.knowledge_documents (id, organisation_id, original_filename, storage_path, "
        "mime_type, size_bytes, updated_at) values (%s, %s, 'guide.txt', %s, 'text/plain', 1, '2000-01-01')",
        (doc, org, f"{org}/{doc}.txt"),
    )
    before = db.scalar("select updated_at from public.knowledge_documents where id = %s", (doc,))
    db.execute("update public.knowledge_documents set status = 'failed' where id = %s", (doc,))
    after = db.scalar("select updated_at from public.knowledge_documents where id = %s", (doc,))
    assert after > before


# --- storage bucket (real Supabase only; the plain-Postgres shim has no storage schema) -------


def _has_storage(db) -> bool:
    return db.scalar("select to_regclass('storage.buckets') is not null")


def test_bucket_is_private_limited_and_type_restricted(db):
    if not _has_storage(db):
        pytest.skip("no storage schema (plain PostgreSQL shim)")
    row = db.one(
        "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'knowledge-documents'"
    )
    assert row is not None, "bucket knowledge-documents was not created by migration 0007"
    is_public, size_limit, mimes = row
    assert is_public is False
    assert size_limit == 10 * 1024 * 1024
    assert set(mimes) == {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
    }


def test_no_storage_policy_opens_the_bucket_to_clients(db):
    if not _has_storage(db):
        pytest.skip("no storage schema (plain PostgreSQL shim)")
    count = db.scalar(
        "select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' "
        "and (coalesce(qual, '') ilike '%knowledge-documents%' "
        "or coalesce(with_check, '') ilike '%knowledge-documents%')"
    )
    assert count == 0, "storage.objects must have no policy for knowledge-documents (server-side access only)"
