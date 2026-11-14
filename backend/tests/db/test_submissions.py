"""DATABASE INTEGRATION: content_submissions / submission_attachments (real PostgreSQL).

Runs only against the disposable test database (see conftest.py); skipped when
TEST_DATABASE_URL is not set. Requires migrations 0001-0008.
"""

from __future__ import annotations

import uuid

import pytest

pytestmark = pytest.mark.db_integration


def add_submission(db, org, author, *, status="draft", title="Autumn launch email", **columns):
    """Insert as the migration role (bypasses RLS), like the backend's service role does."""
    row = {
        "id": uuid.uuid4(),
        "organisation_id": org,
        "submitted_by": author,
        "title": title,
        "status": status,
        **columns,
    }
    if status in ("submitted", "processing", "ready_for_analysis"):
        row.setdefault("submitted_at", "2026-01-01")
    if status == "ready_for_analysis":
        row.setdefault("analysis_text_length", 10)
    if status == "failed":
        row.setdefault("error_message", "boom")
    names = ", ".join(row)
    marks = ", ".join(["%s"] * len(row))
    db.execute(f"insert into public.content_submissions ({names}) values ({marks})", tuple(row.values()))
    return row["id"]


def add_attachment(db, org, submission, *, status="ready", text="hello", path=None, **columns):
    att = uuid.uuid4()
    row = {
        "id": att,
        "submission_id": submission,
        "organisation_id": org,
        "original_filename": "brief.txt",
        "storage_path": path or f"{org}/{submission}/{att}.txt",
        "mime_type": "text/plain",
        "size_bytes": 5,
        "status": status,
        "extracted_text": text if status == "ready" else None,
        "text_length": len(text) if status == "ready" else None,
        **columns,
    }
    names = ", ".join(row)
    marks = ", ".join(["%s"] * len(row))
    db.execute(f"insert into public.submission_attachments ({names}) values ({marks})", tuple(row.values()))
    return att


def visible(db, user, table="content_submissions") -> set:
    with db.as_user(user):
        return {r[0] for r in db.rows(f"select id from public.{table}")}


# --- visibility (RLS) ------------------------------------------------------------------------


def test_creators_see_only_their_own_while_owner_admin_reviewer_see_the_organisation(db, two_orgs):
    org = two_orgs["org_a"]
    other_creator = db.create_user()
    db.add_member(org, other_creator, "creator")
    mine = add_submission(db, org, two_orgs["a_creator"])
    theirs = add_submission(db, org, other_creator)

    assert visible(db, two_orgs["a_creator"]) == {mine}
    assert visible(db, other_creator) == {theirs}
    for role in ("a_owner", "a_admin", "a_reviewer"):
        assert visible(db, two_orgs[role]) == {mine, theirs}, role


def test_other_organisations_non_members_and_suspended_members_see_nothing(db, two_orgs):
    org = two_orgs["org_a"]
    add_submission(db, org, two_orgs["a_creator"])
    suspended, outsider = db.create_user(), db.create_user()
    db.add_member(org, suspended, "admin", status="suspended")
    assert visible(db, two_orgs["b_owner"]) == set()  # an owner, but of another organisation
    assert visible(db, suspended) == set()
    assert visible(db, outsider) == set()


def test_anon_has_no_access(db, two_orgs):
    add_submission(db, two_orgs["org_a"], two_orgs["a_creator"])
    with db.as_anon():
        for table in ("content_submissions", "submission_attachments"):
            with db.expect_db_error("42501"):
                db.execute(f"select * from public.{table}")


def test_attachment_visibility_mirrors_the_parent_submission(db, two_orgs):
    org = two_orgs["org_a"]
    other_creator = db.create_user()
    db.add_member(org, other_creator, "creator")
    mine = add_submission(db, org, two_orgs["a_creator"])
    theirs = add_submission(db, org, other_creator)
    my_att, their_att = add_attachment(db, org, mine), add_attachment(db, org, theirs)

    assert visible(db, two_orgs["a_creator"], "submission_attachments") == {my_att}
    assert visible(db, other_creator, "submission_attachments") == {their_att}
    assert visible(db, two_orgs["a_reviewer"], "submission_attachments") == {my_att, their_att}
    assert visible(db, two_orgs["b_owner"], "submission_attachments") == set()


