"""Knowledge Hub endpoints: approved brand-knowledge documents (PDF, DOCX, TXT).

Every route resolves the caller's organisation from the verified token (never from the request)
and checks a role permission before doing anything else, including before reading an upload.
"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from starlette.concurrency import run_in_threadpool

from app.api.deps import require_permission
from app.api.uploads import read_single_file
from app.models.organisation import OrganisationContext, Permission
from app.repositories.knowledge_documents import KnowledgeDocumentRepository
from app.schemas.knowledge import (
    KnowledgeDocumentDetailResponse,
    KnowledgeDocumentListResponse,
    KnowledgeDocumentResponse,
)
from app.services.knowledge import KnowledgeService
from app.services.knowledge_storage import KnowledgeStorage

router = APIRouter(prefix="/knowledge/documents", tags=["knowledge"])


def get_knowledge_service(request: Request) -> KnowledgeService:
    """Service bound to the app's Supabase settings (HTTP 503 if Supabase is not configured)."""
    client = request.app.state.supabase_service.get_client()
    return KnowledgeService(KnowledgeDocumentRepository(client), KnowledgeStorage(client))


CanView = Annotated[OrganisationContext, Depends(require_permission(Permission.KNOWLEDGE_VIEW))]
CanManage = Annotated[OrganisationContext, Depends(require_permission(Permission.KNOWLEDGE_MANAGE))]
Service = Annotated[KnowledgeService, Depends(get_knowledge_service)]


@router.post("", status_code=201, response_model=KnowledgeDocumentDetailResponse)
async def upload_document(
    request: Request, context: CanManage, service: Service
) -> KnowledgeDocumentDetailResponse:
    """Upload one PDF, DOCX or TXT file (multipart field ``file``, max 10 MB)."""
    upload = await read_single_file(request)
    record = await run_in_threadpool(
        service.upload,
        context,
        filename=upload.filename,
        content_type=upload.content_type,
        data=upload.data,
    )
    return KnowledgeDocumentDetailResponse.from_record(record)


@router.get("", response_model=KnowledgeDocumentListResponse)
def list_documents(
    context: CanView,
    service: Service,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> KnowledgeDocumentListResponse:
    documents = service.list_documents(context, limit=limit, offset=offset)
    return KnowledgeDocumentListResponse(
        items=[KnowledgeDocumentResponse.from_summary(d) for d in documents],
        limit=limit,
        offset=offset,
    )


@router.get("/{document_id}", response_model=KnowledgeDocumentDetailResponse)
def get_document(
    document_id: UUID, context: CanView, service: Service
) -> KnowledgeDocumentDetailResponse:
    return KnowledgeDocumentDetailResponse.from_record(service.get(context, document_id))


@router.delete("/{document_id}", status_code=204)
def delete_document(document_id: UUID, context: CanManage, service: Service) -> Response:
    service.delete(context, document_id)
    return Response(status_code=204)
