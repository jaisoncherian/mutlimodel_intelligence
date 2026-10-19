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


def _make_chunk(
    page_number: int,
    section: str,
    content_type: str,
    chunk_index: int,
    table_index: int | None,
    content: str,
    counter: TokenCounter,
) -> dict[str, Any]:
    return {
        "page_number": page_number,
        "section": section,
        "content_type": content_type,
        "chunk_index": chunk_index,
        "table_index": table_index,
        "token_count": counter(content),
        "content": content,
    }


def _chunk_page_text(
    page_number: int, blocks: list[dict[str, Any]], counter: TokenCounter
) -> list[dict[str, Any]]:
    """Chunk page text, splitting at heading/section boundaries.

    A chunk's section is the section in force at its FIRST block. When a
    heading block starts a new section, the chunk is split there so the text
    after the heading begins a new chunk with the new section instead of one
    chunk spanning two sections.
    """
    output: list[dict[str, Any]] = []
    current_parts: list[str] = []
    current_section: str | None = None
    chunk_index = 0

    def emit() -> None:
        nonlocal current_parts, chunk_index
        if not current_parts:
            return
        content = " ".join(current_parts)
        if counter(content) >= 5:
            output.append(
                _make_chunk(
                    page_number,
                    current_section or f"Page {page_number}",
                    "text",
                    chunk_index,
                    None,
                    content,
                    counter,
                )
            )
            chunk_index += 1
        current_parts = []

    for block in blocks:
        text = str(block.get("text", "")).strip()
        if not text:
            continue
        block_section = str(block.get("section") or f"Page {page_number}")

        start_new = False
        if current_section is None:
            current_section = block_section
        elif block_section != current_section:
            start_new = True
        elif current_parts and counter(" ".join(current_parts + [text])) > MAX_TOKENS:
            start_new = True

        if start_new:
            emit()
            current_parts = [text]
            current_section = block_section
        else:
            current_parts.append(text)

    emit()
    return output


def chunk_pages(pages: list[dict[str, Any]], tables: list[dict[str, Any]],
                token_counter: TokenCounter) -> list[dict[str, Any]]:
    """Create chunks without crossing page boundaries."""
    output: list[dict[str, Any]] = []
    pages_by_number = {int(page["page_number"]): page for page in pages}
    for page in pages:
        page_number = int(page["page_number"])
        content_type = "ocr" if page.get("extraction_method") == "ocr" else "text"
        blocks = page.get("blocks") or []
        if blocks:
            output.extend(_chunk_page_text(page_number, blocks, token_counter))
        else:
            # OCR pages (no blocks): sentence-split page text; keep prior
            # page-level section behaviour so OCR output is unchanged.
            parts = _split_sentences(str(page.get("text") or ""))
            chunks = _pack(parts, token_counter)
            section = str(page.get("section") or f"Page {page_number}")
            for index, content in enumerate(chunks):
                output.append(
                    _make_chunk(page_number, section, content_type, index, None,
                                content, token_counter)
                )
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
