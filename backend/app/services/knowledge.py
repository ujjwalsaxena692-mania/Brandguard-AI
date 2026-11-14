"""Knowledge Hub use cases: upload (store, extract text), list, read, delete.

Authorisation is NOT done here: callers pass an ``OrganisationContext`` that was already
resolved and permission-checked by the API dependencies. Everything below is scoped to
``context.organisation_id`` and ``context.user_id`` (both verified), never to request input.

Upload order (so a failure never leaves an object nobody can see or delete):
  1. validate  2. store the object  3. insert the metadata row ("uploaded")
  4. "processing"  5. extract text  6. "ready" or "failed" (with a short, fixed reason)
If step 3 fails the stored object is removed again. Extraction problems are not request
errors: the document is kept with status "failed" so the user can see why and delete it.
"""

from __future__ import annotations

import logging
from uuid import UUID, uuid4

from app.core.errors import AppError
from app.models.knowledge import (
    MAX_EXTRACTED_CHARS,
    KnowledgeDocumentRecord,
    KnowledgeDocumentSummary,
)
from app.models.organisation import OrganisationContext
from app.repositories.knowledge_documents import KnowledgeDocumentRepository
from app.services.knowledge_files import validate_upload
from app.services.knowledge_storage import KnowledgeStorage
from app.services.text_extraction import PROCESSING_FAILED, extract_for_storage

logger = logging.getLogger("brandguard.knowledge")


class KnowledgeService:
    def __init__(self, repository: KnowledgeDocumentRepository, storage: KnowledgeStorage) -> None:
        self._repository = repository
        self._storage = storage

    # -- upload ------------------------------------------------------------------------------

    def upload(
        self,
        context: OrganisationContext,
        *,
        filename: str | None,
        content_type: str | None,
        data: bytes,
    ) -> KnowledgeDocumentRecord:
        upload = validate_upload(filename, content_type, data)

        document_id = uuid4()
        # Built only from UUIDs and a validated extension: nothing user-supplied, always unique,
        # and always under the caller's own organisation prefix.
        storage_path = f"{context.organisation_id}/{document_id}.{upload.extension}"

        self._storage.upload(storage_path, data, upload.mime_type)  # raises 502 on failure
        try:
            record = self._repository.insert(
                document_id=document_id,
                organisation_id=context.organisation_id,
                uploaded_by=context.user_id,
                original_filename=upload.filename,
                storage_path=storage_path,
                mime_type=upload.mime_type,
                size_bytes=len(data),
            )
        except Exception:
            self._remove_quietly(storage_path)  # no metadata row => nobody could ever delete it
            raise

        return self._process(record, upload.extension, data)

    def _process(
        self, record: KnowledgeDocumentRecord, extension: str, data: bytes
    ) -> KnowledgeDocumentRecord:
        organisation_id, document_id = record.organisation_id, record.id
        try:
            self._repository.mark_processing(organisation_id, document_id)

            outcome = extract_for_storage(extension, data, max_chars=MAX_EXTRACTED_CHARS)
            failure, text = outcome.failure, outcome.text or ""

            if failure is not None:
                updated = self._repository.mark_failed(organisation_id, document_id, failure)
            else:
                updated = self._repository.mark_ready(organisation_id, document_id, text)
            if updated is None:  # deleted while we were processing it
                raise AppError("Document not found.", status_code=404, code="not_found")
            return updated
        except AppError:
            # The database failed mid-pipeline: do not leave the row looking "in progress".
            self._fail_quietly(organisation_id, document_id)
            raise

    # -- read --------------------------------------------------------------------------------

    def list_documents(
        self, context: OrganisationContext, *, limit: int, offset: int
    ) -> list[KnowledgeDocumentSummary]:
        return self._repository.list_for_organisation(
            context.organisation_id, limit=limit, offset=offset
        )

    def get(self, context: OrganisationContext, document_id: UUID) -> KnowledgeDocumentRecord:
        record = self._repository.get(context.organisation_id, document_id)
        if record is None:  # also what a document of another organisation looks like
            raise AppError("Document not found.", status_code=404, code="not_found")
        return record

    # -- delete ------------------------------------------------------------------------------

    def delete(self, context: OrganisationContext, document_id: UUID) -> None:
        """Remove the stored object first, then the row.

        If the object delete fails we stop with the row intact, so the user can retry. If only
        the row delete fails, the retry still works (removing a missing object is a no-op).
        The opposite order could orphan objects that nothing references any more.
        """
        record = self.get(context, document_id)
        self._storage.remove(record.storage_path)
        self._repository.delete(context.organisation_id, document_id)

    # -- cleanup helpers ---------------------------------------------------------------------

    def _remove_quietly(self, storage_path: str) -> None:
        try:
            self._storage.remove(storage_path)
        except Exception:
            logger.error("Could not clean up an orphaned stored object after a failed insert.")

    def _fail_quietly(self, organisation_id: UUID, document_id: UUID) -> None:
        try:
            self._repository.mark_failed(organisation_id, document_id, PROCESSING_FAILED)
        except Exception:
            logger.error("Could not mark a document as failed after a database error.")
