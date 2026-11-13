"""Knowledge Hub: allowed file types, limits and document records (pure, no I/O)."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict

# Private Supabase Storage bucket (created by database/migrations/0007). Server-side access only.
KNOWLEDGE_BUCKET = "knowledge-documents"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB; mirrored by the bucket's file_size_limit
MAX_EXTRACTED_CHARS = 1_000_000  # bigger extracted text is refused (status "failed")
TEXT_PREVIEW_CHARS = 2000

# extension -> the one MIME type accepted for it (kept in sync with the bucket's allowed types)
ALLOWED_TYPES: dict[str, str] = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain",
}


class DocumentStatus(str, Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


class KnowledgeDocumentSummary(BaseModel):
    """Document metadata. Never includes the extracted text or the storage path."""

    model_config = ConfigDict(frozen=True)

    id: UUID
    organisation_id: UUID
    uploaded_by: UUID | None = None
    original_filename: str
    mime_type: str
    size_bytes: int
    status: DocumentStatus
    text_length: int | None = None
    error_message: str | None = None
    processed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentRecord(KnowledgeDocumentSummary):
    """A full row, as needed to read a document or delete its stored object."""

    storage_path: str
    extracted_text: str | None = None
