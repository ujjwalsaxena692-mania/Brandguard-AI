"""Shared FastAPI dependencies."""

from __future__ import annotations

from collections.abc import Callable
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings
from app.core.errors import AppError, AuthenticationError
from app.models.organisation import OrganisationContext, Permission
from app.services.auth import AuthenticatedUser, TokenVerifier
from app.services.organisation_access import OrganisationAccessService, require_context_permission

# Optional header that selects one of the caller's OWN organisations (never a grant of access).
ORGANISATION_HEADER = "X-Organisation-Id"

# auto_error=False: a missing/odd Authorization header must produce OUR structured 401
# (with WWW-Authenticate), not FastAPI's default response.
_bearer_scheme = HTTPBearer(auto_error=False)


def get_app_settings(request: Request) -> Settings:
    """Settings attached to the running app (keeps tests free of global state)."""
    settings: Settings = request.app.state.settings
    return settings


def get_token_verifier(request: Request) -> TokenVerifier:
    """The verifier attached to the running app (created once in ``create_app``)."""
    verifier: TokenVerifier = request.app.state.token_verifier
    return verifier


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer_scheme)],
    verifier: Annotated[TokenVerifier, Depends(get_token_verifier)],
) -> AuthenticatedUser:
    """Authenticate the caller from ``Authorization: Bearer <Supabase access token>``.

    Raises 401 for a missing, malformed, invalid or expired token (503 if the signing keys
    cannot be obtained). The returned user id comes ONLY from the verified token's ``sub``
    claim. Never take a user id from a request body, query string or custom header.
    """
    if credentials is None or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        raise AuthenticationError()
    return verifier.verify(credentials.credentials)


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]


def get_organisation_access_service(request: Request) -> OrganisationAccessService:
    """Access service bound to the running app's Supabase settings (503 if not configured)."""
    return OrganisationAccessService(request.app.state.supabase_service)


def get_organisation_context(
    user: CurrentUser,
    access: Annotated[OrganisationAccessService, Depends(get_organisation_access_service)],
    x_organisation_id: Annotated[str | None, Header()] = None,
) -> OrganisationContext:
    """The caller's organisation and role, resolved from the database for the VERIFIED user.

    ``X-Organisation-Id`` is optional and only *selects* one of the caller's own active
    memberships (needed when they belong to several). It never grants access: the membership
    is looked up with the verified user id, so any other organisation id gets HTTP 403.
    Organisation or user ids in request bodies or query strings are never consulted.
    """
    requested: UUID | None = None
    if x_organisation_id is not None:
        try:
            requested = UUID(x_organisation_id.strip())
        except ValueError:
            raise AppError(
                "Invalid organisation identifier.", status_code=400, code="invalid_organisation_id"
            ) from None
    return access.resolve_context(user.user_id, requested)


CurrentOrganisation = Annotated[OrganisationContext, Depends(get_organisation_context)]


def require_permission(permission: Permission) -> Callable[..., OrganisationContext]:
    """Dependency factory: ``Depends(require_permission(Permission.AUDIT_LOG_VIEW))``.

    Resolves the organisation context, then requires the caller's role to grant ``permission``
    (HTTP 403 otherwise). Returns the context so handlers can use ``context.organisation_id``.
    """

    def dependency(context: CurrentOrganisation) -> OrganisationContext:
        require_context_permission(context, permission)
        return context

    return dependency
