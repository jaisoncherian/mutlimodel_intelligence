"""Page-local text and table chunking."""

from __future__ import annotations

import re
from typing import Any, Callable

TokenCounter = Callable[[str], int]
MAX_TOKENS = 240
OVERLAP_WORDS = 30


def _split_sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def _pack(parts: list[str], counter: TokenCounter) -> list[str]:
    chunks: list[str] = []
    current: list[str] = []
    for part in parts:
        candidate = " ".join(current + [part])
        if current and counter(candidate) > MAX_TOKENS:
            chunks.append(" ".join(current))
            overlap = " ".join(" ".join(current).split()[-OVERLAP_WORDS:])
            current = [overlap, part] if overlap else [part]
            while counter(" ".join(current)) > MAX_TOKENS and len(current) > 1:
                current.pop(0)
        else:
            current.append(part)
    if current:
        chunks.append(" ".join(current))
    return [chunk for chunk in chunks if counter(chunk) >= 5]


def chunk_pages(pages: list[dict[str, Any]], tables: list[dict[str, Any]],
                token_counter: TokenCounter) -> list[dict[str, Any]]:
    """Create chunks without crossing page boundaries."""
    output: list[dict[str, Any]] = []
    pages_by_number = {int(page["page_number"]): page for page in pages}
    for page in pages:
        page_number = int(page["page_number"])
        content_type = "ocr" if page.get("extraction_method") == "ocr" else "text"
        blocks = page.get("blocks") or []
        parts = [str(block.get("text", "")).strip() for block in blocks if str(block.get("text", "")).strip()]
        if not parts:
            parts = _split_sentences(str(page.get("text") or ""))
        chunks = _pack(parts, token_counter)
        section = str(page.get("section") or (blocks[0].get("section") if blocks else f"Page {page_number}"))
        for index, content in enumerate(chunks):
            output.append({
                "page_number": page_number, "section": section,
                "content_type": content_type, "chunk_index": index,
                "table_index": None, "token_count": token_counter(content),
                "content": content,
            })
    for table in tables:
        page_number = int(table["page_number"])
        page = pages_by_number.get(page_number, {})
        section = str(page.get("section") or f"Page {page_number}")
        markdown = str(table.get("markdown") or "").strip()
        if not markdown:
            continue
        parts = _pack([markdown], token_counter)
        if token_counter(markdown) > MAX_TOKENS:
            headers = table.get("headers") or []
            rows = table.get("rows") or []
            header = "| " + " | ".join(map(str, headers)) + " |"
            parts = []
            group: list[str] = []
            for row in rows:
                line = "| " + " | ".join(map(str, row)) + " |"
                candidate = "\n".join([header, *group, line])
                if group and token_counter(candidate) > MAX_TOKENS:
                    parts.append("\n".join([header, *group]))
                    group = [line]
                else:
                    group.append(line)
            if group:
                parts.append("\n".join([header, *group]))
        for index, content in enumerate(parts):
            output.append({
                "page_number": page_number, "section": section,
                "content_type": "table", "chunk_index": index,
                "table_index": int(table["table_index"]), "token_count": token_counter(content),
                "content": content,
            })
    return output
