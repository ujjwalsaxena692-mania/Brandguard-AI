"""Shared FastAPI dependencies."""

from __future__ import annotations

from fastapi import Request

from app.core.config import Settings


def get_app_settings(request: Request) -> Settings:
    """Settings attached to the running app (keeps tests free of global state)."""
    settings: Settings = request.app.state.settings
    return settings
