"""Data access for ``knowledge_documents``.

Every method takes the organisation id (from the verified organisation context) and filters
on it, so a document id from another organisation simply does not exist here.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.models.knowledge import DocumentStatus, KnowledgeDocumentRecord, KnowledgeDocumentSummary
from app.repositories.base import run_query

_TABLE = "knowledge_documents"
_SUMMARY_COLUMNS = (
    "id, organisation_id, uploaded_by, original_filename, mime_type, size_bytes, status, "
    "text_length, error_message, processed_at, created_at, updated_at"
)
_RECORD_COLUMNS = f"{_SUMMARY_COLUMNS}, storage_path, extracted_text"


class KnowledgeDocumentRepository:
    def __init__(self, client: Any) -> None:
        self._client = client

    def insert(
        self,
        *,
        document_id: UUID,
        organisation_id: UUID,
        uploaded_by: UUID,
        original_filename: str,
        storage_path: str,
        mime_type: str,
        size_bytes: int,
    ) -> KnowledgeDocumentRecord:
        row = {
            "id": str(document_id),
            "organisation_id": str(organisation_id),
            "uploaded_by": str(uploaded_by),
            "original_filename": original_filename,
            "storage_path": storage_path,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "status": DocumentStatus.UPLOADED.value,
        }
        rows = run_query(
            "knowledge_documents.insert", lambda: self._client.table(_TABLE).insert(row).execute()
        )
        return KnowledgeDocumentRecord.model_validate(rows[0])

    def get(self, organisation_id: UUID, document_id: UUID) -> KnowledgeDocumentRecord | None:
        rows = run_query(
            "knowledge_documents.get",
            lambda: self._client.table(_TABLE)
            .select(_RECORD_COLUMNS)
            .eq("organisation_id", str(organisation_id))
            .eq("id", str(document_id))
            .limit(1)
            .execute(),
        )
        return KnowledgeDocumentRecord.model_validate(rows[0]) if rows else None

    def list_for_organisation(
        self, organisation_id: UUID, *, limit: int, offset: int
    ) -> list[KnowledgeDocumentSummary]:
        """Newest first. Metadata only: the extracted text is never loaded for listings."""
        rows = run_query(
            "knowledge_documents.list",
            lambda: self._client.table(_TABLE)
            .select(_SUMMARY_COLUMNS)
            .eq("organisation_id", str(organisation_id))
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute(),
        )
        return [KnowledgeDocumentSummary.model_validate(row) for row in rows]

    def _update(
        self, organisation_id: UUID, document_id: UUID, changes: dict[str, Any]
    ) -> KnowledgeDocumentRecord | None:
        rows = run_query(
            "knowledge_documents.update",
            lambda: self._client.table(_TABLE)
            .update(changes)
            .eq("organisation_id", str(organisation_id))
            .eq("id", str(document_id))
            .execute(),
        )
        return KnowledgeDocumentRecord.model_validate(rows[0]) if rows else None

    def mark_processing(self, organisation_id: UUID, document_id: UUID) -> None:
        self._update(organisation_id, document_id, {"status": DocumentStatus.PROCESSING.value})

    def mark_ready(
        self, organisation_id: UUID, document_id: UUID, text: str
    ) -> KnowledgeDocumentRecord | None:
        return self._update(
            organisation_id,
            document_id,
            {
                "status": DocumentStatus.READY.value,
                "extracted_text": text,
                "text_length": len(text),
                "error_message": None,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def mark_failed(
        self, organisation_id: UUID, document_id: UUID, error_message: str
    ) -> KnowledgeDocumentRecord | None:
        return self._update(
            organisation_id,
            document_id,
            {
                "status": DocumentStatus.FAILED.value,
                "error_message": error_message[:500],
                "processed_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def delete(self, organisation_id: UUID, document_id: UUID) -> bool:
        rows = run_query(
            "knowledge_documents.delete",
            lambda: self._client.table(_TABLE)
            .delete()
            .eq("organisation_id", str(organisation_id))
            .eq("id", str(document_id))
            .execute(),
        )
        return bool(rows)
