"""Content submissions HTTP API: authentication, roles, ownership/organisation isolation,
validation, the full workflow and attachment uploads.

MOCKED: FakeSupabase replaces the database and Storage, and token verification is overridden
(covered by test_auth_verification.py). Attachment uploads need `python-multipart` on the server
side; those tests skip with a clear reason if it is not installed.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient  # noqa: E402
from knowledge_helpers import (  # noqa: E402
    PDF_MIME,
    TXT_MIME,
    FakeSupabase,
    add_attachment,
    add_submission,
    membership_row,
)

from app.api.deps import get_current_user, get_organisation_access_service  # noqa: E402
from app.api.v1.submissions import get_submission_service  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.knowledge import MAX_UPLOAD_BYTES  # noqa: E402
from app.repositories.submission_attachments import AttachmentRepository  # noqa: E402
from app.repositories.submissions import SubmissionRepository  # noqa: E402
from app.services.auth import AuthenticatedUser  # noqa: E402
from app.services.knowledge_storage import KnowledgeStorage  # noqa: E402
from app.services.organisation_access import OrganisationAccessService  # noqa: E402
from app.services.submissions import SubmissionService  # noqa: E402

BASE = "/api/v1/submissions"
ORG_A, ORG_B = uuid4(), uuid4()
USER, OTHER_USER = uuid4(), uuid4()
GOOD = {"title": "Autumn launch email", "content_type": "email_newsletter",
        "content_text": "Meet Orbit Insights: reporting that finally makes sense."}


def need_multipart() -> None:
    try:
        import python_multipart  # noqa: F401
    except ImportError:
        pytest.importorskip("multipart", reason="python-multipart is required to parse uploads")


def build(role: str = "creator", *, memberships: list[dict] | None = None, user=USER):
    rows = memberships if memberships is not None else [membership_row(ORG_A, user, role)]
    fake = FakeSupabase(rows)
    app = create_app(Settings.from_env({"APP_ENV": "test"}))
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=user)
    app.dependency_overrides[get_organisation_access_service] = lambda: OrganisationAccessService(client=fake)
    app.dependency_overrides[get_submission_service] = lambda: SubmissionService(
        SubmissionRepository(fake), AttachmentRepository(fake), KnowledgeStorage(fake, "submission-attachments")
    )
    return TestClient(app), fake


def error(response, status, code):
    assert response.status_code == status, response.text
    body = response.json()["error"]
    assert body["code"] == code and body["message"] and "request_id" in body


def attach(client, submission_id, name="brief.txt", data=b"Approved campaign guidance.", mime=TXT_MIME, **form):
    return client.post(f"{BASE}/{submission_id}/attachments", files={"file": (name, data, mime)}, data=form)


# --- authentication --------------------------------------------------------------------------


def test_every_endpoint_requires_a_token():
    client = TestClient(create_app(Settings.from_env({"APP_ENV": "test"})))  # real verifier
    sid = uuid4()
    for method, url in (
        ("GET", BASE), ("POST", BASE), ("GET", f"{BASE}/{sid}"), ("PATCH", f"{BASE}/{sid}"),
        ("DELETE", f"{BASE}/{sid}"), ("POST", f"{BASE}/{sid}/submit"), ("POST", f"{BASE}/{sid}/cancel"),
        ("POST", f"{BASE}/{sid}/reopen"), ("POST", f"{BASE}/{sid}/attachments"),
        ("DELETE", f"{BASE}/{sid}/attachments/{uuid4()}"),
    ):
        response = client.request(method, url)
        assert response.status_code == 401, (method, url)
        assert response.headers["www-authenticate"] == "Bearer"


def test_users_without_an_active_membership_are_forbidden():
    for rows in ([], [membership_row(ORG_A, USER, "owner", status="suspended")]):
        client, fake = build(memberships=rows)
        assert client.get(BASE).status_code == 403
        assert client.post(BASE, json=GOOD).status_code == 403
        assert fake.tables.get("content_submissions", []) == []


# --- role permissions ------------------------------------------------------------------------


@pytest.mark.parametrize(("role", "allowed"), [("owner", True), ("admin", True), ("creator", True), ("reviewer", False)])
def test_only_owners_admins_and_creators_can_create(role, allowed):
    client, fake = build(role)
    response = client.post(BASE, json=GOOD)
    if allowed:
        assert response.status_code == 201 and response.json()["status"] == "draft"
    else:
        error(response, 403, "forbidden")
        assert fake.tables.get("content_submissions", []) == []


@pytest.mark.parametrize("role", ["owner", "admin", "creator", "reviewer"])
def test_every_role_can_list_and_read_what_it_may_see(role):
    client, fake = build(role)
    row = add_submission(fake, ORG_A, USER)  # the caller's own, so every role may read it
    assert client.get(BASE).json()["total"] == 1
    assert client.get(f"{BASE}/{row['id']}").status_code == 200


def test_reviewers_can_read_everyones_submissions_but_change_none():
    client, fake = build("reviewer")
    row = add_submission(fake, ORG_A, OTHER_USER)
    assert client.get(f"{BASE}/{row['id']}").status_code == 200
    for method, url, kwargs in (
        ("PATCH", f"{BASE}/{row['id']}", {"json": {"title": "Changed"}}),
        ("DELETE", f"{BASE}/{row['id']}", {}),
        ("POST", f"{BASE}/{row['id']}/submit", {}),
        ("POST", f"{BASE}/{row['id']}/cancel", {}),
        ("POST", f"{BASE}/{row['id']}/reopen", {}),
        ("POST", f"{BASE}/{row['id']}/attachments", {"files": {"file": ("a.txt", b"x", TXT_MIME)}}),
        ("DELETE", f"{BASE}/{row['id']}/attachments/{uuid4()}", {}),
    ):
        error(client.request(method, url, **kwargs), 403, "forbidden")
    assert fake.objects == {} and fake.tables["content_submissions"][0]["title"] == row["title"]


# --- create ----------------------------------------------------------------------------------


def test_create_returns_a_draft_owned_by_the_caller():
    client, fake = build()
    response = client.post(BASE, json={**GOOD, "campaign_name": "  Autumn  ", "platform": "", "publishing_date": "2026-12-01"})
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "draft" and body["submitted_by"] == str(USER)
    assert body["title"] == GOOD["title"] and body["content_text"] == GOOD["content_text"]
    assert body["campaign_name"] == "Autumn" and body["platform"] is None  # trimmed / blank -> null
    assert body["publishing_date"] == "2026-12-01" and body["attachments"] == []
    assert "organisation_id" not in body
    [row] = fake.tables["content_submissions"]
    assert row["organisation_id"] == str(ORG_A) and row["submitted_by"] == str(USER)


@pytest.mark.parametrize("extra", [
    {"organisation_id": str(ORG_B)}, {"submitted_by": str(uuid4())}, {"status": "ready_for_analysis"},
    {"id": str(uuid4())}, {"created_at": "2020-01-01T00:00:00Z"},
])
def test_server_owned_fields_in_the_body_are_rejected(extra):
    client, fake = build()
    error(client.post(BASE, json={**GOOD, **extra}), 422, "validation_error")
    error(client.patch(f"{BASE}/{add_submission(fake, ORG_A, USER)['id']}", json=extra), 422, "validation_error")
    assert len(fake.tables["content_submissions"]) == 1  # only the seeded one


@pytest.mark.parametrize("payload", [
    {}, {"title": ""}, {"title": "   "}, {"title": "ab"}, {"title": "x" * 121},
    {**GOOD, "content_text": "x" * 20001}, {**GOOD, "content_type": "podcast"},
    {**GOOD, "publishing_date": "next tuesday"}, {**GOOD, "campaign_name": "x" * 101},
    {**GOOD, "reviewer_context": "x" * 1001}, {**GOOD, "title": None}, {**GOOD, "content_text": None},
])
def test_invalid_input_is_a_422_and_nothing_is_saved(payload):
    client, fake = build()
    error(client.post(BASE, json=payload), 422, "validation_error")
    assert fake.tables.get("content_submissions", []) == []


def test_malformed_json_is_a_422():
    client, _ = build()
    response = client.post(BASE, content=b"{not json", headers={"Content-Type": "application/json"})
    assert response.status_code == 422


# --- list: pagination, filters, visibility ---------------------------------------------------


def seeded():
    client, fake = build("admin")
    rows = [
        add_submission(fake, ORG_A, USER, title="Alpha post", content_type="social_post"),
        add_submission(fake, ORG_A, OTHER_USER, title="Beta email", content_type="email_newsletter", status="cancelled"),
        add_submission(fake, ORG_A, OTHER_USER, title="Gamma 50% off", content_type="ad_copy"),
        add_submission(fake, ORG_B, uuid4(), title="Other organisation"),
    ]
    return client, fake, rows


def test_list_pagination_and_totals():
    client, _, _ = seeded()
    page = client.get(BASE, params={"limit": 2, "offset": 0}).json()
    assert [i["title"] for i in page["items"]] == ["Gamma 50% off", "Beta email"]
    assert (page["total"], page["limit"], page["offset"]) == (3, 2, 0)
    assert [i["title"] for i in client.get(BASE, params={"limit": 2, "offset": 2}).json()["items"]] == ["Alpha post"]
    assert client.get(BASE).json()["limit"] == 20  # default page size


def test_list_filters():
    client, _, _ = seeded()
    titles = lambda **p: [i["title"] for i in client.get(BASE, params=p).json()["items"]]  # noqa: E731
    assert titles(status="cancelled") == ["Beta email"]
    assert titles(content_type="ad_copy") == ["Gamma 50% off"]
    assert titles(q="ALPHA") == ["Alpha post"]
    assert titles(q="50%") == ["Gamma 50% off"]  # LIKE wildcards are literal
    assert titles(mine="true") == ["Alpha post"]
    assert titles(status="draft", content_type="social_post", q="alp") == ["Alpha post"]


def test_list_items_carry_no_typed_content_or_attachment_data():
    client, _, _ = seeded()
    for item in client.get(BASE).json()["items"]:
        assert "content_text" not in item and "attachments" not in item and "reviewer_context" not in item


@pytest.mark.parametrize("params", [
    {"limit": 0}, {"limit": 101}, {"offset": -1}, {"status": "approved"}, {"content_type": "podcast"},
    {"q": "x" * 101}, {"mine": "maybe"},
])
def test_invalid_list_parameters_are_422(params):
    client, _, _ = seeded()
    error(client.get(BASE, params=params), 422, "validation_error")


def test_creators_see_only_their_own_submissions():
    client, fake = build("creator")
    mine = add_submission(fake, ORG_A, USER, title="Mine")
    add_submission(fake, ORG_A, OTHER_USER, title="Someone else's")
    body = client.get(BASE).json()
    assert [i["id"] for i in body["items"]] == [mine["id"]] and body["total"] == 1


# --- organisation isolation and IDOR ---------------------------------------------------------


def test_other_organisations_submissions_look_like_they_do_not_exist():
    need_multipart()  # the attachment upload below is parsed before the 404 is decided
    client, fake = build("owner")
    theirs = add_submission(fake, ORG_B, uuid4())
    sid = theirs["id"]
    for method, url, kwargs in (
        ("GET", f"{BASE}/{sid}", {}), ("PATCH", f"{BASE}/{sid}", {"json": {"title": "Changed"}}),
        ("DELETE", f"{BASE}/{sid}", {}), ("POST", f"{BASE}/{sid}/submit", {}),
        ("POST", f"{BASE}/{sid}/cancel", {}), ("POST", f"{BASE}/{sid}/reopen", {}),
        ("POST", f"{BASE}/{sid}/attachments", {"files": {"file": ("a.txt", b"x", TXT_MIME)}}),
        ("DELETE", f"{BASE}/{sid}/attachments/{uuid4()}", {}),
    ):
        error(client.request(method, url, **kwargs), 404, "not_found")
    assert client.get(BASE).json()["items"] == []
    assert fake.tables["content_submissions"] == [theirs] and fake.objects == {}


def test_a_creator_cannot_reach_another_creators_submission():
    client, fake = build("creator")
    theirs = add_submission(fake, ORG_A, OTHER_USER)
    sid = theirs["id"]
    for method, url, kwargs in (
        ("GET", f"{BASE}/{sid}", {}), ("PATCH", f"{BASE}/{sid}", {"json": {"title": "Changed"}}),
        ("DELETE", f"{BASE}/{sid}", {}), ("POST", f"{BASE}/{sid}/submit", {}),
    ):
        error(client.request(method, url, **kwargs), 404, "not_found")
    assert fake.tables["content_submissions"] == [theirs]


def test_organisation_ids_in_header_query_or_body_never_grant_access():
    client, fake = build("owner")
    theirs = add_submission(fake, ORG_B, uuid4())
    headers = {"X-Organisation-Id": str(ORG_B)}
    assert client.get(BASE, headers=headers).status_code == 403
    assert client.get(f"{BASE}/{theirs['id']}", headers=headers).status_code == 403
    assert client.get(BASE, params={"organisation_id": str(ORG_B)}).json()["items"] == []


def test_member_of_two_organisations_sees_only_the_selected_one():
    client, fake = build(memberships=[membership_row(ORG_A, USER, "admin"), membership_row(ORG_B, USER, "creator")])
    in_a, in_b = add_submission(fake, ORG_A, uuid4()), add_submission(fake, ORG_B, USER)
    error(client.get(BASE), 400, "organisation_required")
    ids = lambda org: [i["id"] for i in client.get(BASE, headers={"X-Organisation-Id": str(org)}).json()["items"]]  # noqa: E731
    assert ids(ORG_A) == [in_a["id"]] and ids(ORG_B) == [in_b["id"]]


# --- get / update ----------------------------------------------------------------------------


def test_get_returns_content_and_attachment_metadata_without_paths_or_text():
    client, fake = build()
    row = add_submission(fake, ORG_A, USER)
    add_attachment(fake, row, text="secret extracted text")
    body = client.get(f"{BASE}/{row['id']}").json()
    assert body["content_text"] == row["content_text"]
    [att] = body["attachments"]
    assert att["original_filename"] == "notes.txt" and att["status"] == "ready"
    assert "storage_path" not in att and "extracted_text" not in att
    assert "secret extracted text" not in client.get(f"{BASE}/{row['id']}").text


def test_unknown_id_is_404_and_malformed_id_is_422():
    client, _ = build()
    error(client.get(f"{BASE}/{uuid4()}"), 404, "not_found")
    error(client.get(f"{BASE}/not-a-uuid"), 422, "validation_error")


def test_patch_changes_only_the_sent_fields_and_can_clear_optional_ones():
    client, fake = build()
    row = add_submission(fake, ORG_A, USER, campaign_name="Old")
    body = client.patch(f"{BASE}/{row['id']}", json={"platform": "LinkedIn", "campaign_name": None}).json()
    assert body["platform"] == "LinkedIn" and body["campaign_name"] is None
    assert body["title"] == row["title"] and body["content_text"] == row["content_text"]


def test_patch_cannot_null_the_title_or_content():
    client, fake = build()
    row = add_submission(fake, ORG_A, USER)
    error(client.patch(f"{BASE}/{row['id']}", json={"title": None}), 422, "validation_error")
    error(client.patch(f"{BASE}/{row['id']}", json={"content_text": None}), 422, "validation_error")


# --- workflow --------------------------------------------------------------------------------


def test_full_workflow_over_http_ends_ready_for_analysis_with_no_analysis():
    need_multipart()
    client, fake = build()
    created = client.post(BASE, json={**GOOD, "content_text": "short"}).json()
    sid = created["id"]
    assert attach(client, sid, data=b"The approved launch brief with plenty of detail.").status_code == 201

    submitted = client.post(f"{BASE}/{sid}/submit")
    assert submitted.status_code == 200
    body = submitted.json()
    assert body["status"] == "ready_for_analysis" and body["analysis_text_length"] > 0
    assert body["submitted_at"] and body["processed_at"] and body["error_message"] is None
    assert fake.submission_log == ["draft", "submitted", "processing", "ready_for_analysis"]
    for forbidden in ("analysis_result", "claims", "score", "approved", "verdict"):
        assert forbidden not in submitted.text.lower()


def test_a_submitted_submission_is_locked():
    client, fake = build()
    row = add_submission(fake, ORG_A, USER, status="ready_for_analysis", analysis_text_length=60)
    error(client.patch(f"{BASE}/{row['id']}", json={"title": "Changed"}), 409, "submission_locked")
    error(client.delete(f"{BASE}/{row['id']}"), 409, "submission_locked")
    error(client.post(f"{BASE}/{row['id']}/submit"), 409, "invalid_transition")
    error(client.post(f"{BASE}/{row['id']}/reopen"), 409, "invalid_transition")
    assert fake.tables["content_submissions"][0]["status"] == "ready_for_analysis"


def test_submit_validation_errors():
    client, fake = build()
    no_type = add_submission(fake, ORG_A, USER, content_type=None)
    short = add_submission(fake, ORG_A, USER, content_text="tiny")
    error(client.post(f"{BASE}/{no_type['id']}/submit"), 422, "invalid_submission")
    error(client.post(f"{BASE}/{short['id']}/submit"), 422, "invalid_submission")
    assert fake.submission_log == []


def test_cancel_and_reopen_flow():
    client, fake = build()
    draft = add_submission(fake, ORG_A, USER)
    assert client.post(f"{BASE}/{draft['id']}/cancel").json()["status"] == "cancelled"
    error(client.post(f"{BASE}/{draft['id']}/cancel"), 409, "invalid_transition")  # terminal
    failed = add_submission(fake, ORG_A, USER, status="failed", error_message="Too long")
    reopened = client.post(f"{BASE}/{failed['id']}/reopen").json()
    assert reopened["status"] == "draft" and reopened["error_message"] is None


def test_delete_a_draft_removes_its_attachments_and_objects():
    client, fake = build()
    row = add_submission(fake, ORG_A, USER)
    add_attachment(fake, row)
    response = client.delete(f"{BASE}/{row['id']}")
    assert response.status_code == 204 and response.content == b""
    assert fake.objects == {} and fake.tables["content_submissions"] == []
    error(client.get(f"{BASE}/{row['id']}"), 404, "not_found")


# --- attachments -----------------------------------------------------------------------------


def test_attachment_upload_returns_metadata_only():
    need_multipart()
    client, fake = build()
    row = add_submission(fake, ORG_A, USER)
    response = attach(client, row["id"], name="../Brief Final.txt", organisation_id=str(ORG_B))
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ready" and body["original_filename"] == "Brief Final.txt"
    assert body["text_length"] == len("Approved campaign guidance.")
    for forbidden in ("storage_path", "extracted_text", "organisation_id"):
        assert forbidden not in body
    [(bucket, path, _)] = fake.uploads
    assert bucket == "submission-attachments" and path == f"{ORG_A}/{row['id']}/{body['id']}.txt"
    stored = fake.tables["submission_attachments"][0]
    assert stored["organisation_id"] == str(ORG_A)  # the form's organisation id was ignored


def test_attachment_validation_errors():
    need_multipart()
    client, fake = build()
    sid = add_submission(fake, ORG_A, USER)["id"]
    error(attach(client, sid, "evil.exe", b"MZ", "application/octet-stream"), 415, "unsupported_file_type")
    error(attach(client, sid, "pic.png", b"\x89PNG", "image/png"), 415, "unsupported_file_type")
    error(attach(client, sid, "a.txt", b""), 400, "empty_file")
    error(attach(client, sid, "a.pdf", b"just text", PDF_MIME), 400, "invalid_file")
    error(attach(client, sid, "a.txt", b"a" * (MAX_UPLOAD_BYTES + 1)), 413, "file_too_large")
    error(attach(client, sid, "a.txt", b"a" * (MAX_UPLOAD_BYTES + 200 * 1024)), 413, "file_too_large")
    error(client.post(f"{BASE}/{sid}/attachments", data={"note": "no file"}), 400, "bad_request")
    assert fake.objects == {} and fake.tables.get("submission_attachments", []) == []


def test_corrupt_attachment_is_kept_as_failed_and_blocks_submit_until_removed():
    need_multipart()
    pytest.importorskip("pypdf")
    client, fake = build()
    sid = add_submission(fake, ORG_A, USER)["id"]
    response = attach(client, sid, "broken.pdf", b"%PDF-1.4\nnot really a pdf", PDF_MIME)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "failed" and body["error_message"].startswith("The document could not be read")
    error(client.post(f"{BASE}/{sid}/submit"), 409, "attachment_failed")
    assert client.delete(f"{BASE}/{sid}/attachments/{body['id']}").status_code == 204
    assert client.post(f"{BASE}/{sid}/submit").status_code == 200


def test_attachments_are_refused_once_submitted_and_for_other_users():
    need_multipart()
    client, fake = build()
    locked = add_submission(fake, ORG_A, USER, status="submitted")
    error(attach(client, locked["id"]), 409, "submission_locked")
    theirs = add_submission(fake, ORG_A, OTHER_USER)
    error(attach(client, theirs["id"]), 404, "not_found")
    assert fake.objects == {}


def test_attachment_delete_is_scoped_and_idempotent_to_404():
    client, fake = build()
    row, other = add_submission(fake, ORG_A, USER), add_submission(fake, ORG_A, USER)
    att = add_attachment(fake, row)
    error(client.delete(f"{BASE}/{other['id']}/attachments/{att['id']}"), 404, "not_found")  # wrong submission
    assert client.delete(f"{BASE}/{row['id']}/attachments/{att['id']}").status_code == 204
    error(client.delete(f"{BASE}/{row['id']}/attachments/{att['id']}"), 404, "not_found")
    assert fake.objects == {}


# --- infrastructure failures -----------------------------------------------------------------


def test_storage_failure_on_upload_is_a_structured_502_without_leaking_details():
    need_multipart()
    client, fake = build()
    sid = add_submission(fake, ORG_A, USER)["id"]
    fake.fail_upload = RuntimeError("storage exploded: https://internal.example/secret")
    response = attach(client, sid)
    error(response, 502, "storage_unavailable")
    assert "exploded" not in response.text and "internal.example" not in response.text
    assert fake.tables.get("submission_attachments", []) == []


def test_database_failure_on_upload_is_a_500_and_the_object_is_cleaned_up():
    need_multipart()
    client, fake = build()
    sid = add_submission(fake, ORG_A, USER)["id"]
    fake.fail["insert"] = RuntimeError("password authentication failed for user postgres")
    response = attach(client, sid)
    error(response, 500, "database_error")
    assert "password" not in response.text and fake.objects == {}


def test_database_failure_on_create_is_a_500_without_leaking_details():
    client, fake = build()
    fake.fail["insert"] = RuntimeError("connection to 10.0.0.5 refused")
    response = client.post(BASE, json=GOOD)
    error(response, 500, "database_error")
    assert "10.0.0.5" not in response.text


def test_delete_storage_failure_keeps_the_submission():
    client, fake = build()
    row = add_submission(fake, ORG_A, USER)
    add_attachment(fake, row)
    fake.fail_remove = RuntimeError("storage down")
    error(client.delete(f"{BASE}/{row['id']}"), 502, "storage_unavailable")
    assert len(fake.tables["content_submissions"]) == 1
    fake.fail_remove = None
    assert client.delete(f"{BASE}/{row['id']}").status_code == 204


def test_database_not_configured_fails_closed_with_503():
    app = create_app(Settings.from_env({"APP_ENV": "test"}))  # no Supabase credentials
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=USER)
    error(TestClient(app).get(BASE), 503, "integration_not_configured")


def test_responses_never_expose_urls_or_credentials():
    need_multipart()
    client, fake = build()
    sid = client.post(BASE, json=GOOD).json()["id"]
    attach(client, sid)
    for text in (client.get(BASE).text, client.get(f"{BASE}/{sid}").text):
        for forbidden in ("http", "signed", "token", "storage_path", "service_role"):
            assert forbidden not in text.lower(), forbidden
