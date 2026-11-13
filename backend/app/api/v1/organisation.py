"""Organisation context endpoints."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from app.api.deps import require_permission
from app.models.organisation import OrganisationContext, Permission
from app.schemas.organisation import OrganisationContextResponse

router = APIRouter(prefix="/organisation", tags=["organisation"])


@router.get("/context", response_model=OrganisationContextResponse)
def get_organisation_context(
    context: Annotated[OrganisationContext, Depends(require_permission(Permission.ORG_VIEW))],
) -> OrganisationContextResponse:
    """The caller's organisation, role and permissions (all derived from the database)."""
    return OrganisationContextResponse(
        organisation_id=context.organisation_id,
        role=context.role,
        permissions=sorted(p.value for p in Permission if context.can(p)),
    )
