from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings
from app.core.config import Settings
from app.schemas.system import IntegrationsResponse
from app.services.integrations import get_integration_statuses

router = APIRouter(prefix="/system", tags=["system"])


# NOTE: unauthenticated in Part 01 because no auth exists yet. Require an
# authenticated admin before exposing this outside local development.
@router.get(
    "/integrations",
    response_model=IntegrationsResponse,
    summary="Which integrations have credentials configured",
)
def integrations(settings: Annotated[Settings, Depends(get_app_settings)]) -> IntegrationsResponse:
    return IntegrationsResponse(integrations=get_integration_statuses(settings))
