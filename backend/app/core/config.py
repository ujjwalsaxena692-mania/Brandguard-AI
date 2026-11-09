"""Environment-based application configuration.

Settings are read from process environment variables, optionally populated from
``backend/.env`` for local development. Nothing here requires real credentials:
missing integrations simply report as not configured.
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from enum import Enum
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator

BACKEND_DIR = Path(__file__).resolve().parents[2]

_VALID_LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}

# Supabase signs user access tokens with ECC P-256 (ES256). This is deliberately a constant,
# not a setting: there is no HS256 / shared-secret fallback and "none" is never acceptable.
SUPABASE_JWT_ALGORITHMS: tuple[str, ...] = ("ES256",)
DEFAULT_JWT_AUDIENCE = "authenticated"
DEFAULT_JWT_LEEWAY_SECONDS = 30
MAX_JWT_LEEWAY_SECONDS = 120


class Environment(str, Enum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseModel):
    """Validated, immutable application settings."""

    # hide_input_in_errors: a ValidationError must never echo the offending input, because
    # several fields hold credentials (e.g. a secret key pasted into the publishable slot).
    model_config = ConfigDict(frozen=True, hide_input_in_errors=True)

    app_name: str = "BrandGuard AI API"
    environment: Environment = Environment.DEVELOPMENT
    log_level: str = "INFO"
    allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )

    supabase_url: str | None = None
    supabase_service_role_key: SecretStr | None = None
    # Browser-safe key. Needed only by authentication features, never by public endpoints.
    supabase_publishable_key: SecretStr | None = None
    supabase_jwt_audience: str = DEFAULT_JWT_AUDIENCE
    supabase_jwt_leeway_seconds: int = Field(
        default=DEFAULT_JWT_LEEWAY_SECONDS, ge=0, le=MAX_JWT_LEEWAY_SECONDS
    )
    anthropic_api_key: SecretStr | None = None
    embedding_provider: str | None = None
    embedding_api_key: SecretStr | None = None

    @field_validator("log_level")
    @classmethod
    def _validate_log_level(cls, value: str) -> str:
        level = value.upper()
        if level not in _VALID_LOG_LEVELS:
            raise ValueError(f"LOG_LEVEL must be one of {sorted(_VALID_LOG_LEVELS)}")
        return level

    @field_validator("allowed_origins")
    @classmethod
    def _validate_origins(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        cleaned = tuple(origin.strip().rstrip("/") for origin in value if origin.strip())
        if "*" in cleaned:
            # Credentialed requests are used, so a wildcard origin is unsafe.
            raise ValueError("ALLOWED_ORIGINS must list explicit origins; '*' is not allowed")
        return cleaned

    @field_validator("supabase_url")
    @classmethod
    def _validate_supabase_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.startswith(("https://", "http://")):
            raise ValueError("SUPABASE_URL must start with https:// (or http:// for local dev)")
        return value.rstrip("/")

    @field_validator("supabase_service_role_key")
    @classmethod
    def _validate_service_role_key(cls, value: SecretStr | None) -> SecretStr | None:
        # A browser-safe key in the server slot (or vice versa) is a misconfiguration.
        if value is not None and value.get_secret_value().startswith("sb_publishable_"):
            raise ValueError(
                "SUPABASE_SERVICE_ROLE_KEY looks like a publishable key; "
                "use the server-side secret key"
            )
        return value

    @field_validator("supabase_publishable_key")
    @classmethod
    def _validate_publishable_key(cls, value: SecretStr | None) -> SecretStr | None:
        # A server-side secret key must never be configured in the browser-safe slot.
        if value is not None and value.get_secret_value().startswith("sb_secret_"):
            raise ValueError(
                "SUPABASE_PUBLISHABLE_KEY looks like a secret key; use the publishable key"
            )
        return value

    @field_validator("supabase_jwt_audience")
    @classmethod
    def _validate_jwt_audience(cls, value: str) -> str:
        audience = value.strip()
        if not audience:
            raise ValueError("SUPABASE_JWT_AUDIENCE must not be blank")
        return audience

    @property
    def supabase_jwt_issuer(self) -> str | None:
        """Expected ``iss`` claim: ``<SUPABASE_URL>/auth/v1`` (None until the URL is set)."""
        if not self.supabase_url:
            return None
        return f"{self.supabase_url}/auth/v1"

    @property
    def supabase_jwt_algorithms(self) -> tuple[str, ...]:
        """Accepted signing algorithms. Always ES256 only."""
        return SUPABASE_JWT_ALGORITHMS

    @property
    def auth_configured(self) -> bool:
        return not self.missing_auth_settings()

    def missing_auth_settings(self) -> list[str]:
        """Environment variable NAMES (never values) still needed for authentication."""
        missing: list[str] = []
        if not self.supabase_url:
            missing.append("SUPABASE_URL")
        if self.supabase_publishable_key is None:
            missing.append("SUPABASE_PUBLISHABLE_KEY")
        return missing

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def anthropic_configured(self) -> bool:
        return self.anthropic_api_key is not None

    @property
    def embedding_configured(self) -> bool:
        return bool(self.embedding_provider and self.embedding_api_key)

    @property
    def is_production(self) -> bool:
        return self.environment is Environment.PRODUCTION

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        """Build settings from a mapping (defaults to ``os.environ``).

        Blank values are treated as unset so ``.env.example`` can be copied as-is.
        """
        source = os.environ if env is None else env

        def read(name: str) -> str | None:
            value = source.get(name)
            if value is None:
                return None
            value = value.strip()
            return value or None

        raw_origins = read("ALLOWED_ORIGINS")
        values: dict[str, object] = {
            "environment": read("APP_ENV"),
            "log_level": read("LOG_LEVEL"),
            "allowed_origins": tuple(raw_origins.split(",")) if raw_origins else None,
            "supabase_url": read("SUPABASE_URL"),
            "supabase_service_role_key": read("SUPABASE_SERVICE_ROLE_KEY"),
            "supabase_publishable_key": read("SUPABASE_PUBLISHABLE_KEY"),
            "supabase_jwt_audience": read("SUPABASE_JWT_AUDIENCE"),
            "supabase_jwt_leeway_seconds": read("SUPABASE_JWT_LEEWAY_SECONDS"),
            "anthropic_api_key": read("ANTHROPIC_API_KEY"),
            "embedding_provider": read("EMBEDDING_PROVIDER"),
            "embedding_api_key": read("EMBEDDING_API_KEY"),
        }
        # Let model defaults apply for anything that is not set.
        return cls(**{key: value for key, value in values.items() if value is not None})


@lru_cache
def get_settings() -> Settings:
    """Load ``backend/.env`` (if present) and return the cached settings."""
    load_dotenv(BACKEND_DIR / ".env", override=False)
    return Settings.from_env()