def test_clients_cannot_write_even_as_owner(db, two_orgs):
    org = two_orgs["org_a"]
    sub = add_submission(db, org, two_orgs["a_owner"])
    att = add_attachment(db, org, sub)
    with db.as_user(two_orgs["a_owner"]):
        with db.expect_db_error("42501"):
            db.execute(
                "insert into public.content_submissions (organisation_id, title) values (%s, 'Sneaky title')",
                (org,),
            )
        with db.expect_db_error("42501"):
            db.execute("update public.content_submissions set title = 'hijack' where id = %s", (sub,))
        with db.expect_db_error("42501"):
            db.execute("delete from public.content_submissions where id = %s", (sub,))
        with db.expect_db_error("42501"):
            db.execute("update public.submission_attachments set status = 'failed' where id = %s", (att,))
        with db.expect_db_error("42501"):
            db.execute("delete from public.submission_attachments where id = %s", (att,))


# --- submission constraints ------------------------------------------------------------------


@pytest.mark.parametrize(
    "columns",
    [
        {"title": "ab"},
        {"title": "   "},
        {"title": "x" * 121},
        {"content_type": "podcast"},
        {"status": "approved"},
        {"content_text": "x" * 20001},
        {"campaign_name": "x" * 101},
        {"reviewer_context": "x" * 1001},
        {"error_message": "x" * 501},
        {"analysis_text_length": -1},
    ],
)
def test_submission_field_constraints(db, two_orgs, columns):
    with db.expect_db_error("23514"):
        add_submission(db, two_orgs["org_a"], two_orgs["a_creator"], **columns)


def test_later_stages_must_carry_their_data(db, two_orgs):
    org, user = two_orgs["org_a"], two_orgs["a_creator"]
    with db.expect_db_error("23514"):  # submitted without a submission time
        db.execute(
            "insert into public.content_submissions (organisation_id, submitted_by, title, status) "
            "values (%s, %s, 'Needs a time', 'submitted')",
            (org, user),
        )
    with db.expect_db_error("23514"):  # ready without a text length
        db.execute(
            "insert into public.content_submissions (organisation_id, submitted_by, title, status, submitted_at) "
            "values (%s, %s, 'Needs a length', 'ready_for_analysis', now())",
            (org, user),
        )
    with db.expect_db_error("23514"):  # failed without a reason
        db.execute(
            "insert into public.content_submissions (organisation_id, submitted_by, title, status) "
            "values (%s, %s, 'Needs a reason', 'failed')",
            (org, user),
        )


def test_every_valid_status_and_content_type_is_accepted(db, two_orgs):
    for status in ("draft", "submitted", "processing", "ready_for_analysis", "failed", "cancelled"):
        add_submission(db, two_orgs["org_a"], two_orgs["a_creator"], status=status)
    for content_type in (
        "social_post", "ad_copy", "blog_post", "email_newsletter", "landing_page",
        "press_release", "product_description", "presentation", "other",
    ):
        add_submission(db, two_orgs["org_a"], two_orgs["a_creator"], content_type=content_type)


def test_organisation_must_exist_and_deleting_it_removes_everything(db, two_orgs):
    with db.expect_db_error("23503"):
        add_submission(db, uuid.uuid4(), two_orgs["a_creator"])
    org = two_orgs["org_b"]
    sub = add_submission(db, org, two_orgs["b_owner"])
    add_attachment(db, org, sub)
    db.execute("delete from public.organisations where id = %s", (org,))
    assert db.scalar("select count(*) from public.content_submissions where organisation_id = %s", (org,)) == 0
    assert db.scalar("select count(*) from public.submission_attachments where organisation_id = %s", (org,)) == 0


def test_deleting_the_author_keeps_the_submission(db, two_orgs):
    org = two_orgs["org_a"]
    author = db.create_user()
    db.add_member(org, author, "creator")
    sub = add_submission(db, org, author)
    db.execute("delete from public.organisation_memberships where user_id = %s", (author,))
    db.execute("delete from auth.users where id = %s", (author,))
    assert db.scalar("select submitted_by from public.content_submissions where id = %s", (sub,)) is None


