"""Knowledge Hub HTTP API: authentication, roles, organisation isolation, upload/list/get/delete.

MOCKED: FakeSupabase replaces the database and Storage, and token verification is overridden
(covered by test_auth_verification.py). Uploads need `python-multipart` on the server side; the
tests that send files skip with a clear reason if it is not installed.
"""

from __future__ import annotations

from uuid import uuid4

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("httpx")

from fastapi.testclient import TestClient  # noqa: E402
from knowledge_helpers import (  # noqa: E402
    DOCX_MIME,
    PDF_MIME,
    TXT_MIME,
    FakeSupabase,
    make_docx,
    make_pdf,
    membership_row,
)

from app.api.deps import get_current_user, get_organisation_access_service  # noqa: E402
from app.api.v1.knowledge import get_knowledge_service  # noqa: E402
from app.core.config import Settings  # noqa: E402
from app.main import create_app  # noqa: E402
from app.models.knowledge import MAX_UPLOAD_BYTES  # noqa: E402
from app.repositories.knowledge_documents import KnowledgeDocumentRepository  # noqa: E402
from app.services.auth import AuthenticatedUser  # noqa: E402
from app.services.knowledge import KnowledgeService  # noqa: E402
from app.services.knowledge_storage import KnowledgeStorage  # noqa: E402
from app.services.organisation_access import OrganisationAccessService  # noqa: E402

BASE = "/api/v1/knowledge/documents"
ORG_A, ORG_B = uuid4(), uuid4()
USER = uuid4()


def need_multipart() -> None:
    try:
        import python_multipart  # noqa: F401
    except ImportError:
        pytest.importorskip("multipart", reason="python-multipart is required to parse uploads")


def build(role: str = "admin", *, memberships: list[dict] | None = None, user=USER):
    """An app whose caller is `user`, with the given memberships and an in-memory backend."""
    rows = memberships if memberships is not None else [membership_row(ORG_A, user, role)]
    fake = FakeSupabase(rows)
    app = create_app(Settings.from_env({"APP_ENV": "test"}))
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=user)
    app.dependency_overrides[get_organisation_access_service] = lambda: OrganisationAccessService(
        client=fake
    )
    app.dependency_overrides[get_knowledge_service] = lambda: KnowledgeService(
        KnowledgeDocumentRepository(fake), KnowledgeStorage(fake)
    )
    return TestClient(app), fake


def post_file(client, name="brand.txt", data=b"Always be kind.", mime=TXT_MIME, **form):
    return client.post(BASE, files={"file": (name, data, mime)}, data=form)


def assert_error(response, status, code):
    assert response.status_code == status, response.text
    error = response.json()["error"]
    assert error["code"] == code
    assert error["message"] and "request_id" in error


# --- authentication --------------------------------------------------------------------------


def test_every_endpoint_requires_a_token():
    # No overrides: the real verifier rejects requests without credentials.
    client = TestClient(create_app(Settings.from_env({"APP_ENV": "test"})))
    doc = uuid4()
    for method, url in (
        ("GET", BASE),
        ("GET", f"{BASE}/{doc}"),
        ("POST", BASE),
        ("DELETE", f"{BASE}/{doc}"),
    ):
        response = client.request(method, url)
        assert response.status_code == 401, (method, url)
        assert response.headers["www-authenticate"] == "Bearer"


def test_users_without_an_active_membership_are_forbidden():
    for rows in ([], [membership_row(ORG_A, USER, "owner", status="suspended")]):
        client, fake = build(memberships=rows)
        assert client.get(BASE).status_code == 403
        assert client.delete(f"{BASE}/{uuid4()}").status_code == 403
        assert post_file(client).status_code == 403
        assert fake.objects == {}


def test_database_not_configured_fails_closed_with_503():
    app = create_app(Settings.from_env({"APP_ENV": "test"}))  # no Supabase credentials
    app.dependency_overrides[get_current_user] = lambda: AuthenticatedUser(user_id=USER)
    response = TestClient(app).get(BASE)
    assert_error(response, 503, "integration_not_configured")


