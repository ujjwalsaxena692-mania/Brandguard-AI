"""Plain-text extraction for PDF, DOCX and TXT. No OCR, no AI.

Pure functions: bytes in, text out. Every failure becomes ``ExtractionError`` with a short,
fixed, user-safe reason; library error messages (which can contain paths or content) are
logged by type only and never returned.
"""

from __future__ import annotations

import io
import logging
import re
import zipfile
from dataclasses import dataclass

logger = logging.getLogger("brandguard.knowledge")

MAX_PDF_PAGES = 500
MAX_DOCX_UNCOMPRESSED_BYTES = 100 * 1024 * 1024  # guards against zip bombs
MAX_DOCX_ENTRIES = 5000

PROCESSING_FAILED = "The document could not be processed."
TOO_MUCH_TEXT = "The document contains too much text to process."
_UNREADABLE = "The document could not be read. It may be corrupt."
_NO_TEXT = "No extractable text was found in the document."

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_EXCESS_BLANK_LINES = re.compile(r"\n{3,}")


class ExtractionError(Exception):
    """The document cannot be turned into text. ``reason`` is safe to show to users."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


def normalise_text(text: str) -> str:
    """Strip control characters (PostgreSQL text cannot hold NUL), unify newlines, trim."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = _CONTROL_CHARS.sub("", text)
    text = "\n".join(line.rstrip() for line in text.split("\n"))
    return _EXCESS_BLANK_LINES.sub("\n\n", text).strip()


def _extract_txt(data: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise ExtractionError("The text file uses an unsupported character encoding.")


def _extract_pdf(data: bytes) -> str:
    try:
        from pypdf import PdfReader
    except ImportError as exc:
        logger.error("pypdf is not installed; cannot read PDFs.")
        raise ExtractionError("PDF processing is not available on this server.") from exc

    try:
        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted and not reader.decrypt(""):
            raise ExtractionError("The PDF is password-protected.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise ExtractionError(f"The PDF has more than {MAX_PDF_PAGES} pages.")
        return "\n\n".join((page.extract_text() or "") for page in reader.pages)
    except ExtractionError:
        raise
    except Exception as exc:  # pypdf raises many types on malformed input
        logger.warning("PDF extraction failed (%s).", type(exc).__name__)
        raise ExtractionError(_UNREADABLE) from exc


def _docx_blocks(document) -> list[str]:  # noqa: ANN001 - python-docx types are optional
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    if hasattr(document, "iter_inner_content"):  # python-docx >= 1.0: document order
        blocks = list(document.iter_inner_content())
    else:
        blocks = [*document.paragraphs, *document.tables]
    lines: list[str] = []
    for block in blocks:
        if isinstance(block, Paragraph):
            lines.append(block.text)
        elif isinstance(block, Table):
            for table_row in block.rows:
                lines.append(" | ".join(cell.text.strip() for cell in table_row.cells))
    return lines


def _extract_docx(data: bytes) -> str:
    try:
        import docx
    except ImportError as exc:
        logger.error("python-docx is not installed; cannot read DOCX files.")
        raise ExtractionError("DOCX processing is not available on this server.") from exc

    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            entries = archive.infolist()
            if len(entries) > MAX_DOCX_ENTRIES or (
                sum(entry.file_size for entry in entries) > MAX_DOCX_UNCOMPRESSED_BYTES
            ):
                raise ExtractionError("The document is too large to process.")
        return "\n".join(_docx_blocks(docx.Document(io.BytesIO(data))))
    except ExtractionError:
        raise
    except Exception as exc:  # BadZipFile, KeyError (missing parts), XML errors...
        logger.warning("DOCX extraction failed (%s).", type(exc).__name__)
        raise ExtractionError(_UNREADABLE) from exc


_EXTRACTORS = {"pdf": _extract_pdf, "docx": _extract_docx, "txt": _extract_txt}


def extract_text(extension: str, data: bytes) -> str:
    """Return the normalised text of a document, or raise ``ExtractionError``."""
    extractor = _EXTRACTORS.get(extension)
    if extractor is None:
        raise ExtractionError("Unsupported document type.")
    text = normalise_text(extractor(data))
    if not text:
        raise ExtractionError(_NO_TEXT)
    return text


@dataclass(frozen=True)
class ExtractionOutcome:
    """Exactly one of ``text`` / ``failure`` is set. ``failure`` is a short, user-safe reason."""

    text: str | None = None
    failure: str | None = None


def extract_for_storage(extension: str, data: bytes, *, max_chars: int) -> ExtractionOutcome:
    """``extract_text`` plus the rules both Knowledge Hub documents and submission attachments
    share: text over ``max_chars`` is refused, and any unexpected parser error becomes a generic
    failure (logged by type only) instead of a 500."""
    try:
        text = extract_text(extension, data)
    except ExtractionError as exc:
        return ExtractionOutcome(failure=exc.reason)
    except Exception as exc:  # defensive: a parser bug must not become a server error
        logger.error("Unexpected extraction error (%s).", type(exc).__name__)
        return ExtractionOutcome(failure=PROCESSING_FAILED)
    if len(text) > max_chars:
        return ExtractionOutcome(failure=TOO_MUCH_TEXT)
    return ExtractionOutcome(text=text)
