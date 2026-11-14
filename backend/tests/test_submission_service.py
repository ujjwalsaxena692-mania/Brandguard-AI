"""Content submissions: workflow, ownership/isolation, filtering, attachments and cleanup.

MOCKED storage and database (knowledge_helpers.FakeSupabase). Attachment validation and text
extraction are the Knowledge Hub's own code, exercised here with real PDF/DOCX/TXT bytes.
"""

from __future__ import annotations

from uuid import UUID, uuid4

import pytest
from knowledge_helpers import (
    DOCX_MIME,
    PDF_MIME,
    TXT_MIME,
    FakeSupabase,
    add_attachment,
    add_submission,
    make_docx,
    make_pdf,
)

from app.core.errors import AppError, DatabaseError, ForbiddenError, InvalidDataError
from app.models.knowledge import DocumentStatus
from app.models.organisation import OrganisationContext, Role
from app.models.submission import (
    ALLOWED_TRANSITIONS,
    DELETABLE_STATUSES,
    MAX_ATTACHMENTS,
    SubmissionStatus,
    can_transition,
)
from app.repositories.submission_attachments import AttachmentRepository
from app.repositories.submissions import SubmissionRepository
from app.services import knowledge_files, submissions as submissions_module, text_extraction
from app.services.knowledge_storage import KnowledgeStorage, StorageUnavailableError
from app.services.submissions import SubmissionService

ORG_A, ORG_B = uuid4(), uuid4()
U_CREATOR, U_CREATOR2, U_ADMIN, U_REVIEWER, U_B = (uuid4() for _ in range(5))


def ctx(org, user, role) -> OrganisationContext:
    return OrganisationContext(organisation_id=org, user_id=user, role=role)


CREATOR = ctx(ORG_A, U_CREATOR, Role.CREATOR)
CREATOR2 = ctx(ORG_A, U_CREATOR2, Role.CREATOR)
ADMIN = ctx(ORG_A, U_ADMIN, Role.ADMIN)
REVIEWER = ctx(ORG_A, U_REVIEWER, Role.REVIEWER)
ADMIN_B = ctx(ORG_B, U_B, Role.ADMIN)

LONG_TEXT = "Meet Orbit Insights: reporting that finally makes sense."


def service_for(client: FakeSupabase) -> SubmissionService:
    return SubmissionService(
        SubmissionRepository(client),
        AttachmentRepository(client),
        KnowledgeStorage(client, "submission-attachments"),
    )


def sid(row: dict) -> UUID:
    return UUID(row["id"])


# --- the Knowledge Hub's code is reused, not copied ------------------------------------------


def test_submissions_reuse_the_knowledge_hub_validation_and_extraction():
    assert submissions_module.validate_upload is knowledge_files.validate_upload
    assert submissions_module.extract_for_storage is text_extraction.extract_for_storage
    assert submissions_module.KnowledgeStorage is KnowledgeStorage


# --- create / read ---------------------------------------------------------------------------


def test_create_scopes_the_draft_to_the_callers_organisation_and_identity():
    client = FakeSupabase()
    record = service_for(client).create(
        CREATOR, {"title": "Autumn launch", "content_text": LONG_TEXT, "content_type": "ad_copy"}
    )
    assert record.status is SubmissionStatus.DRAFT
    assert record.organisation_id == ORG_A and record.submitted_by == U_CREATOR
    assert record.title == "Autumn launch" and record.content_text == LONG_TEXT
    assert client.submission_log == ["draft"]


def test_get_returns_the_submission_with_its_attachments():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    add_attachment(client, row)
    detail = service_for(client).get(CREATOR, sid(row))
    assert detail.submission.title == row["title"] and len(detail.attachments) == 1
    assert not hasattr(detail.attachments[0], "storage_path")
    assert not hasattr(detail.attachments[0], "extracted_text")


# --- list: pagination, filters, visibility ---------------------------------------------------


