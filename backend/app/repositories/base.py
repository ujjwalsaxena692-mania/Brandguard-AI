"""Shared database-call wrapper: turns driver errors into structured AppErrors."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any

from app.core.errors import (
    AppError,
    ConflictError,
    DatabaseError,
    ForbiddenError,
    InvalidDataError,
)

logger = logging.getLogger(__name__)

# PostgreSQL SQLSTATE -> application error. Raw database messages are logged, never returned.
_SQLSTATE_UNIQUE = "23505"
_SQLSTATE_INTEGRITY = {"23503", "23514", "23502", "22P02", "22001"}
_SQLSTATE_FORBIDDEN = {"42501"}


def translate_database_error(exc: Exception, operation: str) -> AppError:
    code = str(getattr(exc, "code", "") or "")
    logger.error("Database error during %s (sqlstate=%s): %s", operation, code or "?", exc)
    if code == _SQLSTATE_UNIQUE:
        return ConflictError("That record already exists.")
    if code in _SQLSTATE_INTEGRITY:
        return InvalidDataError("The data violates a database rule.")
    if code in _SQLSTATE_FORBIDDEN:
        return ForbiddenError()
    return DatabaseError()


def run_query(operation: str, call: Callable[[], Any]) -> list[dict[str, Any]]:
    """Execute a supabase-py query builder call and return its rows.

    ``call`` should build AND execute the query (``lambda: client.table(..).execute()``).
    """
    try:
        response = call()
    except AppError:
        raise
    except Exception as exc:  # driver/network errors vary by version; translate them all
        raise translate_database_error(exc, operation) from exc
    data = getattr(response, "data", None)
    if data is None:
        return []
    return list(data)
