"""Request ID propagation and access logging."""

from __future__ import annotations

import logging
import re
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

REQUEST_ID_HEADER = "X-Request-ID"
_VALID_REQUEST_ID = re.compile(r"[A-Za-z0-9._-]{8,64}")

logger = logging.getLogger("brandguard.access")


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a request ID to each request/response and log one line per request.

    Client-supplied IDs are only accepted if they look safe; otherwise a new ID is
    generated. Query strings are intentionally not logged (they may carry tokens).
    """

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        supplied = request.headers.get(REQUEST_ID_HEADER, "")
        request_id = supplied if _VALID_REQUEST_ID.fullmatch(supplied) else uuid.uuid4().hex
        request.state.request_id = request_id

        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - started) * 1000

        response.headers[REQUEST_ID_HEADER] = request_id
        logger.info(
            "%s %s -> %s (%.1f ms) request_id=%s",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
            request_id,
        )
        return response