def seeded_list_client():
    client = FakeSupabase()
    rows = [
        add_submission(client, ORG_A, U_CREATOR, title="Alpha post", content_type="social_post"),
        add_submission(client, ORG_A, U_CREATOR, title="Beta email", content_type="email_newsletter", status="cancelled"),
        add_submission(client, ORG_A, U_CREATOR2, title="Gamma 50% off", content_type="ad_copy", status="ready_for_analysis", analysis_text_length=60),
        add_submission(client, ORG_A, U_ADMIN, title="Delta_page", content_type="landing_page"),
        add_submission(client, ORG_B, U_B, title="Other organisation"),
    ]
    return client, rows


def titles(result) -> list[str]:
    return [item.title for item in result[0]]


def test_list_is_newest_first_with_a_total_that_ignores_paging():
    client, _ = seeded_list_client()
    items, total = service_for(client).list_submissions(ADMIN, limit=2, offset=0)
    assert [i.title for i in items] == ["Delta_page", "Gamma 50% off"] and total == 4
    items, total = service_for(client).list_submissions(ADMIN, limit=2, offset=2)
    assert [i.title for i in items] == ["Beta email", "Alpha post"] and total == 4


def test_list_never_loads_typed_content_or_attachment_text():
    client, _ = seeded_list_client()
    service_for(client).list_submissions(ADMIN, limit=10, offset=0)
    [(_, columns)] = [s for s in client.selects if s[0] == "content_submissions"]
    assert "content_text" not in columns and "reviewer_context" not in columns


def test_list_filters_by_status_type_and_search():
    client, _ = seeded_list_client()
    service = service_for(client)
    assert titles(service.list_submissions(ADMIN, limit=10, offset=0, status=SubmissionStatus.CANCELLED)) == ["Beta email"]
    assert titles(service.list_submissions(ADMIN, limit=10, offset=0, content_type="ad_copy")) == ["Gamma 50% off"]
    assert titles(service.list_submissions(ADMIN, limit=10, offset=0, search="ALPHA")) == ["Alpha post"]
    # LIKE wildcards in the search text are literal, not patterns
    assert titles(service.list_submissions(ADMIN, limit=10, offset=0, search="50%")) == ["Gamma 50% off"]
    assert titles(service.list_submissions(ADMIN, limit=10, offset=0, search="delta_")) == ["Delta_page"]
    assert titles(service.list_submissions(ADMIN, limit=10, offset=0, search="%")) == ["Gamma 50% off"]
    assert service.list_submissions(ADMIN, limit=10, offset=0, search="nothing like this")[1] == 0


def test_creators_see_only_their_own_while_admins_and_reviewers_see_everyones():
    client, _ = seeded_list_client()
    service = service_for(client)
    assert sorted(titles(service.list_submissions(CREATOR, limit=10, offset=0))) == ["Alpha post", "Beta email"]
    assert titles(service.list_submissions(CREATOR2, limit=10, offset=0)) == ["Gamma 50% off"]
    assert len(service.list_submissions(ADMIN, limit=10, offset=0)[0]) == 4
    assert len(service.list_submissions(REVIEWER, limit=10, offset=0)[0]) == 4
    assert titles(service.list_submissions(ADMIN, limit=10, offset=0, mine=True)) == ["Delta_page"]


def test_other_organisations_are_never_listed_or_readable():
    client, rows = seeded_list_client()
    service = service_for(client)
    assert titles(service.list_submissions(ADMIN_B, limit=10, offset=0)) == ["Other organisation"]
    with pytest.raises(AppError) as caught:
        service.get(ADMIN, sid(rows[4]))
    assert (caught.value.status_code, caught.value.code) == (404, "not_found")
    # every query carried the verified organisation id
    org_filters = {v for t, _o, c, v in client.filters if t == "content_submissions" and c == "organisation_id"}
    assert org_filters <= {str(ORG_A), str(ORG_B)} and str(ORG_A) in org_filters


# --- ownership (IDOR) ------------------------------------------------------------------------


