"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings
from app.core.errors import AuthenticationError
from app.services.auth import AuthenticatedUser, TokenVerifier

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