# --- role permissions ------------------------------------------------------------------------


@pytest.mark.parametrize("role", ["owner", "admin", "reviewer", "creator"])
def test_every_role_can_list_and_read(role):
    client, fake = build(role)
    doc = fake.add_document(ORG_A, text="approved guidance")
    assert client.get(BASE).status_code == 200
    detail = client.get(f"{BASE}/{doc['id']}")
    assert detail.status_code == 200 and detail.json()["text_preview"] == "approved guidance"


@pytest.mark.parametrize(("role", "allowed"), [("owner", True), ("admin", True), ("reviewer", False), ("creator", False)])
def test_only_owners_and_admins_can_delete(role, allowed):
    client, fake = build(role)
    doc = fake.add_document(ORG_A)
    response = client.delete(f"{BASE}/{doc['id']}")
    if allowed:
        assert response.status_code == 204
        assert fake.objects == {}
    else:
        assert_error(response, 403, "forbidden")
        assert len(fake.tables["knowledge_documents"]) == 1 and doc["storage_path"] in fake.objects


@pytest.mark.parametrize("role", ["reviewer", "creator"])
def test_reviewers_and_creators_cannot_upload_and_nothing_is_stored(role):
    client, fake = build(role)
    response = post_file(client)
    assert_error(response, 403, "forbidden")
    assert fake.objects == {} and fake.tables.get("knowledge_documents", []) == []


@pytest.mark.parametrize("role", ["owner", "admin"])
def test_owners_and_admins_can_upload(role):
    need_multipart()
    client, fake = build(role)
    assert post_file(client).status_code == 201
    assert len(fake.objects) == 1


# --- upload: success -------------------------------------------------------------------------


def test_upload_txt_returns_metadata_and_a_text_preview_but_no_path_or_full_text():
    need_multipart()
    client, fake = build()
    response = post_file(client, name="../Voice Guide.txt", data=b"Always be kind.")
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "ready"
    assert body["original_filename"] == "Voice Guide.txt"
    assert body["mime_type"] == TXT_MIME and body["size_bytes"] == len(b"Always be kind.")
    assert body["text_length"] == len("Always be kind.") and body["text_preview"] == "Always be kind."
    assert body["uploaded_by"] == str(USER)
    assert "storage_path" not in body and "extracted_text" not in body and "organisation_id" not in body

    [(bucket, path, _)] = fake.uploads
    assert bucket == "knowledge-documents" and path == f"{ORG_A}/{body['id']}.txt"


def test_upload_pdf_and_docx():
    need_multipart()
    pytest.importorskip("pypdf")
    pytest.importorskip("docx")
    client, _ = build()
    pdf = post_file(client, "rules.pdf", make_pdf("Use plain language"), PDF_MIME)
    word = post_file(client, "rules.docx", make_docx(["Use warm language"]), DOCX_MIME)
    assert (pdf.status_code, word.status_code) == (201, 201)
    assert pdf.json()["text_preview"] == "Use plain language"
    assert word.json()["text_preview"] == "Use warm language"


def test_organisation_id_in_the_form_is_ignored_for_authorisation():
    need_multipart()
    client, fake = build()
    response = post_file(client, organisation_id=str(ORG_B), user_id=str(uuid4()))
    assert response.status_code == 201
    [row] = fake.tables["knowledge_documents"]
    assert row["organisation_id"] == str(ORG_A) and row["uploaded_by"] == str(USER)
    assert list(fake.objects) == [f"{ORG_A}/{row['id']}.txt"]


def test_responses_never_expose_urls_or_storage_credentials():
    need_multipart()
    client, fake = build()
    created = post_file(client).json()
    listing = client.get(BASE).text
    detail = client.get(f"{BASE}/{created['id']}").text
    for text in (str(created), listing, detail):
        for forbidden in ("http", "signed", "token", "storage_path", "service_role"):
            assert forbidden not in text.lower(), forbidden


