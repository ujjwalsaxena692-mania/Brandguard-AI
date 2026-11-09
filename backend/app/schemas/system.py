from __future__ import annotations

from enum import Enum

from pydantic import BaseModel


class IntegrationState(str, Enum):
    CONFIGURED = "configured"
    NOT_CONFIGURED = "not_configured"


class IntegrationStatus(BaseModel):
    key: str
    name: str
    state: IntegrationState
    detail: str


class IntegrationsResponse(BaseModel):
    integrations: list[IntegrationStatus]
