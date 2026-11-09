"""Application errors and structured error responses.

Every error returned by the API has the same shape::

    {"error": {"code": "...", "message": "...", "request_id": "...", "details": ...}}

Request payloads are never echoed back in error details.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)

_HTTP_ERROR_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    422: "validation_error",
    429: "too_many_requests",
}


class AppError(Exception):
    """Base class for expected, client-presentable errors."""

    status_code = 500
    code = "internal_error"

    def __init__(
        self,
        message: str,
        *,
        status_code: int | None = None,
        code: str | None = None,
        details: Any = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        if status_code is not None:
            self.status_code = status_code
        if code is not None:
            self.code = code
        self.details = details
        # Extra HTTP response headers (e.g. WWW-Authenticate). Copied so instances never share state.
        self.headers: dict[str, str] | None = dict(headers) if headers else None


class AuthenticationError(AppError):
    """The request carries no valid credentials (HTTP 401).

    The message is fixed on purpose: why verification failed (expired, bad signature, wrong
    audience, unknown key...) is logged server-side by the verifier and never sent to the client.
    """

    status_code = 401
    code = "unauthorized"  # same code the generic HTTP 401 handler uses

    def __init__(self) -> None:
        super().__init__("Authentication required.", headers={"WWW-Authenticate": "Bearer"})


class IntegrationNotConfiguredError(AppError):
    """Raised when a feature needs an integration that has no credentials."""

    status_code = 503
    code = "integration_not_configured"

    def __init__(self, integration: str) -> None:
        super().__init__(f"The {integration} integration is not configured on this server.")


class ForbiddenError(AppError):
    """The caller is authenticated but not allowed to do this."""

    status_code = 403
    code = "forbidden"

    def __init__(self, message: str = "You do not have permission to perform this action.") -> None:
        super().__init__(message)


class ConflictError(AppError):
    """The request conflicts with existing data (e.g. a unique constraint)."""

    status_code = 409
    code = "conflict"


class InvalidDataError(AppError):
    """The database rejected the data (constraint or foreign-key violation)."""

    status_code = 422
    code = "invalid_data"


class DatabaseError(AppError):
    """An unexpected database failure. Details are logged, never returned."""

    status_code = 500
    code = "database_error"

    def __init__(self, message: str = "A database error occurred.") -> None:
        super().__init__(message)


def _error_response(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: Any = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
        "request_id": getattr(request.state, "request_id", None),
    }
    if details is not None:
        error["details"] = details
    return JSONResponse(status_code=status_code, content={"error": error}, headers=headers)


async def _handle_app_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    log = logger.error if exc.status_code >= 500 else logger.warning
    log("AppError %s (%s): %s", exc.code, exc.status_code, exc.message)
    return _error_response(
        request, exc.status_code, exc.code, exc.message, exc.details, exc.headers
    )


async def _handle_http_exception(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    message = exc.detail if isinstance(exc.detail, str) else "Request could not be completed."
    code = _HTTP_ERROR_CODES.get(exc.status_code, "http_error")
    return _error_response(request, exc.status_code, code, message, headers=exc.headers)


async def _handle_validation_error(request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    details = [
        {
            "field": ".".join(str(part) for part in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
        }
        for error in exc.errors()
    ]
    return _error_response(request, 422, "validation_error", "Request validation failed.", details)


async def _handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return _error_response(request, 500, "internal_error", "An unexpected error occurred.")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _handle_app_error)
    app.add_exception_handler(StarletteHTTPException, _handle_http_exception)
    app.add_exception_handler(RequestValidationError, _handle_validation_error)
    app.add_exception_handler(Exception, _handle_unexpected_error)
