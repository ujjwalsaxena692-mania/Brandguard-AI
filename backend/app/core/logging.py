"""Basic logging setup."""

from __future__ import annotations

import logging

_LOG_FORMAT = "%(asctime)s %(levelname)-8s %(name)s | %(message)s"


def configure_logging(level: str = "INFO") -> None:
    """Configure root logging once; safe to call repeatedly."""
    logging.basicConfig(level=level, format=_LOG_FORMAT, force=True)
