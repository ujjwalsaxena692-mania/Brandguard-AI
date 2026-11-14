"""Shared multipart upload reading for the Knowledge Hub and submission attachments."""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import Request
from starlette.datastructures import UploadFile

from app.core.errors import AppError
from app.models.knowledge import MAX_UPLOAD_BYTES

# Multipart framing adds a little to the file itself; anything beyond this is refused up front.
_MULTIPART_OVERHEAD_BYTES = 64 * 1024


@dataclass(frozen=True)
class UploadedFile:
    filename: str | None
    content_type: str | None
    data: bytes  # at most MAX_UPLOAD_BYTES + 1 bytes: one over is enough for validation to refuse


async def read_single_file(request: Request, field: str = "file") -> UploadedFile:
    """Read the one file in a multipart request.

    Call this only AFTER authentication and the permission check (the route's dependencies have
    run by then), so unauthorised callers never make the server parse a large body. Uses
    ``request.form()`` rather than an ``UploadFile`` parameter so the API still starts if
    python-multipart is missing; only upload routes need it.
    """
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES + _MULTIPART_OVERHEAD_BYTES:
        raise AppError("The file exceeds the 10 MB limit.", status_code=413, code="file_too_large")

    form = await request.form()
    try:
        upload = form.get(field)
        if not isinstance(upload, UploadFile):
            raise AppError(
                f"Send the document as the multipart form field '{field}'.",
                status_code=400,
                code="bad_request",
            )
        data = await upload.read(MAX_UPLOAD_BYTES + 1)
        return UploadedFile(upload.filename, upload.content_type, data)
    finally:
        await form.close()
