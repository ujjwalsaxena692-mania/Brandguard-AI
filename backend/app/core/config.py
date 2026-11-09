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
from pydantic import BaseModel, ConfigDict, SecretStr, field_validator

BACKEND_DIR = Path(__file__).resolve().parents[2]

_VALID_LOG_LEVELS = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}


class Environment(str, Enum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class Settings(BaseModel):
    """Validated, immutable application settings."""

    model_config = ConfigDict(frozen=True)

    app_name: str = "BrandGuard AI API"
    environment: Environment = Environment.DEVELOPMENT
    log_level: str = "INFO"
    allowed_origins: tuple[str, ...] = (
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    )

    supabase_url: str | None = None
    supabase_service_role_key: SecretStr | None = None
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