# --- upload: rejected files ------------------------------------------------------------------


def test_unsupported_type_is_415_and_stores_nothing():
    need_multipart()
    client, fake = build()
    assert_error(post_file(client, "evil.exe", b"MZ...", "application/octet-stream"), 415, "unsupported_file_type")
    assert_error(post_file(client, "a.pdf", b"%PDF-1.4", TXT_MIME), 415, "unsupported_file_type")
    assert fake.objects == {}


def test_empty_file_is_400():
    need_multipart()
    client, fake = build()
    assert_error(post_file(client, data=b""), 400, "empty_file")
    assert fake.objects == {}


def test_file_over_10_mb_is_413():
    need_multipart()
    client, fake = build()
    assert_error(post_file(client, data=b"a" * (MAX_UPLOAD_BYTES + 1)), 413, "file_too_large")
    # far beyond the limit: refused from Content-Length before the body is parsed
    assert_error(post_file(client, data=b"a" * (MAX_UPLOAD_BYTES + 200 * 1024)), 413, "file_too_large")
    assert fake.objects == {}


def test_content_that_does_not_match_its_type_is_400():
    need_multipart()
    client, fake = build()
    assert_error(post_file(client, "fake.pdf", b"just text", PDF_MIME), 400, "invalid_file")
    assert fake.objects == {}


def test_corrupt_document_is_stored_as_failed_with_a_safe_reason():
    need_multipart()
    pytest.importorskip("pypdf")
    client, fake = build()
    response = post_file(client, "broken.pdf", b"%PDF-1.4\nnot really a pdf", PDF_MIME)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "failed" and body["text_preview"] is None
    assert body["error_message"] == "The document could not be read. It may be corrupt."
    assert len(fake.objects) == 1


def test_missing_file_field_is_400():
    need_multipart()
    client, _ = build()
    assert_error(client.post(BASE, data={"note": "no file here"}), 400, "bad_request")
    assert_error(client.post(BASE, files={"document": ("a.txt", b"x", TXT_MIME)}), 400, "bad_request")


# --- upload: infrastructure failures ---------------------------------------------------------


def test_storage_failure_is_a_structured_502_and_stores_no_row():
    need_multipart()
    client, fake = build()
    fake.fail_upload = RuntimeError("storage exploded: https://internal.example/secret")
    response = post_file(client)
    assert_error(response, 502, "storage_unavailable")
    assert "exploded" not in response.text and "internal.example" not in response.text
    assert fake.tables.get("knowledge_documents", []) == []


def test_database_failure_is_a_structured_500_and_the_object_is_cleaned_up():
    need_multipart()
    client, fake = build()
    fake.fail["insert"] = RuntimeError("password authentication failed for user postgres")
    response = post_file(client)
    assert_error(response, 500, "database_error")
    assert "password" not in response.text
    assert fake.objects == {}


# --- list / get ------------------------------------------------------------------------------


def test_list_returns_only_this_organisations_documents_newest_first_without_text():
    client, fake = build()
    older = fake.add_document(ORG_A, filename="older.txt")
    newer = fake.add_document(ORG_A, filename="newer.txt")
    fake.add_document(ORG_B, filename="other-org.txt")

    # an organisation id in the query string is not consulted
    body = client.get(BASE, params={"organisation_id": str(ORG_B)}).json()
    assert [item["id"] for item in body["items"]] == [newer["id"], older["id"]]
    assert (body["limit"], body["offset"]) == (50, 0)
    for item in body["items"]:
        assert "extracted_text" not in item and "text_preview" not in item and "storage_path" not in item


def test_list_pagination_and_validation():
    client, fake = build()
    rows = [fake.add_document(ORG_A, filename=f"{n}.txt") for n in range(4)]
    page = client.get(BASE, params={"limit": 2, "offset": 1}).json()
    assert [i["id"] for i in page["items"]] == [rows[2]["id"], rows[1]["id"]]
    for params in ({"limit": 0}, {"limit": 101}, {"offset": -1}):
        assert_error(client.get(BASE, params=params), 422, "validation_error")


