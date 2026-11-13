"""Upload validation and filename sanitisation for the Knowledge Hub (pure, no I/O).

The file's name, declared MIME type and first bytes must all agree before anything is stored.
Storage paths never contain user-supplied text (see ``KnowledgeService.upload``).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from app.core.errors import AppError
from app.models.knowledge import ALLOWED_TYPES, MAX_UPLOAD_BYTES

_MAX_NAME_CHARS = 150
_UNSAFE = re.compile(r"[^\w\s.\-()]", re.UNICODE)
_SPACES = re.compile(r"\s+")


@dataclass(frozen=True)
class ValidatedUpload:
    filename: str  # sanitised, for display only
    extension: str  # "pdf" | "docx" | "txt"
    mime_type: str  # canonical type for that extension


def sanitize_filename(raw: str | None) -> str:
    """A display-safe filename: no directories, no control or exotic characters, bounded length."""
    name = unicodedata.normalize("NFC", raw or "")
    name = name.replace("\\", "/").rsplit("/", 1)[-1]  # drop any directory part
    name = "".join(ch for ch in name if unicodedata.category(ch)[0] != "C")  # control chars
    name = _SPACES.sub(" ", _UNSAFE.sub("_", name)).strip(" .")
    if len(name) > _MAX_NAME_CHARS:
        stem, dot, ext = name.rpartition(".")
        if dot and len(ext) <= 10:
            name = stem[: _MAX_NAME_CHARS - len(ext) - 1].rstrip(" .") + "." + ext
        else:
            name = name[:_MAX_NAME_CHARS]
    return name or "document"


def _extension(filename: str) -> str:
    return filename.rpartition(".")[2].lower() if "." in filename else ""


def _normalise_mime(content_type: str | None) -> str:
    return (content_type or "").split(";", 1)[0].strip().lower()


def _matches_signature(extension: str, data: bytes) -> bool:
    if extension == "pdf":
        return b"%PDF-" in data[:1024]
    if extension == "docx":
        return data.startswith(b"PK\x03\x04")  # DOCX is a ZIP container
    return b"\x00" not in data  # txt: binary data is not text


def validate_upload(filename: str | None, content_type: str | None, data: bytes) -> ValidatedUpload:
    """Raise a client-presentable ``AppError`` unless this is a non-empty, in-limit,
    consistent PDF/DOCX/TXT upload."""
    if len(data) == 0:
        raise AppError("The file is empty.", status_code=400, code="empty_file")
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError(
            f"The file exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
            status_code=413,
            code="file_too_large",
        )

    safe_name = sanitize_filename(filename)
    extension = _extension(safe_name)
    expected_mime = ALLOWED_TYPES.get(extension)
    if expected_mime is None:
        raise AppError(
            "Only PDF, DOCX and TXT files are supported.",
            status_code=415,
            code="unsupported_file_type",
        )
    if _normalise_mime(content_type) != expected_mime:
        raise AppError(
            "The file's content type does not match its extension.",
            status_code=415,
            code="unsupported_file_type",
        )
    if not _matches_signature(extension, data):
        raise AppError(
            "The file content does not match its type. It may be corrupt.",
            status_code=400,
            code="invalid_file",
        )
    return ValidatedUpload(filename=safe_name, extension=extension, mime_type=expected_mime)
