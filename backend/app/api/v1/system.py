from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import get_app_settings, get_current_user
from app.core.config import Settings
from app.schemas.system import IntegrationsResponse
from app.services.integrations import get_integration_statuses

# Every route in this router requires a verified Supabase access token.
router = APIRouter(prefix="/system", tags=["system"], dependencies=[Depends(get_current_user)])


# Authenticated users only. Restricting this to org admins comes with role permissions.
@router.get(
    "/integrations",
    response_model=IntegrationsResponse,
    summary="Which integrations have credentials configured",
)
def integrations(settings: Annotated[Settings, Depends(get_app_settings)]) -> IntegrationsResponse:
    return IntegrationsResponse(integrations=get_integration_statuses(settings))
