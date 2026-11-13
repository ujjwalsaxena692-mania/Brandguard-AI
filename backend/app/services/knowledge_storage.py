"""Server-side access to the private Knowledge Hub storage bucket.

Uses the service-role Supabase client (never exposed to the browser). The bucket is private
and has no Storage policies, so clients cannot read or write objects directly, and this module
never creates public or signed URLs. Callers pass paths they generated (``<org>/<doc>.<ext>``).
"""

from __future__ import annotations

import logging
from typing import Any

from app.core.errors import AppError
from app.models.knowledge import KNOWLEDGE_BUCKET

logger = logging.getLogger("brandguard.knowledge")


class StorageUnavailableError(AppError):
    status_code = 502
    code = "storage_unavailable"

    def __init__(self) -> None:
        super().__init__("Document storage is temporarily unavailable.")


class KnowledgeStorage:
    def __init__(self, client: Any, bucket: str = KNOWLEDGE_BUCKET) -> None:
        self._client = client
        self._bucket = bucket

    def _bucket_api(self) -> Any:
        return self._client.storage.from_(self._bucket)

    def upload(self, path: str, data: bytes, content_type: str) -> None:
        try:
            self._bucket_api().upload(
                path=path,
                file=data,
                file_options={"content-type": content_type, "upsert": "false"},
            )
        except Exception as exc:  # storage3 raises its own error types
            logger.error("Storage upload failed (%s).", type(exc).__name__)
            raise StorageUnavailableError() from exc

    def remove(self, path: str) -> None:
        """Delete one object. Removing a missing object is not an error (idempotent)."""
        try:
            self._bucket_api().remove([path])
        except Exception as exc:
            logger.error("Storage delete failed (%s).", type(exc).__name__)
            raise StorageUnavailableError() from exc