@pytest.mark.parametrize("action", ["get", "update", "submit", "cancel", "delete", "attach", "remove_attachment"])
def test_a_creator_cannot_reach_another_creators_submission(action):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    service = service_for(client)
    calls = {
        "get": lambda: service.get(CREATOR2, sid(row)),
        "update": lambda: service.update(CREATOR2, sid(row), {"title": "hijacked"}),
        "submit": lambda: service.submit(CREATOR2, sid(row)),
        "cancel": lambda: service.cancel(CREATOR2, sid(row)),
        "delete": lambda: service.delete(CREATOR2, sid(row)),
        "attach": lambda: service.add_attachment(CREATOR2, sid(row), filename="a.txt", content_type=TXT_MIME, data=b"hello"),
        "remove_attachment": lambda: service.remove_attachment(CREATOR2, sid(row), uuid4()),
    }
    with pytest.raises(AppError) as caught:
        calls[action]()
    assert (caught.value.status_code, caught.value.code) == (404, "not_found")  # looks like it does not exist
    assert client.objects == {} and client.tables["content_submissions"][0]["title"] == row["title"]


def test_admins_can_act_on_anyones_submission_but_reviewers_cannot_modify():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    service = service_for(client)
    assert service.update(ADMIN, sid(row), {"title": "Edited by admin"}).title == "Edited by admin"
    assert service.get(REVIEWER, sid(row)).submission.id == sid(row)  # may read
    for action in (
        lambda: service.update(REVIEWER, sid(row), {"title": "x"}),
        lambda: service.cancel(REVIEWER, sid(row)),
        lambda: service.delete(REVIEWER, sid(row)),
    ):
        with pytest.raises(ForbiddenError):
            action()


# --- update ----------------------------------------------------------------------------------


def test_update_changes_only_the_given_fields_of_a_draft():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    updated = service_for(client).update(CREATOR, sid(row), {"campaign_name": "Autumn", "platform": "LinkedIn"})
    assert updated.campaign_name == "Autumn" and updated.platform == "LinkedIn"
    assert updated.title == row["title"] and updated.content_text == row["content_text"]


def test_empty_update_is_a_no_op():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    assert service_for(client).update(CREATOR, sid(row), {}).title == row["title"]


@pytest.mark.parametrize("status", ["submitted", "processing", "ready_for_analysis", "failed", "cancelled"])
def test_only_drafts_can_be_edited(status):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, status=status, error_message="x" if status == "failed" else None)
    with pytest.raises(AppError) as caught:
        service_for(client).update(CREATOR, sid(row), {"title": "Changed"})
    assert (caught.value.status_code, caught.value.code) == (409, "submission_locked")
    assert client.tables["content_submissions"][0]["title"] == row["title"]


def test_update_loses_gracefully_if_the_submission_was_submitted_in_the_meantime(monkeypatch):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    monkeypatch.setattr(SubmissionRepository, "update_draft", lambda self, o, i, c: None)
    with pytest.raises(AppError) as caught:
        service_for(client).update(CREATOR, sid(row), {"title": "Changed"})
    assert (caught.value.status_code, caught.value.code) == (409, "conflict")


# --- workflow: submit ------------------------------------------------------------------------


def test_submit_moves_through_every_state_and_ends_ready_for_analysis_never_approved():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, content_text=LONG_TEXT)
    add_attachment(client, row, text="x" * 100)
    result = service_for(client).submit(CREATOR, sid(row))
    assert result.status is SubmissionStatus.READY_FOR_ANALYSIS
    assert client.submission_log == ["submitted", "processing", "ready_for_analysis"]
    assert result.submitted_at is not None and result.processed_at is not None
    assert result.analysis_text_length == len(LONG_TEXT) + 100
    assert result.error_message is None
    # no analysis, scores or approvals exist anywhere
    assert not {"approved", "analysed", "analyzed"} & {s.value for s in SubmissionStatus}
    assert set(client.tables) <= {"organisation_memberships", "content_submissions", "submission_attachments"}


def test_submit_requires_a_content_type():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, content_type=None)
    with pytest.raises(AppError) as caught:
        service_for(client).submit(CREATOR, sid(row))
    assert (caught.value.status_code, caught.value.code) == (422, "invalid_submission")
    assert client.submission_log == []  # nothing moved


def test_submit_requires_enough_content_or_an_attachment():
    client = FakeSupabase()
    short = add_submission(client, ORG_A, U_CREATOR, content_text="too short")
    with pytest.raises(AppError) as caught:
        service_for(client).submit(CREATOR, sid(short))
    assert caught.value.code == "invalid_submission"

    # a ready attachment is enough content on its own
    add_attachment(client, short, text="An approved campaign brief in a document.")
    assert service_for(client).submit(CREATOR, sid(short)).status is SubmissionStatus.READY_FOR_ANALYSIS


