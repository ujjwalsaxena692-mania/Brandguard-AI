from __future__ import annotations

from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from app.models.knowledge import DocumentStatus
from app.models.submission import (
    AUDIENCE_MAX,
    CAMPAIGN_MAX,
    CONTENT_MAX,
    CONTEXT_MAX,
    PLATFORM_MAX,
    TITLE_MAX,
    TITLE_MIN,
    AttachmentSummary,
    ContentType,
    SubmissionRecord,
    SubmissionStatus,
    SubmissionSummary,
)
from app.services.submissions import SubmissionDetail

Title = Annotated[str, StringConstraints(strip_whitespace=True, min_length=TITLE_MIN, max_length=TITLE_MAX)]


class _SubmissionFields(BaseModel):
    """Client-editable fields. Unknown fields are rejected, so a client cannot send (and the
    server never reads) an organisation id, an author, a status or any other server-owned value."""

    model_config = ConfigDict(extra="forbid")

    content_type: ContentType | None = None
    content_text: str = Field(default="", max_length=CONTENT_MAX)
    campaign_name: str | None = Field(default=None, max_length=CAMPAIGN_MAX)
    target_audience: str | None = Field(default=None, max_length=AUDIENCE_MAX)
    platform: str | None = Field(default=None, max_length=PLATFORM_MAX)
    publishing_date: date | None = None
    reviewer_context: str | None = Field(default=None, max_length=CONTEXT_MAX)

    @field_validator("campaign_name", "target_audience", "platform", "reviewer_context")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        stripped = value.strip() if value else ""
        return stripped or None


class SubmissionCreate(_SubmissionFields):
    title: Title


class SubmissionUpdate(_SubmissionFields):
    """Partial update: only the fields present in the request change. Optional fields may be
    sent as null to clear them; the title and content text may not be null."""

    title: Title | None = None
    content_text: str | None = Field(default=None, max_length=CONTENT_MAX)  # type: ignore[assignment]

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> SubmissionUpdate:
        for name in ("title", "content_text"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class AttachmentResponse(BaseModel):
    """Attachment metadata. The storage path and extracted text are never returned."""

    id: UUID
    original_filename: str
    mime_type: str
    size_bytes: int
    status: DocumentStatus
    text_length: int | None
    error_message: str | None
    created_at: datetime

    @classmethod
    def from_summary(cls, attachment: AttachmentSummary) -> AttachmentResponse:
        return cls(
            id=attachment.id,
            original_filename=attachment.original_filename,
            mime_type=attachment.mime_type,
            size_bytes=attachment.size_bytes,
            status=attachment.status,
            text_length=attachment.text_length,
            error_message=attachment.error_message,
            created_at=attachment.created_at,
        )


class SubmissionResponse(BaseModel):
    id: UUID
    submitted_by: UUID | None
    title: str
    content_type: ContentType | None
    campaign_name: str | None
    target_audience: str | None
    platform: str | None
    publishing_date: date | None
    status: SubmissionStatus
    error_message: str | None
    submitted_at: datetime | None
    processed_at: datetime | None
    analysis_text_length: int | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_summary(cls, item: SubmissionSummary) -> SubmissionResponse:
        return cls(
            id=item.id,
            submitted_by=item.submitted_by,
            title=item.title,
            content_type=item.content_type,
            campaign_name=item.campaign_name,
            target_audience=item.target_audience,
            platform=item.platform,
            publishing_date=item.publishing_date,
            status=item.status,
            error_message=item.error_message,
            submitted_at=item.submitted_at,
            processed_at=item.processed_at,
            analysis_text_length=item.analysis_text_length,
            created_at=item.created_at,
            updated_at=item.updated_at,
        )


class SubmissionDetailResponse(SubmissionResponse):
    content_text: str
    reviewer_context: str | None
    attachments: list[AttachmentResponse]

    @classmethod
    def from_record(
        cls, record: SubmissionRecord, attachments: list[AttachmentSummary] | None = None
    ) -> SubmissionDetailResponse:
        return cls(
            **SubmissionResponse.from_summary(record).model_dump(),
            content_text=record.content_text,
            reviewer_context=record.reviewer_context,
            attachments=[AttachmentResponse.from_summary(a) for a in attachments or []],
        )

    @classmethod
    def from_detail(cls, detail: SubmissionDetail) -> SubmissionDetailResponse:
        return cls.from_record(detail.submission, detail.attachments)


class SubmissionListResponse(BaseModel):
    items: list[SubmissionResponse]
    total: int
    limit: int
    offset: int
