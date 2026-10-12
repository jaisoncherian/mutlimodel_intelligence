"""Build clean, embedded chunks for a processed document."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from ..repositories import chunks, documents
from . import chunker, embeddings, sections, text_cleaning

logger = logging.getLogger(__name__)


def index_document(doc_id: UUID) -> int:
    chunks.delete_chunks(doc_id)
    pages = documents.list_pages_for_index(doc_id)
    tables = documents.list_tables_for_index(doc_id)
    for page in pages:
        page["text"] = text_cleaning.clean_text(str(page.get("text") or ""))
        for block in page.get("blocks") or []:
            block["text"] = text_cleaning.clean_text(str(block.get("text") or ""))
    detected = sections.detect_sections(pages)
    rows = chunker.chunk_pages(detected, tables, embeddings.token_count)
    embedded = embeddings.embed_texts([
        f"{row.get('section') or ''}\n{row['content']}" for row in rows
    ])
    for row, vector in zip(rows, embedded, strict=True):
        row["embedding"] = vector
    document = documents.get_document(doc_id)
    user_id = document.get("user_id") if document else None
    inserted = 0
    for start in range(0, len(rows), 100):
        inserted += chunks.insert_chunks(doc_id, user_id, rows[start:start + 100])
    documents.set_indexed(doc_id, inserted)
    return inserted