def test_submit_is_blocked_by_failed_or_unfinished_attachments():
    client = FakeSupabase()
    failed = add_submission(client, ORG_A, U_CREATOR)
    add_attachment(client, failed, status="failed")
    unfinished = add_submission(client, ORG_A, U_CREATOR)
    add_attachment(client, unfinished, status="processing")
    service = service_for(client)
    with pytest.raises(AppError) as caught:
        service.submit(CREATOR, sid(failed))
    assert (caught.value.status_code, caught.value.code) == (409, "attachment_failed")
    with pytest.raises(AppError) as caught:
        service.submit(CREATOR, sid(unfinished))
    assert (caught.value.status_code, caught.value.code) == (409, "attachment_not_ready")
    assert client.submission_log == []


@pytest.mark.parametrize("status", ["submitted", "processing", "ready_for_analysis", "failed", "cancelled"])
def test_only_a_draft_can_be_submitted(status):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, status=status, error_message="x" if status == "failed" else None)
    with pytest.raises(AppError) as caught:
        service_for(client).submit(CREATOR, sid(row))
    assert (caught.value.status_code, caught.value.code) == (409, "invalid_transition")


def test_combined_content_over_the_limit_ends_failed_with_a_reason(monkeypatch):
    monkeypatch.setattr(submissions_module, "MAX_ANALYSIS_CHARS", 50)
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, content_text=LONG_TEXT)
    add_attachment(client, row, text="y" * 100)
    result = service_for(client).submit(CREATOR, sid(row))
    assert result.status is SubmissionStatus.FAILED and "too long" in result.error_message
    assert client.submission_log == ["submitted", "processing", "failed"]


def test_concurrent_status_change_is_a_conflict_not_a_double_transition(monkeypatch):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    monkeypatch.setattr(SubmissionRepository, "transition", lambda self, *a, **k: None)
    with pytest.raises(AppError) as caught:
        service_for(client).submit(CREATOR, sid(row))
    assert (caught.value.status_code, caught.value.code) == (409, "conflict")


def test_database_failure_mid_pipeline_never_leaves_it_in_progress():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    client.fail["update:ready_for_analysis"] = RuntimeError("db hiccup")
    with pytest.raises(DatabaseError):
        service_for(client).submit(CREATOR, sid(row))
    assert client.tables["content_submissions"][0]["status"] == "failed"
    assert client.tables["content_submissions"][0]["error_message"]


# --- workflow: cancel / reopen / transition table --------------------------------------------

CANCELLABLE = {"draft", "submitted", "ready_for_analysis", "failed"}  # written out by hand


@pytest.mark.parametrize("status", [s.value for s in SubmissionStatus])
def test_cancel_follows_the_lifecycle(status):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, status=status, error_message="x" if status == "failed" else None)
    service = service_for(client)
    if status in CANCELLABLE:
        assert service.cancel(CREATOR, sid(row)).status is SubmissionStatus.CANCELLED
    else:
        with pytest.raises(AppError) as caught:
            service.cancel(CREATOR, sid(row))
        assert (caught.value.status_code, caught.value.code) == (409, "invalid_transition")


@pytest.mark.parametrize("status", [s.value for s in SubmissionStatus])
def test_only_failed_submissions_can_be_reopened(status):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, status=status, error_message="boom" if status == "failed" else None, analysis_text_length=5 if status == "ready_for_analysis" else None)
    service = service_for(client)
    if status == "failed":
        reopened = service.reopen(CREATOR, sid(row))
        assert reopened.status is SubmissionStatus.DRAFT
        assert reopened.error_message is None and reopened.submitted_at is None
    else:
        with pytest.raises(AppError) as caught:
            service.reopen(CREATOR, sid(row))
        assert caught.value.code == "invalid_transition"


