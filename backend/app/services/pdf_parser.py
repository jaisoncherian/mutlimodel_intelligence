"""Pure PDF parsing and OCR helpers."""

from __future__ import annotations

import io
import re
from typing import Any

import fitz
import pdfplumber
import pytesseract
from PIL import Image, ImageOps


class PdfError(ValueError):
    """A user-safe PDF validation or parsing error."""


def validate_pdf(data: bytes) -> None:
    """Validate PDF bytes and enforce the ingestion page constraints."""
    if not data or not data.startswith(b"%PDF-"):
        raise PdfError("The file is not a valid PDF.")
    try:
        with fitz.open(stream=data, filetype="pdf") as document:
            if document.needs_pass:
                raise PdfError("Password-protected PDFs are not supported.")
            if len(document) < 1:
                raise PdfError("The PDF must contain at least one page.")
            if len(document) > 300:
                raise PdfError("The PDF cannot contain more than 300 pages.")
    except PdfError:
        raise
    except Exception as error:
        raise PdfError("The file could not be opened as a PDF.") from error


def _font_sizes(page: fitz.Page) -> dict[tuple[float, float, float, float], float]:
    sizes: dict[tuple[float, float, float, float], float] = {}
    for block in page.get_text("dict", sort=True).get("blocks", []):
        spans = [
            span
            for line in block.get("lines", [])
            for span in line.get("spans", [])
            if span.get("text", "").strip()
        ]
        if spans:
            sizes[tuple(block["bbox"])] = max(float(span["size"]) for span in spans)
    return sizes


def extract_page_text(page: fitz.Page) -> tuple[str, list[dict[str, Any]]]:
    """Extract sorted native text and block metadata from one page."""
    sizes = _font_sizes(page)
    blocks: list[dict[str, Any]] = []
    text_parts: list[str] = []
    for block in page.get_text("blocks", sort=True):
        if len(block) < 5 or not block[4].strip():
            continue
        bbox = tuple(float(value) for value in block[:4])
        text = str(block[4]).strip()
        text_parts.append(text)
        blocks.append(
            {
                "bbox": list(bbox),
                "text": text,
                "font_size": sizes.get(bbox),
            }
        )
    return "\n".join(text_parts), blocks


def render_page_png(page: fitz.Page, dpi: int = 150) -> bytes:
    """Render a page as PNG bytes."""
    pixmap = page.get_pixmap(dpi=dpi, alpha=False)
    return pixmap.tobytes("png")


def needs_ocr(text: str, page: fitz.Page) -> bool:
    """Return whether the page is likely scanned or has unusable native text."""
    if len(text.strip()) < 20 and bool(page.get_images(full=True)):
        return True
    visible = [character for character in text if not character.isspace()]
    if not visible:
        return bool(page.get_images(full=True))
    non_alphanumeric = sum(
        not (character.isalnum() or character.isspace()) for character in text
    )
    return non_alphanumeric / max(len(text), 1) > 0.30


def ocr_page(page: fitz.Page) -> tuple[str, float | None]:
    """OCR a page at 300 DPI and return text plus mean word confidence."""
    image = Image.open(io.BytesIO(render_page_png(page, dpi=300))).convert("L")
    image = ImageOps.autocontrast(image)
    data = pytesseract.image_to_data(
        image,
        lang="eng",
        output_type=pytesseract.Output.DICT,
    )
    words: list[str] = []
    confidences: list[float] = []
    for word, confidence in zip(data["text"], data["conf"], strict=True):
        word = word.strip()
        if not word:
            continue
        words.append(word)
        try:
            value = float(confidence)
        except (TypeError, ValueError):
            continue
        if value >= 0:
            confidences.append(value)
    mean = sum(confidences) / len(confidences) if confidences else None
    return " ".join(words), mean


def _clean_cell(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def _markdown(headers: list[str], rows: list[list[str]]) -> str:
    if not headers:
        return ""
    lines = [
        "| " + " | ".join(headers) + " |",
        "| " + " | ".join("---" for _ in headers) + " |",
    ]
    lines.extend("| " + " | ".join(row) + " |" for row in rows)
    return "\n".join(lines)


def extract_tables(plumber_page: pdfplumber.page.Page) -> list[dict[str, Any]]:
    """Extract non-empty tables as headers, rows, and markdown."""
    results: list[dict[str, Any]] = []
    for table in plumber_page.extract_tables() or []:
        cleaned = [[_clean_cell(cell) for cell in row] for row in table if row]
        if len(cleaned) < 2 or max((len(row) for row in cleaned), default=0) < 2:
            continue
        width = max(len(row) for row in cleaned)
        normalized = [row + [""] * (width - len(row)) for row in cleaned]
        headers = normalized[0]
        rows = normalized[1:]
        results.append(
            {
                "headers": headers,
                "rows": rows,
                "markdown": _markdown(headers, rows),
            }
        )
    return results
