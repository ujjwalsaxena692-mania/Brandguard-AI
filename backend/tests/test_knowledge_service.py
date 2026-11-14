"""Knowledge Hub: upload validation, text extraction and service behaviour.

MOCKED storage and database (see knowledge_helpers.FakeSupabase). Extraction tests use real
PDF/DOCX/TXT bytes generated in memory and the real pypdf / python-docx libraries.
"""

from __future__ import annotations

import io
import zipfile
from uuid import UUID, uuid4

import pytest
from knowledge_helpers import (
    DOCX_MIME,
    PDF_MIME,
    TXT_MIME,
    FakeSupabase,
    make_blank_pdf,
    make_docx,
    make_pdf,
    make_zip_without_document_xml,
)

from app.core.errors import AppError, DatabaseError
from app.models.knowledge import MAX_UPLOAD_BYTES, DocumentStatus
from app.models.organisation import OrganisationContext, Role
from app.repositories.knowledge_documents import KnowledgeDocumentRepository
from app.services import knowledge as knowledge_module
from app.services.knowledge import KnowledgeService
from app.services.knowledge_files import sanitize_filename, validate_upload
from app.services.knowledge_storage import KnowledgeStorage, StorageUnavailableError
from app.services.text_extraction import ExtractionError, extract_text

ORG_A, ORG_B = uuid4(), uuid4()
USER = uuid4()
CTX_A = OrganisationContext(organisation_id=ORG_A, user_id=USER, role=Role.ADMIN)
CTX_B = OrganisationContext(organisation_id=ORG_B, user_id=uuid4(), role=Role.ADMIN)


def service_for(client: FakeSupabase) -> KnowledgeService:
    return KnowledgeService(KnowledgeDocumentRepository(client), KnowledgeStorage(client))


def upload(service, data, name="brand.txt", mime=TXT_MIME, ctx=CTX_A):
    return service.upload(ctx, filename=name, content_type=mime, data=data)


# --- validation: file types ------------------------------------------------------------------


@pytest.mark.parametrize(
    ("name", "mime", "data", "extension"),
    [
        ("guide.pdf", PDF_MIME, b"%PDF-1.7 ...", "pdf"),
        ("Guide.PDF", PDF_MIME, b"junk\n%PDF-1.4", "pdf"),
        ("voice.docx", DOCX_MIME, b"PK\x03\x04rest", "docx"),
        ("notes.txt", TXT_MIME, b"plain text", "txt"),
        ("notes.txt", "text/plain; charset=utf-8", b"plain text", "txt"),
        ("notes.txt", "TEXT/PLAIN", b"plain text", "txt"),
    ],
)
def test_supported_types_are_accepted(name, mime, data, extension):
    result = validate_upload(name, mime, data)
    assert result.extension == extension


@pytest.mark.parametrize(
    "name",
    ["malware.exe", "legacy.doc", "image.png", "noextension", "report.pdf.exe", "archive.zip", ""],
)
def test_unsupported_extensions_are_rejected(name):
    with pytest.raises(AppError) as caught:
        validate_upload(name, "application/octet-stream", b"data")
    assert caught.value.status_code == 415
    assert caught.value.code == "unsupported_file_type"


def test_mime_type_must_match_the_extension():
    for name, wrong in (("a.pdf", TXT_MIME), ("a.txt", PDF_MIME), ("a.docx", PDF_MIME), ("a.pdf", "")):
        with pytest.raises(AppError) as caught:
            validate_upload(name, wrong, b"%PDF-1.4 PK\x03\x04")
        assert caught.value.status_code == 415, (name, wrong)


@pytest.mark.parametrize(
    ("name", "mime", "data"),
    [
        ("fake.pdf", PDF_MIME, b"this is really text"),
        ("fake.docx", DOCX_MIME, b"%PDF-1.4"),
        ("fake.txt", TXT_MIME, b"binary\x00data"),
    ],
)
def test_content_must_match_the_declared_type(name, mime, data):
    with pytest.raises(AppError) as caught:
        validate_upload(name, mime, data)
    assert caught.value.status_code == 400
    assert caught.value.code == "invalid_file"


# --- validation: size ------------------------------------------------------------------------


def test_empty_file_is_rejected():
    with pytest.raises(AppError) as caught:
        validate_upload("a.txt", TXT_MIME, b"")
    assert (caught.value.status_code, caught.value.code) == (400, "empty_file")


