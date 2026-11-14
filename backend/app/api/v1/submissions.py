"""Content submission endpoints.

The organisation always comes from the verified token's membership (never from the request) and
every route checks a role permission first. Creators only ever see their own submissions; a
submission that is not yours looks exactly like one that does not exist (HTTP 404).
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from starlette.concurrency import run_in_threadpool

from app.api.deps import CurrentOrganisation, require_permission
from app.api.uploads import read_single_file
from app.models.organisation import OrganisationContext, Permission
from app.models.submission import SUBMISSION_BUCKET, ContentType, SubmissionStatus
from app.repositories.submission_attachments import AttachmentRepository
from app.repositories.submissions import SubmissionRepository
from app.schemas.submission import (
    AttachmentResponse,
    SubmissionCreate,
    SubmissionDetailResponse,
    SubmissionListResponse,
    SubmissionResponse,
    SubmissionUpdate,
)
from app.services.knowledge_storage import KnowledgeStorage
from app.services.submissions import SubmissionService

router = APIRouter(prefix="/submissions", tags=["submissions"])


def get_submission_service(request: Request) -> SubmissionService:
    """Service bound to the app's Supabase settings (HTTP 503 if Supabase is not configured)."""
    client = request.app.state.supabase_service.get_client()
    return SubmissionService(
        SubmissionRepository(client),
        AttachmentRepository(client),
        KnowledgeStorage(client, SUBMISSION_BUCKET),
    )


CanWrite = Annotated[OrganisationContext, Depends(require_permission(Permission.SUBMISSIONS_CREATE))]
Service = Annotated[SubmissionService, Depends(get_submission_service)]


@router.post("", status_code=201, response_model=SubmissionDetailResponse)
def create_submission(
    body: SubmissionCreate, context: CanWrite, service: Service
) -> SubmissionDetailResponse:
    record = service.create(context, body.model_dump(mode="json", exclude_unset=True))
    return SubmissionDetailResponse.from_record(record)


@router.get("", response_model=SubmissionListResponse)
def list_submissions(
    context: CurrentOrganisation,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    status: SubmissionStatus | None = None,
    content_type: ContentType | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    mine: bool = False,
) -> SubmissionListResponse:
    """Creators see only their own submissions; reviewers, admins and owners see everyone's
    (``mine=true`` narrows that to your own)."""
    items, total = service.list_submissions(
        context,
        limit=limit,
        offset=offset,
        status=status,
        content_type=content_type.value if content_type else None,
        search=q,
        mine=mine,
    )
    return SubmissionListResponse(
        items=[SubmissionResponse.from_summary(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{submission_id}", response_model=SubmissionDetailResponse)
def get_submission(
    submission_id: UUID, context: CurrentOrganisation, service: Service
) -> SubmissionDetailResponse:
    return SubmissionDetailResponse.from_detail(service.get(context, submission_id))


@router.patch("/{submission_id}", response_model=SubmissionDetailResponse)
def update_submission(
    submission_id: UUID, body: SubmissionUpdate, context: CanWrite, service: Service
) -> SubmissionDetailResponse:
    record = service.update(
        context, submission_id, body.model_dump(mode="json", exclude_unset=True)
    )
    return SubmissionDetailResponse.from_detail(service.get(context, record.id))


@router.delete("/{submission_id}", status_code=204)
def delete_submission(submission_id: UUID, context: CanWrite, service: Service) -> Response:
    service.delete(context, submission_id)
    return Response(status_code=204)


@router.post("/{submission_id}/submit", response_model=SubmissionDetailResponse)
def submit_submission(
    submission_id: UUID, context: CanWrite, service: Service
) -> SubmissionDetailResponse:
    record = service.submit(context, submission_id)
    return SubmissionDetailResponse.from_detail(service.get(context, record.id))


@router.post("/{submission_id}/cancel", response_model=SubmissionDetailResponse)
def cancel_submission(
    submission_id: UUID, context: CanWrite, service: Service
) -> SubmissionDetailResponse:
    record = service.cancel(context, submission_id)
    return SubmissionDetailResponse.from_detail(service.get(context, record.id))


@router.post("/{submission_id}/reopen", response_model=SubmissionDetailResponse)
def reopen_submission(
    submission_id: UUID, context: CanWrite, service: Service
) -> SubmissionDetailResponse:
    record = service.reopen(context, submission_id)
    return SubmissionDetailResponse.from_detail(service.get(context, record.id))


@router.post("/{submission_id}/attachments", status_code=201, response_model=AttachmentResponse)
async def add_attachment(
    submission_id: UUID, request: Request, context: CanWrite, service: Service
) -> AttachmentResponse:
    """Attach one PDF, DOCX or TXT file (multipart field ``file``, max 10 MB) to a draft."""
    upload = await read_single_file(request)
    attachment = await run_in_threadpool(
        service.add_attachment,
        context,
        submission_id,
        filename=upload.filename,
        content_type=upload.content_type,
        data=upload.data,
    )
    return AttachmentResponse.from_summary(attachment)


@router.delete("/{submission_id}/attachments/{attachment_id}", status_code=204)
def remove_attachment(
    submission_id: UUID, attachment_id: UUID, context: CanWrite, service: Service
) -> Response:
    service.remove_attachment(context, submission_id, attachment_id)
    return Response(status_code=204)