def test_updated_at_is_maintained(db, two_orgs):
    # one transaction per test => now() is frozen; insert with an old updated_at (the trigger fires
    # on UPDATE only) so the later update visibly advances it
    sub = add_submission(db, two_orgs["org_a"], two_orgs["a_creator"], updated_at="2000-01-01")
    before = db.scalar("select updated_at from public.content_submissions where id = %s", (sub,))
    db.execute("update public.content_submissions set title = 'Renamed title' where id = %s", (sub,))
    after = db.scalar("select updated_at from public.content_submissions where id = %s", (sub,))
    assert after > before


# --- attachment constraints, composite FK and the draft-only trigger -------------------------


def test_an_attachment_cannot_point_across_organisations(db, two_orgs):
    sub = add_submission(db, two_orgs["org_a"], two_orgs["a_creator"])
    with db.expect_db_error("23503"):  # (submission, organisation) pair does not exist
        add_attachment(db, two_orgs["org_b"], sub)


def test_storage_path_must_sit_under_organisation_and_submission_and_be_unique(db, two_orgs):
    org, other = two_orgs["org_a"], two_orgs["org_b"]
    sub, sub2 = (add_submission(db, org, two_orgs["a_creator"]) for _ in range(2))
    with db.expect_db_error("23514"):
        add_attachment(db, org, sub, path=f"{other}/{sub}/{uuid.uuid4()}.txt")
    with db.expect_db_error("23514"):
        add_attachment(db, org, sub, path=f"{org}/{sub2}/{uuid.uuid4()}.txt")  # another submission's folder
    att = add_attachment(db, org, sub)
    with db.expect_db_error("23505"):
        add_attachment(db, org, sub, path=f"{org}/{sub}/{att}.txt")


def test_attachment_size_status_mime_and_ready_text_rules(db, two_orgs):
    org = two_orgs["org_a"]
    sub = add_submission(db, org, two_orgs["a_creator"])
    for columns in ({"size_bytes": 0}, {"size_bytes": 10 * 1024 * 1024 + 1}, {"status": "archived"}, {"mime_type": "image/png"}):
        with db.expect_db_error("23514"):
            add_attachment(db, org, sub, **columns)
    with db.expect_db_error("23514"):  # a "ready" attachment must have its text
        add_attachment(db, org, sub, extracted_text=None)


@pytest.mark.parametrize("status", ["submitted", "processing", "ready_for_analysis", "failed", "cancelled"])
def test_attachments_can_only_be_added_to_draft_submissions(db, two_orgs, status):
    org = two_orgs["org_a"]
    sub = add_submission(db, org, two_orgs["a_creator"], status=status)
    with db.expect_db_error("23514"):
        add_attachment(db, org, sub)


def test_the_draft_guard_follows_the_submission_status(db, two_orgs):
    org = two_orgs["org_a"]
    sub = add_submission(db, org, two_orgs["a_creator"])
    add_attachment(db, org, sub)  # draft: allowed
    db.execute(
        "update public.content_submissions set status = 'submitted', submitted_at = now() where id = %s", (sub,)
    )
    with db.expect_db_error("23514"):
        add_attachment(db, org, sub)


def test_deleting_a_submission_removes_its_attachments(db, two_orgs):
    org = two_orgs["org_a"]
    sub = add_submission(db, org, two_orgs["a_creator"])
    add_attachment(db, org, sub)
    add_attachment(db, org, sub)
    db.execute("delete from public.content_submissions where id = %s", (sub,))
    assert db.scalar("select count(*) from public.submission_attachments where submission_id = %s", (sub,)) == 0


# --- storage bucket (real Supabase only; the plain-Postgres shim has no storage schema) -------


def _has_storage(db) -> bool:
    return db.scalar("select to_regclass('storage.buckets') is not null")


def test_bucket_is_private_limited_and_type_restricted(db):
    if not _has_storage(db):
        pytest.skip("no storage schema (plain PostgreSQL shim)")
    row = db.one(
        "select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'submission-attachments'"
    )
    assert row is not None, "bucket submission-attachments was not created by migration 0008"
    is_public, size_limit, mimes = row
    assert is_public is False and size_limit == 10 * 1024 * 1024
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
        "and (coalesce(qual, '') ilike '%submission-attachments%' "
        "or coalesce(with_check, '') ilike '%submission-attachments%')"
    )
    assert count == 0, "storage.objects must have no policy for submission-attachments (server-side only)"
