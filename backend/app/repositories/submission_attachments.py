"""Data access for ``submission_attachments`` (always scoped by organisation AND submission)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from app.models.knowledge import DocumentStatus
from app.models.submission import AttachmentRecord, AttachmentSummary
from app.repositories.base import run_query

_TABLE = "submission_attachments"
_SUMMARY_COLUMNS = (
    "id, submission_id, organisation_id, uploaded_by, original_filename, mime_type, size_bytes, "
    "status, text_length, error_message, processed_at, created_at, updated_at"
)
_RECORD_COLUMNS = f"{_SUMMARY_COLUMNS}, storage_path, extracted_text"


class AttachmentRepository:
    def __init__(self, client: Any) -> None:
        self._client = client

    def insert(
        self,
        *,
        attachment_id: UUID,
        submission_id: UUID,
        organisation_id: UUID,
        uploaded_by: UUID,
        original_filename: str,
        storage_path: str,
        mime_type: str,
        size_bytes: int,
    ) -> AttachmentRecord:
        row = {
            "id": str(attachment_id),
            "submission_id": str(submission_id),
            "organisation_id": str(organisation_id),
            "uploaded_by": str(uploaded_by),
            "original_filename": original_filename,
            "storage_path": storage_path,
            "mime_type": mime_type,
            "size_bytes": size_bytes,
            "status": DocumentStatus.UPLOADED.value,
        }
        rows = run_query(
            "submission_attachments.insert",
            lambda: self._client.table(_TABLE).insert(row).execute(),
        )
        return AttachmentRecord.model_validate(rows[0])

    def list_for_submission(
        self, organisation_id: UUID, submission_id: UUID
    ) -> list[AttachmentSummary]:
        """Oldest first. Metadata only: extracted text is never loaded for listings."""
        rows = run_query(
            "submission_attachments.list",
            lambda: self._client.table(_TABLE)
            .select(_SUMMARY_COLUMNS)
            .eq("organisation_id", str(organisation_id))
            .eq("submission_id", str(submission_id))
            .order("created_at", desc=False)
            .execute(),
        )
        return [AttachmentSummary.model_validate(row) for row in rows]

    def list_storage_paths(self, organisation_id: UUID, submission_id: UUID) -> list[str]:
        rows = run_query(
            "submission_attachments.list_paths",
            lambda: self._client.table(_TABLE)
            .select("storage_path")
            .eq("organisation_id", str(organisation_id))
            .eq("submission_id", str(submission_id))
            .execute(),
        )
        return [row["storage_path"] for row in rows]

    def get(
        self, organisation_id: UUID, submission_id: UUID, attachment_id: UUID
    ) -> AttachmentRecord | None:
        rows = run_query(
            "submission_attachments.get",
            lambda: self._client.table(_TABLE)
            .select(_RECORD_COLUMNS)
            .eq("organisation_id", str(organisation_id))
            .eq("submission_id", str(submission_id))
            .eq("id", str(attachment_id))
            .limit(1)
            .execute(),
        )
        return AttachmentRecord.model_validate(rows[0]) if rows else None

    def _update(
        self, organisation_id: UUID, attachment_id: UUID, changes: dict[str, Any]
    ) -> AttachmentRecord | None:
        rows = run_query(
            "submission_attachments.update",
            lambda: self._client.table(_TABLE)
            .update(changes)
            .eq("organisation_id", str(organisation_id))
            .eq("id", str(attachment_id))
            .execute(),
        )
        return AttachmentRecord.model_validate(rows[0]) if rows else None

    def mark_processing(self, organisation_id: UUID, attachment_id: UUID) -> None:
        self._update(organisation_id, attachment_id, {"status": DocumentStatus.PROCESSING.value})

    def mark_ready(
        self, organisation_id: UUID, attachment_id: UUID, text: str
    ) -> AttachmentRecord | None:
        return self._update(
            organisation_id,
            attachment_id,
            {
                "status": DocumentStatus.READY.value,
                "extracted_text": text,
                "text_length": len(text),
                "error_message": None,
                "processed_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def mark_failed(
        self, organisation_id: UUID, attachment_id: UUID, error_message: str
    ) -> AttachmentRecord | None:
        return self._update(
            organisation_id,
            attachment_id,
            {
                "status": DocumentStatus.FAILED.value,
                "error_message": error_message[:500],
                "processed_at": datetime.now(timezone.utc).isoformat(),
            },
        )

    def delete(self, organisation_id: UUID, submission_id: UUID, attachment_id: UUID) -> bool:
        rows = run_query(
            "submission_attachments.delete",
            lambda: self._client.table(_TABLE)
            .delete()
            .eq("organisation_id", str(organisation_id))
            .eq("submission_id", str(submission_id))
            .eq("id", str(attachment_id))
            .execute(),
        )
        return bool(rows)
