"""Supabase integration (server-side only).

WARNING: this client uses the service-role key, which bypasses Row Level
Security. Any code using it MUST scope data access to the caller's organisation,
determined from a verified user JWT - never from client-supplied values.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from app.core.config import Settings, get_settings
from app.core.errors import IntegrationNotConfiguredError


class SupabaseService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Any | None = None

    @property
    def is_configured(self) -> bool:
        return self._settings.supabase_configured

    def get_client(self) -> Any:
        """Return the Supabase client, creating it on first use.

        Raises IntegrationNotConfiguredError if credentials are missing, so
        callers never operate on a pretend connection.
        """
        if not self.is_configured:
            raise IntegrationNotConfiguredError("Supabase")
        if self._client is None:
            # Imported lazily so the API starts even if the SDK is not installed
            # and Supabase is not being used.
            from supabase import create_client

            assert self._settings.supabase_url is not None
            assert self._settings.supabase_service_role_key is not None
            self._client = create_client(
                self._settings.supabase_url,
                self._settings.supabase_service_role_key.get_secret_value(),
            )
        return self._client


@lru_cache
def get_supabase_service() -> SupabaseService:
    return SupabaseService(get_settings())