def test_file_over_the_limit_is_rejected_but_exactly_the_limit_is_accepted():
    assert MAX_UPLOAD_BYTES == 10 * 1024 * 1024
    validate_upload("a.txt", TXT_MIME, b"a" * MAX_UPLOAD_BYTES)
    with pytest.raises(AppError) as caught:
        validate_upload("a.txt", TXT_MIME, b"a" * (MAX_UPLOAD_BYTES + 1))
    assert (caught.value.status_code, caught.value.code) == (413, "file_too_large")


# --- filename sanitisation -------------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("../../etc/passwd.txt", "passwd.txt"),
        ("C:\\Users\\me\\Brand Guide.pdf", "Brand Guide.pdf"),
        ("/abs/path/file.docx", "file.docx"),
        ("a\x00b\x1f\x7fc.txt", "abc.txt"),
        ("my   spaced    name.txt", "my spaced name.txt"),
        ('we<ir>d:"name"|?*.pdf', "we_ir_d__name____.pdf"),
        (".hidden.txt", "hidden.txt"),
        ("trailing dots...", "trailing dots"),
        ("", "document"),
        (None, "document"),
        ("   ", "document"),
        ("..", "document"),
        ("Café Märkte.txt", "Café Märkte.txt"),
    ],
)
def test_filenames_are_sanitised(raw, expected):
    assert sanitize_filename(raw) == expected


def test_long_filenames_are_truncated_but_keep_their_extension():
    name = sanitize_filename("x" * 400 + ".pdf")
    assert len(name) <= 150 and name.endswith(".pdf")


# --- extraction: success for each format (real libraries) ------------------------------------


def test_txt_extraction():
    assert extract_text("txt", "Brand voice\r\n\r\n\r\n\r\nis warm — café".encode()) == (
        "Brand voice\n\nis warm — café"
    )


def test_txt_extraction_accepts_utf8_bom_and_windows_1252():
    assert extract_text("txt", b"\xef\xbb\xbfhello") == "hello"
    assert extract_text("txt", "café".encode("cp1252")) == "café"


def test_pdf_extraction():
    pytest.importorskip("pypdf")
    assert "Never use exclamation marks" in extract_text("pdf", make_pdf("Never use exclamation marks"))


def test_docx_extraction_includes_paragraphs_and_tables_in_order():
    pytest.importorskip("docx")
    text = extract_text("docx", make_docx(["Tone of voice: warm", "Second"], [["Term", "Use"], ["A", "B"]]))
    assert text.splitlines()[0] == "Tone of voice: warm"
    assert "Term | Use" in text and "A | B" in text


# --- extraction: invalid / corrupt / empty ---------------------------------------------------


def test_corrupt_pdf_is_reported_safely():
    pytest.importorskip("pypdf")
    with pytest.raises(ExtractionError) as caught:
        extract_text("pdf", b"%PDF-1.4\nthis is not a real pdf")
    assert "could not be read" in caught.value.reason


def test_truncated_pdf_is_reported_safely():
    pytest.importorskip("pypdf")
    with pytest.raises(ExtractionError):
        extract_text("pdf", make_pdf("hello")[:60])


def test_pdf_without_text_is_reported():
    pytest.importorskip("pypdf")
    with pytest.raises(ExtractionError) as caught:
        extract_text("pdf", make_blank_pdf())
    assert "No extractable text" in caught.value.reason


def test_corrupt_and_foreign_docx_are_reported_safely():
    pytest.importorskip("docx")
    for data in (b"PK\x03\x04" + b"garbage" * 10, make_zip_without_document_xml()):
        with pytest.raises(ExtractionError) as caught:
            extract_text("docx", data)
        assert "could not be read" in caught.value.reason


def test_empty_docx_and_whitespace_txt_have_no_text():
    pytest.importorskip("docx")
    with pytest.raises(ExtractionError):
        extract_text("docx", make_docx([]))
    with pytest.raises(ExtractionError):
        extract_text("txt", b"   \n\n  ")


def test_undecodable_text_is_reported():
    with pytest.raises(ExtractionError) as caught:
        extract_text("txt", b"\x81\x8d\x8f\x90\x9d")
    assert "encoding" in caught.value.reason


def test_docx_zip_bomb_is_refused_before_parsing(monkeypatch):
    pytest.importorskip("docx")
    from app.services import text_extraction

    monkeypatch.setattr(text_extraction, "MAX_DOCX_UNCOMPRESSED_BYTES", 1000)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", "0" * 50_000)
    with pytest.raises(ExtractionError) as caught:
        extract_text("docx", buffer.getvalue())
    assert "too large" in caught.value.reason


def test_extracted_text_never_contains_nul_characters():
    # PostgreSQL text columns cannot hold NUL; the extractor strips it (and other control bytes)
    assert extract_text("txt", b"a\x00b\x07c ok") == "abc ok"


