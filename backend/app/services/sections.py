"""Section detection from page block metadata."""

from __future__ import annotations

import re
from statistics import median
from typing import Any

_SHORT_HEADINGS = {
    "abstract", "introduction", "conclusion", "references", "appendix",
    "summary", "overview", "results", "methods",
}


def _is_heading(text: str, size: float | None, body_size: float) -> bool:
    words = text.split()
    if not words or len(words) > 15:
        return False
    numbered = bool(re.match(r"^\d+(?:\.\d+)*\s+\S", text))
    named = len(words) <= 4 and text.rstrip(".").lower() in _SHORT_HEADINGS
    large = size is not None and size >= 1.15 * body_size and not text.endswith(".")
    return numbered or named or large


def detect_sections(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Tag each ordered block with the active section name."""
    known_section: str | None = None
    result: list[dict[str, Any]] = []
    for page in pages:
        blocks = list(page.get("blocks") or [])
        weighted: list[float] = []
        for block in blocks:
            size = block.get("font_size")
            if isinstance(size, (int, float)):
                weighted.extend([float(size)] * max(1, len(str(block.get("text", "")).split())))
        body_size = float(median(weighted)) if weighted else 0.0
        page_number = int(page.get("page_number", 0))
        active = known_section or f"Page {page_number}"
        tagged: list[dict[str, Any]] = []
        for block in blocks:
            text = str(block.get("text", "")).strip()
            if _is_heading(text, block.get("font_size"), body_size):
                active = text
                known_section = active
            tagged.append({**block, "section": active})
        if not blocks:
            active = known_section or f"Page {page_number}"
        result.append({**page, "blocks": tagged, "section": active})
    return result
