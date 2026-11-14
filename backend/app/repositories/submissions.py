"""Data access for ``content_submissions``.

Every method takes the organisation id (from the verified organisation context) and filters on
it, so an id from another organisation simply does not exist here. Status changes are
*conditional updates* (``WHERE status = <expected>``), so two concurrent requests can never both
move a submission through the same transition.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from app.models.submission import SubmissionRecord, SubmissionStatus, SubmissionSummary
from app.repositories.base import run_query

_TABLE = "content_submissions"
_SUMMARY_COLUMNS = (
    "id, organisation_id, submitted_by, title, content_type, campaign_name, target_audience, "
    "platform, publishing_date, status, error_message, submitted_at, processed_at, "
    "analysis_text_length, created_at, updated_at"
)
_RECORD_COLUMNS = f"{_SUMMARY_COLUMNS}, content_text, reviewer_context"


def _escape_like(text: str) -> str:
    """Make user text match literally inside an ILIKE pattern."""
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class SubmissionRepository:
    def __init__(self, client: Any) -> None:
        self._client = client

    def insert(
        self, *, organisation_id: UUID, submitted_by: UUID, fields: dict[str, Any]
    ) -> SubmissionRecord:
        row = {
            **fields,
            "organisation_id": str(organisation_id),
            "submitted_by": str(submitted_by),
            "status": SubmissionStatus.DRAFT.value,
        }
        rows = run_query(
            "content_submissions.insert", lambda: self._client.table(_TABLE).insert(row).execute()
        )
        return SubmissionRecord.model_validate(rows[0])

    def get(self, organisation_id: UUID, submission_id: UUID) -> SubmissionRecord | None:
        rows = run_query(
            "content_submissions.get",
            lambda: self._client.table(_TABLE)
            .select(_RECORD_COLUMNS)
            .eq("organisation_id", str(organisation_id))
            .eq("id", str(submission_id))
            .limit(1)
            .execute(),
        )
        return SubmissionRecord.model_validate(rows[0]) if rows else None

    def list_for_organisation(
        self,
        organisation_id: UUID,
        *,
        limit: int,
        offset: int,
        status: SubmissionStatus | None = None,
        content_type: str | None = None,
        search: str | None = None,
        submitted_by: UUID | None = None,
    ) -> tuple[list[SubmissionSummary], int]:
        """Newest first, plus the total number of matches. Metadata only (no typed content).

        ``submitted_by`` restricts the list to one author: the service sets it for callers who
        may only see their own submissions."""
        counted: dict[str, int] = {}

        def call() -> Any:
            query = (
                self._client.table(_TABLE)
                .select(_SUMMARY_COLUMNS, count="exact")
                .eq("organisation_id", str(organisation_id))
            )
            if status is not None:
                query = query.eq("status", status.value)
            if content_type is not None:
                query = query.eq("content_type", content_type)
            if submitted_by is not None:
                query = query.eq("submitted_by", str(submitted_by))
            if search:
                query = query.ilike("title", f"%{_escape_like(search)}%")
            response = (
                query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
            )
            counted["total"] = getattr(response, "count", None) or 0
            return response

        rows = run_query("content_submissions.list", call)
        return [SubmissionSummary.model_validate(row) for row in rows], counted["total"]

    def update_draft(
        self, organisation_id: UUID, submission_id: UUID, changes: dict[str, Any]
    ) -> SubmissionRecord | None:
        """Edit fields; matches nothing (None) unless the submission is still a draft."""
        rows = run_query(
            "content_submissions.update_draft",
            lambda: self._client.table(_TABLE)
            .update(changes)
            .eq("organisation_id", str(organisation_id))
            .eq("id", str(submission_id))
            .eq("status", SubmissionStatus.DRAFT.value)
            .execute(),
        )
        return SubmissionRecord.model_validate(rows[0]) if rows else None

    def transition(
        self,
        organisation_id: UUID,
        submission_id: UUID,
        *,
        from_status: SubmissionStatus,
        to_status: SubmissionStatus,
        changes: dict[str, Any] | None = None,
    ) -> SubmissionRecord | None:
        """Move ``from_status`` -> ``to_status``. None if the submission was no longer in
        ``from_status`` (someone else changed it first, or it does not exist)."""
        payload = {**(changes or {}), "status": to_status.value}
        rows = run_query(
            "content_submissions.transition",
            lambda: self._client.table(_TABLE)
            .update(payload)
            .eq("organisation_id", str(organisation_id))
            .eq("id", str(submission_id))
            .eq("status", from_status.value)
            .execute(),
        )
        return SubmissionRecord.model_validate(rows[0]) if rows else None

    def delete(
        self,
        organisation_id: UUID,
        submission_id: UUID,
        *,
        allowed_statuses: frozenset[SubmissionStatus],
    ) -> bool:
        statuses = sorted(status.value for status in allowed_statuses)
        rows = run_query(
            "content_submissions.delete",
            lambda: self._client.table(_TABLE)
            .delete()
            .eq("organisation_id", str(organisation_id))
            .eq("id", str(submission_id))
            .in_("status", statuses)
            .execute(),
        )
        return bool(rows)