# --- service: upload -------------------------------------------------------------------------


def test_upload_stores_the_object_and_marks_the_document_ready():
    client = FakeSupabase()
    record = upload(service_for(client), b"Always be kind.", name="../Voice Guide.txt")

    assert record.status is DocumentStatus.READY
    assert record.organisation_id == ORG_A and record.uploaded_by == USER  # from the context
    assert record.original_filename == "Voice Guide.txt"  # sanitised
    assert record.text_length == len("Always be kind.") and record.extracted_text == "Always be kind."
    assert record.processed_at is not None and record.error_message is None
    assert client.status_log == ["uploaded", "processing", "ready"]

    # one private-bucket object, at <org>/<uuid>.<ext>, with nothing user-supplied in the path
    [(bucket, path, options)] = client.uploads
    assert bucket == "knowledge-documents"
    assert path == f"{ORG_A}/{record.id}.txt"
    assert options["content-type"] == TXT_MIME and options["upsert"] == "false"
    assert client.objects[path] == b"Always be kind."


def test_each_upload_gets_a_unique_path_even_for_the_same_filename():
    client = FakeSupabase()
    service = service_for(client)
    first, second = upload(service, b"one"), upload(service, b"two")
    assert first.id != second.id and len(client.objects) == 2


def test_pdf_and_docx_uploads_become_ready():
    pytest.importorskip("pypdf")
    pytest.importorskip("docx")
    client = FakeSupabase()
    service = service_for(client)
    pdf = upload(service, make_pdf("PDF brand rules"), "r.pdf", PDF_MIME)
    word = upload(service, make_docx(["Word brand rules"]), "r.docx", DOCX_MIME)
    assert pdf.status is word.status is DocumentStatus.READY
    assert "PDF brand rules" in pdf.extracted_text and "Word brand rules" in word.extracted_text


def test_unreadable_document_is_kept_as_failed_with_a_safe_reason():
    pytest.importorskip("pypdf")
    client = FakeSupabase()
    record = upload(service_for(client), b"%PDF-1.4\nbroken", "broken.pdf", PDF_MIME)
    assert record.status is DocumentStatus.FAILED
    assert record.error_message == "The document could not be read. It may be corrupt."
    assert record.extracted_text is None
    assert client.status_log == ["uploaded", "processing", "failed"]
    assert len(client.objects) == 1  # kept, so an admin can see it and delete it


def test_document_without_text_is_failed_not_ready():
    record = upload(service_for(FakeSupabase()), b"   \n  ")
    assert record.status is DocumentStatus.FAILED and "No extractable text" in record.error_message


def test_oversized_extracted_text_is_failed(monkeypatch):
    monkeypatch.setattr(knowledge_module, "MAX_EXTRACTED_CHARS", 10)
    record = upload(service_for(FakeSupabase()), b"this is far more than ten characters")
    assert record.status is DocumentStatus.FAILED and "too much text" in record.error_message


def test_unexpected_parser_error_becomes_a_generic_failure_without_leaking_details(monkeypatch):
    def explode(extension, data):
        raise ValueError("secret detail from /etc/passwd")

    from app.services import text_extraction

    monkeypatch.setattr(text_extraction, "extract_text", explode)
    record = upload(service_for(FakeSupabase()), b"hello")
    assert record.status is DocumentStatus.FAILED
    assert record.error_message == "The document could not be processed."
    assert "secret" not in record.error_message


def test_invalid_uploads_store_nothing():
    client = FakeSupabase()
    service = service_for(client)
    for name, mime, data in (
        ("a.exe", "application/octet-stream", b"x"),
        ("a.txt", TXT_MIME, b""),
        ("a.pdf", PDF_MIME, b"not a pdf"),
    ):
        with pytest.raises(AppError):
            upload(service, data, name, mime)
    assert client.objects == {} and client.tables.get("knowledge_documents", []) == []


# --- service: storage / database failures and cleanup ----------------------------------------


def test_storage_upload_failure_is_a_502_and_leaves_no_database_row():
    client = FakeSupabase()
    client.fail_upload = RuntimeError("storage exploded")
    with pytest.raises(StorageUnavailableError) as caught:
        upload(service_for(client), b"hello")
    assert caught.value.status_code == 502 and "exploded" not in caught.value.message
    assert client.tables.get("knowledge_documents", []) == []


