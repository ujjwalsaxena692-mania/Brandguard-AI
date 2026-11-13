from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.models.knowledge import (
    TEXT_PREVIEW_CHARS,
    DocumentStatus,
    KnowledgeDocumentRecord,
    KnowledgeDocumentSummary,
)


class KnowledgeDocumentResponse(BaseModel):
    """Document metadata. The storage path and the full text are never part of a response."""

    id: UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    status: DocumentStatus
    text_length: int | None
    error_message: str | None
    uploaded_by: UUID | None
    processed_at: datetime | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_summary(cls, document: KnowledgeDocumentSummary) -> KnowledgeDocumentResponse:
        return cls(
            id=document.id,
            original_filename=document.original_filename,
            mime_type=document.mime_type,
            size_bytes=document.size_bytes,
            status=document.status,
            text_length=document.text_length,
            error_message=document.error_message,
            uploaded_by=document.uploaded_by,
            processed_at=document.processed_at,
            created_at=document.created_at,
            updated_at=document.updated_at,
        )


class KnowledgeDocumentDetailResponse(KnowledgeDocumentResponse):
    text_preview: str | None

    @classmethod
    def from_record(cls, record: KnowledgeDocumentRecord) -> KnowledgeDocumentDetailResponse:
        text = record.extracted_text
        return cls(
            **KnowledgeDocumentResponse.from_summary(record).model_dump(),
            text_preview=text[:TEXT_PREVIEW_CHARS] if text else None,
        )


class KnowledgeDocumentListResponse(BaseModel):
    items: list[KnowledgeDocumentResponse]
    limit: int
    offset: int
