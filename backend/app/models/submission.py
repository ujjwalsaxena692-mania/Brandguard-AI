"""Content submissions: statuses, allowed transitions, limits and records (pure, no I/O).

Lifecycle (this phase ends at "ready_for_analysis": no AI analysis or review happens here):

    draft -> submitted -> processing -> ready_for_analysis
      |          |             |                |
      |          +--> failed <-+                +--> cancelled
      +--> cancelled      failed -> draft (reopen to fix) | cancelled
"""

from __future__ import annotations

from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.knowledge import DocumentStatus

SUBMISSION_BUCKET = "submission-attachments"  # private; separate from approved knowledge

TITLE_MIN, TITLE_MAX = 3, 120
CONTENT_MIN, CONTENT_MAX = 20, 20_000  # typed text; attachments add their own extracted text
CAMPAIGN_MAX, AUDIENCE_MAX, PLATFORM_MAX, CONTEXT_MAX = 100, 150, 100, 1000
MAX_ATTACHMENTS = 5
MAX_ANALYSIS_CHARS = 1_000_000  # typed text + all attachment text, checked while "processing"


class SubmissionStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PROCESSING = "processing"
    READY_FOR_ANALYSIS = "ready_for_analysis"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ContentType(str, Enum):
    SOCIAL_POST = "social_post"
    AD_COPY = "ad_copy"
    BLOG_POST = "blog_post"
    EMAIL_NEWSLETTER = "email_newsletter"
    LANDING_PAGE = "landing_page"
    PRESS_RELEASE = "press_release"
    PRODUCT_DESCRIPTION = "product_description"
    PRESENTATION = "presentation"
    OTHER = "other"


S = SubmissionStatus
ALLOWED_TRANSITIONS: dict[SubmissionStatus, frozenset[SubmissionStatus]] = {
    S.DRAFT: frozenset({S.SUBMITTED, S.CANCELLED}),
    S.SUBMITTED: frozenset({S.PROCESSING, S.FAILED, S.CANCELLED}),
    S.PROCESSING: frozenset({S.READY_FOR_ANALYSIS, S.FAILED}),
    S.READY_FOR_ANALYSIS: frozenset({S.CANCELLED}),
    S.FAILED: frozenset({S.DRAFT, S.CANCELLED}),
    S.CANCELLED: frozenset(),
}
EDITABLE_STATUSES = frozenset({S.DRAFT})  # fields and attachments change only while a draft
DELETABLE_STATUSES = frozenset({S.DRAFT, S.FAILED, S.CANCELLED})


def can_transition(current: SubmissionStatus, target: SubmissionStatus) -> bool:
    return target in ALLOWED_TRANSITIONS[current]


class SubmissionSummary(BaseModel):
    """Submission metadata for lists. Never includes the typed content or attachment text."""

    model_config = ConfigDict(frozen=True)

    id: UUID
    organisation_id: UUID
    submitted_by: UUID | None = None
    title: str
    content_type: ContentType | None = None
    campaign_name: str | None = None
    target_audience: str | None = None
    platform: str | None = None
    publishing_date: date | None = None
    status: SubmissionStatus
    error_message: str | None = None
    submitted_at: datetime | None = None
    processed_at: datetime | None = None
    analysis_text_length: int | None = None
    created_at: datetime
    updated_at: datetime


class SubmissionRecord(SubmissionSummary):
    content_text: str = ""
    reviewer_context: str | None = None


class AttachmentSummary(BaseModel):
    """Attachment metadata. Never includes the storage path or the extracted text."""

    model_config = ConfigDict(frozen=True)

    id: UUID
    submission_id: UUID
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


class AttachmentRecord(AttachmentSummary):
    storage_path: str
    extracted_text: str | None = None
