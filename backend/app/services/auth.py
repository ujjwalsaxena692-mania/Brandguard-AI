"""Verification of Supabase access tokens (JWTs) on the API.

How it works
------------
* Supabase signs user access tokens with an asymmetric key (ES256). The matching PUBLIC keys are
  published at ``<SUPABASE_URL>/auth/v1/.well-known/jwks.json``. We fetch them from there, cache
  them, and pick the key by the token's ``kid`` header. No shared secret is configured or used.
* Only the algorithms in ``Settings.supabase_jwt_algorithms`` (ES256) are accepted, so ``none``
  and HS256 "algorithm confusion" tokens are rejected.
* ``exp``, ``sub``, ``aud`` and ``iss`` are required. Audience, issuer and leeway come from
  settings. ``sub`` must be a UUID: it is the only thing used as the caller's identity.
* Every verification failure becomes a generic ``AuthenticationError`` (HTTP 401). The reason is
  logged by exception *type* only; the token itself is never logged or returned.
* If the signing keys cannot be fetched (network/Supabase outage) or auth is not configured, the
  result is HTTP 503, not 401: the caller's token may be fine, and the API fails closed either way.

Key rotation: an unknown ``kid`` triggers ONE refresh of the key set, rate-limited by
``JWKS_REFRESH_COOLDOWN_SECONDS`` so that garbage tokens cannot make the API hammer Supabase.
"""

from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass
from typing import Any, Protocol
from uuid import UUID

import jwt
from jwt import PyJWK, PyJWKClient
from jwt.exceptions import InvalidTokenError, PyJWKClientConnectionError, PyJWKClientError

from app.core.config import Settings
from app.core.errors import AppError, AuthenticationError

logger = logging.getLogger("brandguard.auth")

JWKS_PATH = "/auth/v1/.well-known/jwks.json"
JWKS_CACHE_LIFESPAN_SECONDS = 600
JWKS_FETCH_TIMEOUT_SECONDS = 5
JWKS_REFRESH_COOLDOWN_SECONDS = 30


class AuthUnavailableError(AppError):
    """Authentication cannot be performed right now (not configured, or keys unreachable)."""

    status_code = 503
    code = "auth_unavailable"

    def __init__(self) -> None:
        super().__init__("Authentication is temporarily unavailable.")


@dataclass(frozen=True)
class AuthenticatedUser:
    """The caller, as proven by a verified token. Nothing here comes from the request body."""

    user_id: UUID
    email: str | None = None


class JwksClient(Protocol):
    """The part of ``jwt.PyJWKClient`` that the verifier uses (lets tests inject a fake)."""

    def get_signing_keys(self, refresh: bool = False) -> list[PyJWK]: ...


class TokenVerifier:
    def __init__(self, settings: Settings, jwks_client: JwksClient | None = None) -> None:
        self._settings = settings
        self._jwks_client = jwks_client
        self._lock = threading.Lock()
        self._last_refresh = float("-inf")

    # -- key lookup ---------------------------------------------------------------------------

    def _client(self) -> JwksClient:
        if self._jwks_client is None:
            if not self._settings.supabase_url:
                logger.error("Token verification attempted but SUPABASE_URL is not configured.")
                raise AuthUnavailableError()
            headers: dict[str, str] = {}
            # The JWKS endpoint is public; the publishable (browser-safe) key is sent only if set.
            if self._settings.supabase_publishable_key is not None:
                headers["apikey"] = self._settings.supabase_publishable_key.get_secret_value()
            self._jwks_client = PyJWKClient(
                f"{self._settings.supabase_url}{JWKS_PATH}",
                cache_keys=True,
                cache_jwk_set=True,
                lifespan=JWKS_CACHE_LIFESPAN_SECONDS,
                headers=headers or None,
                timeout=JWKS_FETCH_TIMEOUT_SECONDS,
            )
        return self._jwks_client

    @staticmethod
    def _match(keys: list[PyJWK], kid: str) -> PyJWK | None:
        return next((key for key in keys if key.key_id == kid), None)

    def _signing_key(self, kid: str) -> PyJWK:
        client = self._client()
        try:
            key = self._match(client.get_signing_keys(refresh=False), kid)
            if key is not None:
                return key

            # Unknown kid: possibly a rotated key. Refresh at most once per cooldown window.
            with self._lock:
                now = time.monotonic()
                if now - self._last_refresh < JWKS_REFRESH_COOLDOWN_SECONDS:
                    logger.warning("Token signed with unknown key id; key refresh rate-limited.")
                    raise AuthenticationError()
                self._last_refresh = now
                refreshed = client.get_signing_keys(refresh=True)
            key = self._match(refreshed, kid)
        except PyJWKClientConnectionError as exc:
            logger.error("Could not fetch Supabase signing keys (%s).", type(exc).__name__)
            raise AuthUnavailableError() from exc
        except PyJWKClientError as exc:
            # Malformed or empty key set is a server-side/Supabase problem, not the caller's.
            logger.error("Unusable Supabase signing key set (%s).", type(exc).__name__)
            raise AuthUnavailableError() from exc

        if key is None:
            logger.warning("Token signed with unknown key id after key refresh.")
            raise AuthenticationError()
        return key

    # -- verification -------------------------------------------------------------------------

    def verify(self, token: str) -> AuthenticatedUser:
        """Return the verified user, or raise AuthenticationError / AuthUnavailableError."""
        settings = self._settings
        issuer = settings.supabase_jwt_issuer
        if issuer is None:
            logger.error("Token verification attempted but SUPABASE_URL is not configured.")
            raise AuthUnavailableError()

        try:
            header = jwt.get_unverified_header(token)
            kid = header.get("kid")
            if header.get("alg") not in settings.supabase_jwt_algorithms or not isinstance(kid, str):
                logger.warning("Rejected token: unsupported algorithm or missing key id.")
                raise AuthenticationError()

            signing_key = self._signing_key(kid)
            claims: dict[str, Any] = jwt.decode(
                token,
                signing_key.key,
                algorithms=list(settings.supabase_jwt_algorithms),
                audience=settings.supabase_jwt_audience,
                issuer=issuer,
                leeway=settings.supabase_jwt_leeway_seconds,
                options={"require": ["exp", "sub", "aud", "iss"]},
            )
            user_id = UUID(str(claims["sub"]))
        except (AuthenticationError, AuthUnavailableError):
            raise
        except InvalidTokenError as exc:
            # Covers expired, bad signature, wrong aud/iss, missing claims, malformed token.
            logger.warning("Rejected token: %s.", type(exc).__name__)
            raise AuthenticationError() from exc
        except ValueError as exc:
            logger.warning("Rejected token: subject is not a valid UUID.")
            raise AuthenticationError() from exc

        email = claims.get("email")
        return AuthenticatedUser(user_id=user_id, email=email if isinstance(email, str) else None)