def test_transition_table_matches_the_documented_lifecycle():
    expected = {
        "draft": {"submitted", "cancelled"},
        "submitted": {"processing", "failed", "cancelled"},
        "processing": {"ready_for_analysis", "failed"},
        "ready_for_analysis": {"cancelled"},
        "failed": {"draft", "cancelled"},
        "cancelled": set(),
    }
    assert {s.value: {t.value for t in ts} for s, ts in ALLOWED_TRANSITIONS.items()} == expected
    assert not can_transition(SubmissionStatus.READY_FOR_ANALYSIS, SubmissionStatus.DRAFT)
    assert not can_transition(SubmissionStatus.CANCELLED, SubmissionStatus.DRAFT)


def test_a_reopened_submission_can_be_fixed_and_submitted_again(monkeypatch):
    monkeypatch.setattr(submissions_module, "MAX_ANALYSIS_CHARS", 100)  # text 57 + attachment 100 is too long
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, content_text=LONG_TEXT)
    att = add_attachment(client, row, text="y" * 100)
    service = service_for(client)
    assert service.submit(CREATOR, sid(row)).status is SubmissionStatus.FAILED
    service.reopen(CREATOR, sid(row))
    service.remove_attachment(CREATOR, sid(row), UUID(att["id"]))
    assert service.submit(CREATOR, sid(row)).status is SubmissionStatus.READY_FOR_ANALYSIS


# --- delete ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("status", "allowed"),
    [("draft", True), ("failed", True), ("cancelled", True), ("submitted", False), ("processing", False), ("ready_for_analysis", False)],
)
def test_delete_is_allowed_only_in_deletable_states(status, allowed):
    assert {s.value for s in DELETABLE_STATUSES} == {"draft", "failed", "cancelled"}
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, status=status, error_message="x" if status == "failed" else None)
    att = add_attachment(client, row)
    service = service_for(client)
    if allowed:
        service.delete(CREATOR, sid(row))
        assert client.tables["content_submissions"] == [] and client.tables["submission_attachments"] == []
        assert client.objects == {} and client.removed == [att["storage_path"]]
    else:
        with pytest.raises(AppError) as caught:
            service.delete(CREATOR, sid(row))
        assert (caught.value.status_code, caught.value.code) == (409, "submission_locked")
        assert len(client.tables["content_submissions"]) == 1 and att["storage_path"] in client.objects


def test_delete_with_storage_failure_keeps_everything_so_it_can_be_retried():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    add_attachment(client, row)
    client.fail_remove = RuntimeError("storage down")
    service = service_for(client)
    with pytest.raises(StorageUnavailableError):
        service.delete(CREATOR, sid(row))
    assert len(client.tables["content_submissions"]) == 1 and len(client.tables["submission_attachments"]) == 1
    client.fail_remove = None
    service.delete(CREATOR, sid(row))
    assert client.tables["content_submissions"] == []


def test_delete_with_database_failure_after_object_removal_can_be_retried():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    add_attachment(client, row)
    client.fail["delete"] = RuntimeError("db down")
    service = service_for(client)
    with pytest.raises(DatabaseError):
        service.delete(CREATOR, sid(row))
    assert len(client.tables["content_submissions"]) == 1  # object already gone, rows intact
    del client.fail["delete"]
    service.delete(CREATOR, sid(row))  # removing a missing object is a no-op
    assert client.tables["content_submissions"] == []


# --- attachments: success --------------------------------------------------------------------


def attach(service, submission, data=b"Approved campaign guidance.", name="brief.txt", mime=TXT_MIME, who=CREATOR):
    return service.add_attachment(who, sid(submission), filename=name, content_type=mime, data=data)


def test_attachment_is_stored_privately_under_generated_ids_and_text_is_extracted():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    att = attach(service_for(client), row, name="../../etc/Evil Brief.txt")

    assert att.status is DocumentStatus.READY and att.extracted_text == "Approved campaign guidance."
    assert att.text_length == len("Approved campaign guidance.") and att.uploaded_by == U_CREATOR
    assert att.original_filename == "Evil Brief.txt"  # sanitised display name only
    [(bucket, path, options)] = client.uploads
    assert bucket == "submission-attachments"  # not the approved-knowledge bucket
    assert path == f"{ORG_A}/{row['id']}/{att.id}.txt"  # never the user's filename
    assert "Evil" not in path and ".." not in path
    assert options["content-type"] == TXT_MIME and options["upsert"] == "false"
    assert client.objects[path] == b"Approved campaign guidance."
    assert client.status_log == ["uploaded", "processing", "ready"]