def test_detail_preview_is_truncated():
    client, fake = build()
    doc = fake.add_document(ORG_A, text="x" * 5000)
    body = client.get(f"{BASE}/{doc['id']}").json()
    assert body["text_length"] == 5000 and len(body["text_preview"]) == 2000


def test_unknown_document_is_404_and_a_malformed_id_is_422():
    client, _ = build()
    assert_error(client.get(f"{BASE}/{uuid4()}"), 404, "not_found")
    assert_error(client.get(f"{BASE}/not-a-uuid"), 422, "validation_error")


# --- organisation isolation ------------------------------------------------------------------


def test_documents_of_another_organisation_look_like_they_do_not_exist():
    client, fake = build("owner")
    theirs = fake.add_document(ORG_B, text="their secret")
    assert_error(client.get(f"{BASE}/{theirs['id']}"), 404, "not_found")
    assert_error(client.delete(f"{BASE}/{theirs['id']}"), 404, "not_found")
    assert client.get(BASE).json()["items"] == []
    # nothing was removed or changed
    assert len(fake.tables["knowledge_documents"]) == 1 and theirs["storage_path"] in fake.objects


def test_naming_another_organisation_in_the_header_is_forbidden():
    client, fake = build("owner")
    theirs = fake.add_document(ORG_B)
    headers = {"X-Organisation-Id": str(ORG_B)}
    assert client.get(BASE, headers=headers).status_code == 403
    assert client.get(f"{BASE}/{theirs['id']}", headers=headers).status_code == 403
    assert client.delete(f"{BASE}/{theirs['id']}", headers=headers).status_code == 403
    assert theirs["storage_path"] in fake.objects


def test_member_of_two_organisations_sees_only_the_selected_one_and_role_follows():
    memberships = [membership_row(ORG_A, USER, "admin"), membership_row(ORG_B, USER, "creator")]
    client, fake = build(memberships=memberships)
    mine, other = fake.add_document(ORG_A), fake.add_document(ORG_B)

    assert_error(client.get(BASE), 400, "organisation_required")
    in_a = client.get(BASE, headers={"X-Organisation-Id": str(ORG_A)}).json()["items"]
    in_b = client.get(BASE, headers={"X-Organisation-Id": str(ORG_B)}).json()["items"]
    assert [i["id"] for i in in_a] == [mine["id"]] and [i["id"] for i in in_b] == [other["id"]]
    # admin in A may delete; creator in B may not, even though it is the same user
    assert client.delete(f"{BASE}/{other['id']}", headers={"X-Organisation-Id": str(ORG_B)}).status_code == 403
    assert client.delete(f"{BASE}/{mine['id']}", headers={"X-Organisation-Id": str(ORG_A)}).status_code == 204


# --- delete ----------------------------------------------------------------------------------


def test_delete_removes_object_and_row_then_is_404():
    client, fake = build()
    doc = fake.add_document(ORG_A)
    response = client.delete(f"{BASE}/{doc['id']}")
    assert response.status_code == 204 and response.content == b""
    assert fake.objects == {} and fake.tables["knowledge_documents"] == []
    assert_error(client.get(f"{BASE}/{doc['id']}"), 404, "not_found")
    assert_error(client.delete(f"{BASE}/{doc['id']}"), 404, "not_found")


def test_delete_storage_failure_is_502_and_keeps_the_document():
    client, fake = build()
    doc = fake.add_document(ORG_A)
    fake.fail_remove = RuntimeError("storage down")
    assert_error(client.delete(f"{BASE}/{doc['id']}"), 502, "storage_unavailable")
    assert len(fake.tables["knowledge_documents"]) == 1
    fake.fail_remove = None
    assert client.delete(f"{BASE}/{doc['id']}").status_code == 204  # safe to retry
