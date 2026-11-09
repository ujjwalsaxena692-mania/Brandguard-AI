from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends

from app import __version__
from app.api.deps import get_app_settings
from app.core.config import Settings
from app.schemas.health import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Liveness check")
def health(settings: Annotated[Settings, Depends(get_app_settings)]) -> HealthResponse:
    """Confirms the API process is running. Does not check external services."""
    return HealthResponse(
        status="ok",
        service=settings.app_name,
        version=__version__,
        environment=settings.environment.value,
        timestamp=datetime.now(UTC),
    )