def test_database_insert_failure_removes_the_stored_object():
    client = FakeSupabase()
    client.fail["insert"] = RuntimeError("db down")
    with pytest.raises(DatabaseError):
        upload(service_for(client), b"hello")
    assert client.objects == {}  # cleaned up: no orphan
    assert len(client.removed) == 1


def test_cleanup_failure_does_not_hide_the_original_database_error():
    client = FakeSupabase()
    client.fail["insert"] = RuntimeError("db down")
    client.fail_remove = RuntimeError("remove down too")
    with pytest.raises(DatabaseError):
        upload(service_for(client), b"hello")


def test_database_failure_while_processing_marks_the_document_failed():
    client = FakeSupabase()
    client.fail["update:ready"] = RuntimeError("db hiccup")
    with pytest.raises(DatabaseError):
        upload(service_for(client), b"hello")
    [row] = client.tables["knowledge_documents"]
    assert row["status"] == "failed"  # never left looking "in progress"


# --- service: list / get / delete and organisation isolation ---------------------------------


def test_list_is_scoped_to_the_organisation_newest_first_and_without_text():
    client = FakeSupabase()
    older = client.add_document(ORG_A, filename="older.txt")
    newer = client.add_document(ORG_A, filename="newer.txt")
    client.add_document(ORG_B, filename="other-org.txt")

    documents = service_for(client).list_documents(CTX_A, limit=50, offset=0)
    assert [str(d.id) for d in documents] == [newer["id"], older["id"]]
    assert all(d.organisation_id == ORG_A for d in documents)
    [(_, columns)] = [s for s in client.selects if s[0] == "knowledge_documents"]
    assert "extracted_text" not in columns and "storage_path" not in columns


def test_list_pagination():
    client = FakeSupabase()
    rows = [client.add_document(ORG_A, filename=f"{n}.txt") for n in range(5)]
    page = service_for(client).list_documents(CTX_A, limit=2, offset=1)
    assert [str(d.id) for d in page] == [rows[3]["id"], rows[2]["id"]]


def test_get_returns_own_document_and_hides_other_organisations():
    client = FakeSupabase()
    mine, theirs = client.add_document(ORG_A, text="mine"), client.add_document(ORG_B, text="theirs")
    service = service_for(client)
    assert service.get(CTX_A, UUID(mine["id"])).extracted_text == "mine"
    with pytest.raises(AppError) as caught:
        service.get(CTX_A, UUID(theirs["id"]))
    assert (caught.value.status_code, caught.value.code) == (404, "not_found")
    # every lookup carried the verified organisation id, never the document's own
    assert {v for t, _o, c, v in client.filters if c == "organisation_id"} == {str(ORG_A)}


def test_get_unknown_document_is_404():
    with pytest.raises(AppError) as caught:
        service_for(FakeSupabase()).get(CTX_A, uuid4())
    assert caught.value.status_code == 404


def test_delete_removes_the_object_and_the_row():
    client = FakeSupabase()
    doc = client.add_document(ORG_A)
    service_for(client).delete(CTX_A, UUID(doc["id"]))
    assert client.tables["knowledge_documents"] == []
    assert doc["storage_path"] not in client.objects and client.removed == [doc["storage_path"]]


def test_delete_cannot_touch_another_organisations_document():
    client = FakeSupabase()
    theirs = client.add_document(ORG_B)
    with pytest.raises(AppError) as caught:
        service_for(client).delete(CTX_A, UUID(theirs["id"]))
    assert caught.value.status_code == 404
    assert len(client.tables["knowledge_documents"]) == 1 and theirs["storage_path"] in client.objects


def test_delete_with_storage_failure_keeps_the_row_so_it_can_be_retried():
    client = FakeSupabase()
    doc = client.add_document(ORG_A)
    client.fail_remove = RuntimeError("storage down")
    service = service_for(client)
    with pytest.raises(StorageUnavailableError):
        service.delete(CTX_A, UUID(doc["id"]))
    assert len(client.tables["knowledge_documents"]) == 1

    client.fail_remove = None
    service.delete(CTX_A, UUID(doc["id"]))
    assert client.tables["knowledge_documents"] == []


def test_delete_with_database_failure_after_object_removal_can_be_retried():
    client = FakeSupabase()
    doc = client.add_document(ORG_A)
    client.fail["delete"] = RuntimeError("db down")
    service = service_for(client)
    with pytest.raises(DatabaseError):
        service.delete(CTX_A, UUID(doc["id"]))
    assert len(client.tables["knowledge_documents"]) == 1  # row intact, object already gone

    del client.fail["delete"]
    service.delete(CTX_A, UUID(doc["id"]))  # removing a missing object is a no-op
    assert client.tables["knowledge_documents"] == []