def test_pdf_and_docx_attachments_are_extracted():
    pytest.importorskip("pypdf")
    pytest.importorskip("docx")
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    service = service_for(client)
    pdf = attach(service, row, make_pdf("PDF campaign copy"), "c.pdf", PDF_MIME)
    word = attach(service, row, make_docx(["Word campaign copy"]), "c.docx", DOCX_MIME)
    assert "PDF campaign copy" in pdf.extracted_text and "Word campaign copy" in word.extracted_text


# --- attachments: validation and processing failures -----------------------------------------


@pytest.mark.parametrize(
    ("name", "mime", "data", "status", "code"),
    [
        ("a.exe", "application/octet-stream", b"MZ", 415, "unsupported_file_type"),
        ("a.png", "image/png", b"\x89PNG", 415, "unsupported_file_type"),
        ("a.txt", TXT_MIME, b"", 400, "empty_file"),
        ("a.pdf", TXT_MIME, b"%PDF-1.4", 415, "unsupported_file_type"),
        ("a.pdf", PDF_MIME, b"not a pdf", 400, "invalid_file"),
        ("a.txt", TXT_MIME, b"bin\x00ary", 400, "invalid_file"),
        ("a.txt", TXT_MIME, b"a" * (10 * 1024 * 1024 + 1), 413, "file_too_large"),
    ],
)
def test_invalid_attachments_are_rejected_before_anything_is_stored(name, mime, data, status, code):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    with pytest.raises(AppError) as caught:
        attach(service_for(client), row, data, name, mime)
    assert (caught.value.status_code, caught.value.code) == (status, code)
    assert client.objects == {} and client.tables.get("submission_attachments", []) == []


def test_corrupt_unreadable_and_empty_documents_are_kept_as_failed_with_a_safe_reason():
    pytest.importorskip("pypdf")
    pytest.importorskip("docx")
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    service = service_for(client)
    corrupt = attach(service, row, b"%PDF-1.4\nbroken", "b.pdf", PDF_MIME)
    bad_docx = attach(service, row, b"PK\x03\x04" + b"garbage" * 10, "b.docx", DOCX_MIME)
    blank = attach(service, row, b"  \n ", "blank.txt", TXT_MIME)
    for att in (corrupt, bad_docx, blank):
        assert att.status is DocumentStatus.FAILED and att.extracted_text is None and att.error_message
    assert "corrupt" in corrupt.error_message and "No extractable text" in blank.error_message
    assert len(client.objects) == 3  # kept so the user can see why and remove them


def test_password_protected_pdf_is_failed_not_an_error():
    pypdf = pytest.importorskip("pypdf")
    import io

    writer = pypdf.PdfWriter()
    writer.add_blank_page(612, 792)
    try:
        writer.encrypt("secret", algorithm="RC4-128")
    except Exception:
        pytest.skip("this pypdf cannot create encrypted test PDFs")
    buffer = io.BytesIO()
    writer.write(buffer)
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    att = attach(service_for(client), row, buffer.getvalue(), "locked.pdf", PDF_MIME)
    assert att.status is DocumentStatus.FAILED and "password" in att.error_message


def test_a_failed_attachment_blocks_submit_until_it_is_removed():
    pytest.importorskip("pypdf")
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    service = service_for(client)
    bad = attach(service, row, b"%PDF-1.4\nbroken", "b.pdf", PDF_MIME)
    with pytest.raises(AppError) as caught:
        service.submit(CREATOR, sid(row))
    assert caught.value.code == "attachment_failed"
    service.remove_attachment(CREATOR, sid(row), bad.id)
    assert service.submit(CREATOR, sid(row)).status is SubmissionStatus.READY_FOR_ANALYSIS


