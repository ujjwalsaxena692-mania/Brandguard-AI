"""Reports which external integrations have credentials configured.

This only inspects configuration. It does NOT contact the services, so
"configured" never means "verified reachable".
"""

from __future__ import annotations

from app.core.config import Settings
from app.schemas.system import IntegrationState, IntegrationStatus

_CONFIGURED_DETAIL = "Credentials are present. Connectivity is not verified in this release."


def _status(key: str, name: str, configured: bool, missing: str) -> IntegrationStatus:
    return IntegrationStatus(
        key=key,
        name=name,
        state=IntegrationState.CONFIGURED if configured else IntegrationState.NOT_CONFIGURED,
        detail=_CONFIGURED_DETAIL if configured else missing,
    )


def get_integration_statuses(settings: Settings) -> list[IntegrationStatus]:
    return [
        _status(
            "supabase",
            "Supabase",
            settings.supabase_configured,
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        ),
        _status(
            "anthropic",
            "Anthropic Claude API",
            settings.anthropic_configured,
            "Set ANTHROPIC_API_KEY.",
        ),
        _status(
            "embedding",
            "Embedding provider",
            settings.embedding_configured,
            "Set EMBEDDING_PROVIDER and EMBEDDING_API_KEY.",
        ),
    ]
