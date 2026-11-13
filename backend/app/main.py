"""FastAPI application entry point.

Run locally:  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import health
from app.api.deps import ORGANISATION_HEADER
from app.api.v1.router import api_v1_router
from app.core.config import Settings, get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging
from app.middleware.request_context import REQUEST_ID_HEADER, RequestContextMiddleware
from app.schemas.errors import ErrorResponse
from app.services.auth import TokenVerifier
from app.services.supabase_client import SupabaseService


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)

    # Interactive docs are disabled in production.
    docs_enabled = not settings.is_production
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        docs_url="/docs" if docs_enabled else None,
        redoc_url=None,
        openapi_url="/openapi.json" if docs_enabled else None,
        responses={
            422: {"model": ErrorResponse},
            500: {"model": ErrorResponse},
        },
    )
    app.state.settings = settings
    # No network access happens here; signing keys are fetched on the first authenticated request.
    app.state.token_verifier = TokenVerifier(settings)
    # Server-side (service-role) client, created lazily on first use; unconfigured => HTTP 503.
    app.state.supabase_service = SupabaseService(settings)

    # Added first => inner. RequestContext is added last => outermost.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.allowed_origins),
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", REQUEST_ID_HEADER, ORGANISATION_HEADER],
        expose_headers=[REQUEST_ID_HEADER],
    )
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(api_v1_router)
    return app


app = create_app()