def test_attachment_count_is_limited():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    service = service_for(client)
    for n in range(MAX_ATTACHMENTS):
        attach(service, row, f"doc {n}".encode(), f"d{n}.txt")
    with pytest.raises(AppError) as caught:
        attach(service, row, b"one too many")
    assert (caught.value.status_code, caught.value.code) == (409, "too_many_attachments")
    assert len(client.objects) == MAX_ATTACHMENTS


@pytest.mark.parametrize("status", ["submitted", "processing", "ready_for_analysis", "failed", "cancelled"])
def test_attachments_can_only_be_added_to_drafts(status):
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, status=status, error_message="x" if status == "failed" else None)
    with pytest.raises(AppError) as caught:
        attach(service_for(client), row)
    assert (caught.value.status_code, caught.value.code) == (409, "submission_locked")
    assert client.objects == {}


# --- attachments: storage / database failure cleanup -----------------------------------------


def test_storage_upload_failure_is_a_502_and_leaves_no_row():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    client.fail_upload = RuntimeError("storage exploded: https://internal.example/secret")
    with pytest.raises(StorageUnavailableError) as caught:
        attach(service_for(client), row)
    assert caught.value.status_code == 502 and "exploded" not in caught.value.message
    assert client.tables.get("submission_attachments", []) == []


def test_database_insert_failure_removes_the_stored_object():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    client.fail["insert"] = RuntimeError("db down")
    with pytest.raises(DatabaseError):
        attach(service_for(client), row)
    assert client.objects == {} and len(client.removed) == 1


def test_cleanup_failure_does_not_hide_the_original_database_error():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    client.fail["insert"] = RuntimeError("db down")
    client.fail_remove = RuntimeError("remove down too")
    with pytest.raises(DatabaseError):
        attach(service_for(client), row)


def test_database_guard_rejects_an_attachment_on_a_locked_submission_and_cleans_up(monkeypatch):
    """Even if the service's own draft check were bypassed (a race, or a bug), the database
    trigger refuses the row, and the stored object is removed again."""
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, status="submitted")
    monkeypatch.setattr(SubmissionService, "_require_editable", staticmethod(lambda record: None))
    with pytest.raises(InvalidDataError):
        attach(service_for(client), row)
    assert client.objects == {} and client.tables.get("submission_attachments", []) == []


def test_database_failure_while_processing_marks_the_attachment_failed():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    client.fail["update:ready"] = RuntimeError("db hiccup")
    with pytest.raises(DatabaseError):
        attach(service_for(client), row)
    [stored] = client.tables["submission_attachments"]
    assert stored["status"] == "failed"  # never left looking "in progress"


# --- attachments: removal and cross-boundary access ------------------------------------------


def test_remove_attachment_deletes_object_and_row():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR)
    att = add_attachment(client, row)
    service_for(client).remove_attachment(CREATOR, sid(row), UUID(att["id"]))
    assert client.tables["submission_attachments"] == [] and client.objects == {}


def test_remove_attachment_cannot_cross_submissions_or_organisations():
    client = FakeSupabase()
    mine = add_submission(client, ORG_A, U_CREATOR)
    other_sub = add_submission(client, ORG_A, U_CREATOR)
    theirs = add_submission(client, ORG_B, U_B)
    att_other = add_attachment(client, other_sub)
    att_theirs = add_attachment(client, theirs)
    service = service_for(client)
    for attachment in (att_other, att_theirs):  # id exists, but not under this submission
        with pytest.raises(AppError) as caught:
            service.remove_attachment(CREATOR, sid(mine), UUID(attachment["id"]))
        assert caught.value.status_code == 404
    with pytest.raises(AppError):  # a submission id from another organisation
        service.remove_attachment(CREATOR, sid(theirs), UUID(att_theirs["id"]))
    assert len(client.tables["submission_attachments"]) == 2 and len(client.objects) == 2


def test_remove_attachment_only_while_a_draft():
    client = FakeSupabase()
    row = add_submission(client, ORG_A, U_CREATOR, status="ready_for_analysis", analysis_text_length=5)
    att = add_attachment(client, row)
    with pytest.raises(AppError) as caught:
        service_for(client).remove_attachment(CREATOR, sid(row), UUID(att["id"]))
    assert caught.value.code == "submission_locked" and att["storage_path"] in client.objects
