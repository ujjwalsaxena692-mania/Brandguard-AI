"""Fakes and fixture builders shared by the Knowledge Hub tests. Nothing here touches a network.

``FakeSupabase`` stands in for the supabase-py client for BOTH the database (table queries) and
Storage, with switches to inject failures. It is a test double: it proves the backend's own
logic (scoping, ordering of steps, cleanup), not PostgreSQL, RLS or real Storage behaviour.
"""

from __future__ import annotations

import io
import zipfile
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import Any
from uuid import uuid4

BASE_TIME = datetime(2026, 1, 1, tzinfo=timezone.utc)


class FakeQuery:
    def __init__(self, client: FakeSupabase, table: str) -> None:
        self._c, self._table = client, table
        self._op = "select"
        self._payload: Any = None
        self._columns = "*"
        self._filters: list[tuple[str, str]] = []
        self._order: tuple[str, bool] | None = None
        self._range: tuple[int, int] | None = None
        self._limit: int | None = None
        self._count: str | None = None
        self._like: list[tuple[str, str]] = []
        self._in: list[tuple[str, list[str]]] = []

    def select(self, columns: str = "*", count: str | None = None):
        self._op, self._columns, self._count = "select", columns, count
        self._c.selects.append((self._table, columns))
        return self

    def insert(self, row: dict):
        self._op, self._payload = "insert", row
        return self

    def update(self, changes: dict):
        self._op, self._payload = "update", changes
        return self

    def delete(self):
        self._op = "delete"
        return self

    def eq(self, column: str, value: str):
        self._filters.append((column, value))
        self._c.filters.append((self._table, self._op, column, value))
        return self

    def ilike(self, column: str, pattern: str):
        self._like.append((column, pattern))
        return self

    def in_(self, column: str, values: list[str]):
        self._in.append((column, list(values)))
        self._c.filters.append((self._table, self._op, column, ",".join(sorted(values))))
        return self

    def order(self, column: str, desc: bool = False):
        self._order = (column, desc)
        return self

    def range(self, start: int, end: int):
        self._range = (start, end)
        return self

    def limit(self, count: int):
        self._limit = count
        return self

    def _matching(self) -> list[dict]:
        rows = self._c.tables.setdefault(self._table, [])
        def like(row: dict, column: str, pattern: str) -> bool:
            needle = pattern[1:-1]  # the repository always builds %<text>%
            needle = needle.replace(r"\%", "%").replace(r"\_", "_").replace("\\\\", "\\")
            return needle.lower() in str(row.get(column) or "").lower()

        return [
            r
            for r in rows
            if all(str(r.get(c)) == v for c, v in self._filters)
            and all(like(r, c, p) for c, p in self._like)
            and all(str(r.get(c)) in vals for c, vals in self._in)
        ]

    def execute(self):
        failure_key = self._op
        if self._op == "update":
            failure_key = f"update:{self._payload.get('status', 'other')}"
        if failure_key in self._c.fail:
            raise self._c.fail[failure_key]

        if self._op == "insert":
            if self._table == "submission_attachments":
                parents = [
                    r
                    for r in self._c.tables.get("content_submissions", [])
                    if r["id"] == self._payload["submission_id"]
                    and r["organisation_id"] == self._payload["organisation_id"]
                    and r["status"] == "draft"
                ]
                if not parents:  # mirrors the private.guard_attachment_parent() trigger
                    raise PgError("23514", "attachments can only be added to draft submissions")
            row = self._c.new_row(self._table, self._payload)
            self._c.tables.setdefault(self._table, []).append(row)
            if self._table in ("knowledge_documents", "submission_attachments"):
                self._c.status_log.append(row["status"])
            if self._table == "content_submissions":
                self._c.submission_log.append(row["status"])
            return SimpleNamespace(data=[dict(row)])

        matched = self._matching()
        if self._op == "update":
            for row in matched:
                row.update(self._payload)
                row["updated_at"] = self._c.now().isoformat()
                if self._table in ("knowledge_documents", "submission_attachments") and "status" in self._payload:
                    self._c.status_log.append(row["status"])
                if self._table == "content_submissions" and "status" in self._payload:
                    self._c.submission_log.append(row["status"])
            return SimpleNamespace(data=[dict(r) for r in matched])
        if self._op == "delete":
            rows = self._c.tables.setdefault(self._table, [])
            for row in matched:
                rows.remove(row)
                if self._table == "content_submissions":  # ON DELETE CASCADE to attachments
                    children = self._c.tables.get("submission_attachments", [])
                    children[:] = [c for c in children if c["submission_id"] != row["id"]]
            return SimpleNamespace(data=[dict(r) for r in matched])

        total = len(matched)
        if self._order:
            matched.sort(key=lambda r: r[self._order[0]], reverse=self._order[1])
        if self._range:
            matched = matched[self._range[0] : self._range[1] + 1]
        if self._limit is not None:
            matched = matched[: self._limit]
        if self._columns != "*":
            wanted = [c.strip() for c in self._columns.split(",")]
            matched = [{c: r.get(c) for c in wanted} for r in matched]
        return SimpleNamespace(
            data=[dict(r) for r in matched], count=total if self._count else None
        )


