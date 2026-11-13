from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel

from app.models.organisation import Role


class OrganisationContextResponse(BaseModel):
    organisation_id: UUID
    role: Role
    permissions: list[str]
