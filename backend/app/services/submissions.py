"""Content submission use cases: create/edit drafts, attach documents, submit, cancel, delete.

Authorisation is layered:
  * the API dependencies resolve the caller's organisation from the verified token and check the
    role permission (``submissions:create`` for writes);
  * this service then applies *ownership*: creators only see and change their own submissions,
    owners/admins can act on anyone's, reviewers see all but cannot write.
Everything is scoped to ``context.organisation_id`` / ``context.user_id`` (both verified), never
to request input. A submission the caller may not see looks exactly like one that does not exist.

This phase only prepares content for a later AI analysis. Nothing here analyses, scores or
approves anything: the furthest a submission goes is ``ready_for_analysis``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4

from app.core.errors import AppError, ForbiddenError
from app.models.knowledge import MAX_EXTRACTED_CHARS, DocumentStatus
from app.models.organisation import OrganisationContext, Permission
from app.models.submission import (
    CONTENT_MIN,
    DELETABLE_STATUSES,
    EDITABLE_STATUSES,
    MAX_ANALYSIS_CHARS,
    MAX_ATTACHMENTS,
    AttachmentRecord,
    AttachmentSummary,
    SubmissionRecord,
    SubmissionStatus,
    SubmissionSummary,
    can_transition,
)
from app.repositories.submission_attachments import AttachmentRepository
from app.repositories.submissions import SubmissionRepository
from app.services.knowledge_files import validate_upload
from app.services.knowledge_storage import KnowledgeStorage
from app.services.text_extraction import PROCESSING_FAILED, extract_for_storage

logger = logging.getLogger("brandguard.submissions")

_TOO_LONG = "The combined content is too long to prepare for analysis."
_PIPELINE_FAILED = "The submission could not be prepared. Please try again."


@dataclass(frozen=True)
class SubmissionDetail:
    submission: SubmissionRecord
    attachments: list[AttachmentSummary]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _not_found() -> AppError:
    return AppError("Submission not found.", status_code=404, code="not_found")


class SubmissionService:
    def __init__(
        self,
        submissions: SubmissionRepository,
        attachments: AttachmentRepository,
        storage: KnowledgeStorage,
    ) -> None:
        self._submissions = submissions
        self._attachments = attachments
        self._storage = storage

    # -- access rules ------------------------------------------------------------------------

    @staticmethod
    def _can_view(context: OrganisationContext, record: SubmissionRecord) -> bool:
        return context.can(Permission.SUBMISSIONS_VIEW_ALL) or record.submitted_by == context.user_id

    @staticmethod
    def _can_modify(context: OrganisationContext, record: SubmissionRecord) -> bool:
        return context.can(Permission.SUBMISSIONS_MANAGE_ALL) or record.submitted_by == context.user_id

    def _load(
        self, context: OrganisationContext, submission_id: UUID, *, modify: bool = False
    ) -> SubmissionRecord:
        record = self._submissions.get(context.organisation_id, submission_id)
        if record is None or not self._can_view(context, record):
            raise _not_found()
        if modify and not self._can_modify(context, record):
            raise ForbiddenError("You can only change your own submissions.")
        return record

    @staticmethod
    def _require_editable(record: SubmissionRecord) -> None:
        if record.status not in EDITABLE_STATUSES:
            raise AppError(
                "Only draft submissions can be edited.",
                status_code=409,
                code="submission_locked",
            )

    def _transition(
        self,
        record: SubmissionRecord,
        target: SubmissionStatus,
        *,
        changes: dict[str, Any] | None = None,
    ) -> SubmissionRecord:
        """The only way a status changes: allowed by the lifecycle AND still true in the database."""
        if not can_transition(record.status, target):
            raise AppError(
                f"A {record.status.value} submission cannot become {target.value}.",
                status_code=409,
                code="invalid_transition",
            )
        updated = self._submissions.transition(
            record.organisation_id,
            record.id,
            from_status=record.status,
            to_status=target,
            changes=changes,
        )
        if updated is None:  # someone changed (or deleted) it between our read and write
            raise AppError(
                "The submission was changed by someone else. Reload and try again.",
                status_code=409,
                code="conflict",
            )
        return updated

    # -- create / read / update --------------------------------------------------------------

    def create(self, context: OrganisationContext, fields: dict[str, Any]) -> SubmissionRecord:
        return self._submissions.insert(
            organisation_id=context.organisation_id,
            submitted_by=context.user_id,
            fields=fields,
        )

    def list_submissions(
        self,
        context: OrganisationContext,
        *,
        limit: int,
        offset: int,
        status: SubmissionStatus | None = None,
        content_type: str | None = None,
        search: str | None = None,
        mine: bool = False,
    ) -> tuple[list[SubmissionSummary], int]:
        only_own = mine or not context.can(Permission.SUBMISSIONS_VIEW_ALL)
        return self._submissions.list_for_organisation(
            context.organisation_id,
            limit=limit,
            offset=offset,
            status=status,
            content_type=content_type,
            search=search.strip() if search else None,
            submitted_by=context.user_id if only_own else None,
        )

    def get(self, context: OrganisationContext, submission_id: UUID) -> SubmissionDetail:
        record = self._load(context, submission_id)
        attachments = self._attachments.list_for_submission(context.organisation_id, record.id)
        return SubmissionDetail(record, attachments)

    def update(
        self, context: OrganisationContext, submission_id: UUID, changes: dict[str, Any]
    ) -> SubmissionRecord:
        record = self._load(context, submission_id, modify=True)
        self._require_editable(record)
        if not changes:
            return record
        updated = self._submissions.update_draft(context.organisation_id, record.id, changes)
        if updated is None:  # no longer a draft (submitted or cancelled in the meantime)
            raise AppError(
                "The submission was changed by someone else. Reload and try again.",
                status_code=409,
                code="conflict",
            )
        return updated

    # -- workflow ----------------------------------------------------------------------------

    def submit(self, context: OrganisationContext, submission_id: UUID) -> SubmissionRecord:
        """draft -> submitted -> processing -> ready_for_analysis (or failed).

        "Processing" here only means: check the content is complete and within limits, and record
        how much text a later analysis will have to read. No analysis happens.
        """
        record = self._load(context, submission_id, modify=True)
        if record.status is not SubmissionStatus.DRAFT:
            raise AppError(
                f"A {record.status.value} submission cannot be submitted.",
                status_code=409,
                code="invalid_transition",
            )
        if record.content_type is None:
            raise AppError("Choose a content type before submitting.", status_code=422, code="invalid_submission")

        attachments = self._attachments.list_for_submission(context.organisation_id, record.id)
        if any(a.status is DocumentStatus.FAILED for a in attachments):
            raise AppError(
                "Remove the attachments that could not be processed before submitting.",
                status_code=409,
                code="attachment_failed",
            )
        if any(a.status is not DocumentStatus.READY for a in attachments):
            raise AppError(
                "An attachment is still being processed. Try again in a moment.",
                status_code=409,
                code="attachment_not_ready",
            )
        typed = record.content_text.strip()
        if len(typed) < CONTENT_MIN and not attachments:
            raise AppError(
                f"Add at least {CONTENT_MIN} characters of content or attach a document.",
                status_code=422,
                code="invalid_submission",
            )

        submitted = self._transition(record, SubmissionStatus.SUBMITTED, changes={"submitted_at": _now()})
        try:
            processing = self._transition(submitted, SubmissionStatus.PROCESSING)
            total = len(typed) + sum(a.text_length or 0 for a in attachments)
            if total > MAX_ANALYSIS_CHARS:
                return self._transition(
                    processing,
                    SubmissionStatus.FAILED,
                    changes={"error_message": _TOO_LONG, "processed_at": _now()},
                )
            return self._transition(
                processing,
                SubmissionStatus.READY_FOR_ANALYSIS,
                changes={"analysis_text_length": total, "processed_at": _now()},
            )
        except AppError:
            self._fail_quietly(context.organisation_id, record.id)  # never leave it "in progress"
            raise

    def cancel(self, context: OrganisationContext, submission_id: UUID) -> SubmissionRecord:
        return self._transition(
            self._load(context, submission_id, modify=True), SubmissionStatus.CANCELLED
        )

    def reopen(self, context: OrganisationContext, submission_id: UUID) -> SubmissionRecord:
        """failed -> draft, so the problem (e.g. a bad attachment) can be fixed and resubmitted."""
        return self._transition(
            self._load(context, submission_id, modify=True),
            SubmissionStatus.DRAFT,
            changes={
                "error_message": None,
                "submitted_at": None,
                "processed_at": None,
                "analysis_text_length": None,
            },
        )

    def delete(self, context: OrganisationContext, submission_id: UUID) -> None:
        """Remove the stored objects first, then the row (attachment rows cascade).

        If an object delete fails we stop with the rows intact so the user can retry; removing an
        already-removed object is a no-op, so a retry after a partial failure is safe.
        """
        record = self._load(context, submission_id, modify=True)
        if record.status not in DELETABLE_STATUSES:
            raise AppError(
                "Only draft, failed or cancelled submissions can be deleted. Cancel it first.",
                status_code=409,
                code="submission_locked",
            )
        for path in self._attachments.list_storage_paths(context.organisation_id, record.id):
            self._storage.remove(path)
        deleted = self._submissions.delete(
            context.organisation_id, record.id, allowed_statuses=DELETABLE_STATUSES
        )
        if not deleted:
            raise AppError(
                "The submission was changed by someone else. Reload and try again.",
                status_code=409,
                code="conflict",
            )

    # -- attachments -------------------------------------------------------------------------

    def add_attachment(
        self,
        context: OrganisationContext,
        submission_id: UUID,
        *,
        filename: str | None,
        content_type: str | None,
        data: bytes,
    ) -> AttachmentRecord:
        record = self._load(context, submission_id, modify=True)
        self._require_editable(record)
        existing = self._attachments.list_for_submission(context.organisation_id, record.id)
        if len(existing) >= MAX_ATTACHMENTS:
            raise AppError(
                f"A submission can have at most {MAX_ATTACHMENTS} attachments.",
                status_code=409,
                code="too_many_attachments",
            )

        upload = validate_upload(filename, content_type, data)  # same rules as the Knowledge Hub

        attachment_id = uuid4()
        # Only UUIDs and a validated extension: no user-supplied text, unique, organisation-scoped.
        storage_path = f"{context.organisation_id}/{record.id}/{attachment_id}.{upload.extension}"

        self._storage.upload(storage_path, data, upload.mime_type)  # raises 502 on failure
        try:
            attachment = self._attachments.insert(
                attachment_id=attachment_id,
                submission_id=record.id,
                organisation_id=context.organisation_id,
                uploaded_by=context.user_id,
                original_filename=upload.filename,
                storage_path=storage_path,
                mime_type=upload.mime_type,
                size_bytes=len(data),
            )
        except Exception:
            self._remove_quietly(storage_path)  # no row => nobody could ever delete this object
            raise
        return self._process_attachment(attachment, upload.extension, data)

    def _process_attachment(
        self, attachment: AttachmentRecord, extension: str, data: bytes
    ) -> AttachmentRecord:
        organisation_id, attachment_id = attachment.organisation_id, attachment.id
        try:
            self._attachments.mark_processing(organisation_id, attachment_id)
            outcome = extract_for_storage(extension, data, max_chars=MAX_EXTRACTED_CHARS)
            if outcome.failure is not None:
                updated = self._attachments.mark_failed(organisation_id, attachment_id, outcome.failure)
            else:
                updated = self._attachments.mark_ready(organisation_id, attachment_id, outcome.text or "")
            if updated is None:  # removed while we were processing it
                raise AppError("Attachment not found.", status_code=404, code="not_found")
            return updated
        except AppError:
            try:
                self._attachments.mark_failed(organisation_id, attachment_id, PROCESSING_FAILED)
            except Exception:
                logger.error("Could not mark an attachment as failed after a database error.")
            raise

    def remove_attachment(
        self, context: OrganisationContext, submission_id: UUID, attachment_id: UUID
    ) -> None:
        record = self._load(context, submission_id, modify=True)
        self._require_editable(record)
        attachment = self._attachments.get(context.organisation_id, record.id, attachment_id)
        if attachment is None:
            raise AppError("Attachment not found.", status_code=404, code="not_found")
        self._storage.remove(attachment.storage_path)
        self._attachments.delete(context.organisation_id, record.id, attachment.id)

    # -- cleanup helpers ---------------------------------------------------------------------

    def _remove_quietly(self, storage_path: str) -> None:
        try:
            self._storage.remove(storage_path)
        except Exception:
            logger.error("Could not clean up an orphaned stored object after a failed insert.")

    def _fail_quietly(self, organisation_id: UUID, submission_id: UUID) -> None:
        """Best effort: after a database error mid-pipeline, mark the submission failed."""
        for source in (SubmissionStatus.PROCESSING, SubmissionStatus.SUBMITTED):
            try:
                moved = self._submissions.transition(
                    organisation_id,
                    submission_id,
                    from_status=source,
                    to_status=SubmissionStatus.FAILED,
                    changes={"error_message": _PIPELINE_FAILED, "processed_at": _now()},
                )
            except Exception:
                logger.error("Could not mark a submission as failed after a database error.")
                return
            if moved is not None:
                return