class PgError(Exception):
    """Looks like a driver error carrying a SQLSTATE (translated by repositories.base)."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class FakeBucket:
    """The two Storage calls the backend uses. There is deliberately no public/signed-URL API:
    if the code ever asked for one, the test would fail with AttributeError."""

    def __init__(self, client: FakeSupabase, name: str) -> None:
        self._c, self._name = client, name

    def upload(self, path: str, file: bytes, file_options: dict | None = None):
        if self._c.fail_upload is not None:
            raise self._c.fail_upload
        self._c.objects[path] = file
        self._c.uploads.append((self._name, path, dict(file_options or {})))

    def remove(self, paths: list[str]):
        if self._c.fail_remove is not None:
            raise self._c.fail_remove
        for path in paths:
            self._c.objects.pop(path, None)
        self._c.removed.extend(paths)


class FakeSupabase:
    def __init__(self, memberships: list[dict] | None = None) -> None:
        self.tables: dict[str, list[dict]] = {"organisation_memberships": list(memberships or [])}
        self.objects: dict[str, bytes] = {}
        self.uploads: list[tuple[str, str, dict]] = []
        self.removed: list[str] = []
        self.filters: list[tuple[str, str, str, str]] = []
        self.selects: list[tuple[str, str]] = []
        self.status_log: list[str] = []
        self.submission_log: list[str] = []
        self.fail: dict[str, Exception] = {}  # "insert" | "delete" | "select" | "update:<status>"
        self.fail_upload: Exception | None = None
        self.fail_remove: Exception | None = None
        self._tick = 0
        self.storage = SimpleNamespace(from_=lambda name: FakeBucket(self, name))

    def now(self) -> datetime:
        self._tick += 1
        return BASE_TIME + timedelta(seconds=self._tick)

    def new_row(self, table: str, payload: dict) -> dict:
        row = dict(payload)
        if table == "content_submissions":
            stamp = self.now().isoformat()
            row.setdefault("id", str(uuid4()))
            defaults = {
                "content_type": None, "content_text": "", "campaign_name": None,
                "target_audience": None, "platform": None, "publishing_date": None,
                "reviewer_context": None, "error_message": None, "submitted_at": None,
                "processed_at": None, "analysis_text_length": None,
            }
            for key, value in defaults.items():
                row.setdefault(key, value)
            row.update({"created_at": stamp, "updated_at": stamp})
        if table in ("knowledge_documents", "submission_attachments"):
            stamp = self.now().isoformat()
            row.setdefault("id", str(uuid4()))
            row.update(
                {
                    "extracted_text": None,
                    "text_length": None,
                    "error_message": None,
                    "processed_at": None,
                    "created_at": stamp,
                    "updated_at": stamp,
                }
            )
        return row

    def table(self, name: str) -> FakeQuery:
        return FakeQuery(self, name)

    def add_document(self, organisation_id, *, filename: str = "guide.txt", text: str = "hello") -> dict:
        """Seed a ready document directly (as if uploaded earlier), with its stored object."""
        doc_id = uuid4()
        path = f"{organisation_id}/{doc_id}.txt"
        stamp = self.now().isoformat()
        row = {
            "id": str(doc_id),
            "organisation_id": str(organisation_id),
            "uploaded_by": str(uuid4()),
            "original_filename": filename,
            "storage_path": path,
            "mime_type": "text/plain",
            "size_bytes": len(text),
            "status": "ready",
            "extracted_text": text,
            "text_length": len(text),
            "error_message": None,
            "processed_at": stamp,
            "created_at": stamp,
            "updated_at": stamp,
        }
        self.tables.setdefault("knowledge_documents", []).append(row)
        self.objects[path] = text.encode()
        return row


def add_submission(
    client: FakeSupabase,
    organisation_id,
    author,
    *,
    status: str = "draft",
    title: str = "Autumn launch email",
    content_type: str | None = "email_newsletter",
    content_text: str = "Meet Orbit Insights: reporting that finally makes sense.",
    **extra,
) -> dict:
    """Seed a submission directly (as if created earlier)."""
    stamp = client.now().isoformat()
    row = {
        "id": str(uuid4()),
        "organisation_id": str(organisation_id),
        "submitted_by": str(author),
        "title": title,
        "content_type": content_type,
        "content_text": content_text,
        "campaign_name": None,
        "target_audience": None,
        "platform": None,
        "publishing_date": None,
        "reviewer_context": None,
        "status": status,
        "error_message": None,
        "submitted_at": stamp if status not in ("draft", "cancelled") else None,
        "processed_at": None,
        "analysis_text_length": None,
        "created_at": stamp,
        "updated_at": stamp,
    }
    row.update(extra)
    client.tables.setdefault("content_submissions", []).append(row)
    return row


def add_attachment(client: FakeSupabase, submission: dict, *, status="ready", text="attached text") -> dict:
    """Seed an attachment (and its stored object) on a seeded submission."""
    att_id = uuid4()
    path = f"{submission['organisation_id']}/{submission['id']}/{att_id}.txt"
    stamp = client.now().isoformat()
    row = {
        "id": str(att_id),
        "submission_id": submission["id"],
        "organisation_id": submission["organisation_id"],
        "uploaded_by": submission["submitted_by"],
        "original_filename": "notes.txt",
        "storage_path": path,
        "mime_type": "text/plain",
        "size_bytes": len(text),
        "status": status,
        "extracted_text": text if status == "ready" else None,
        "text_length": len(text) if status == "ready" else None,
        "error_message": "The document could not be read. It may be corrupt." if status == "failed" else None,
        "processed_at": stamp,
        "created_at": stamp,
        "updated_at": stamp,
    }
    client.tables.setdefault("submission_attachments", []).append(row)
    client.objects[path] = text.encode()
    return row


def membership_row(org, user, role: str, status: str = "active") -> dict:
    return {
        "id": str(uuid4()),
        "organisation_id": str(org),
        "user_id": str(user),
        "role": role,
        "status": status,
    }


# --- real file fixtures (generated in memory; no binary files committed) ------------------------


def make_pdf(text: str) -> bytes:
    """A minimal, valid one-page PDF whose text layer is ``text`` (ASCII, no parentheses)."""
    stream = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = b"%PDF-1.4\n"
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % number + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref)
    return out


def make_blank_pdf() -> bytes:
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(612, 792)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def make_docx(paragraphs: list[str], table: list[list[str]] | None = None) -> bytes:
    import docx

    document = docx.Document()
    for paragraph in paragraphs:
        document.add_paragraph(paragraph)
    if table:
        grid = document.add_table(rows=len(table), cols=len(table[0]))
        for r, row in enumerate(table):
            for c, value in enumerate(row):
                grid.cell(r, c).text = value
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def make_zip_without_document_xml() -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("hello.txt", "not a docx")
    return buffer.getvalue()


PDF_MIME = "application/pdf"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
TXT_MIME = "text/plain"
