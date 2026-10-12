"""Hybrid vector and keyword retrieval."""

from __future__ import annotations

import re
from typing import Any
from uuid import UUID

from ..repositories import chunks
from . import embeddings

_STOPWORDS = {"a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
              "in", "is", "of", "on", "or", "that", "the", "to", "was", "what",
              "which", "with"}


def _terms(query: str) -> list[str]:
    return [term for term in re.findall(r"[A-Za-z0-9]+", query.lower())
            if term not in _STOPWORDS]


def _merge(vector_rows: list[dict[str, Any]], keyword_rows: list[dict[str, Any]], k: int) -> list[dict[str, Any]]:
    merged: dict[int, dict[str, Any]] = {}
    for rank, row in enumerate(vector_rows, 1):
        item = merged.setdefault(int(row["chunk_id"]), {**row, "scores": {
            "rrf": 0.0, "vector_similarity": row.get("vector_similarity"),
            "vector_rank": rank, "keyword_rank": None,
        }})
        item["scores"]["rrf"] += 1 / (60 + rank)
    for rank, row in enumerate(keyword_rows, 1):
        item = merged.setdefault(int(row["chunk_id"]), {**row, "scores": {
            "rrf": 0.0, "vector_similarity": None,
            "vector_rank": None, "keyword_rank": rank,
        }})
        item["scores"]["keyword_rank"] = rank
        item["scores"]["rrf"] += 1 / (60 + rank)
    return sorted(merged.values(), key=lambda row: row["scores"]["rrf"], reverse=True)[:k]


def search(query: str, k: int = 5, doc_ids: list[UUID] | None = None,
           content_types: list[str] | None = None, mode: str = "hybrid",
           user_id: UUID | None = None) -> list[dict[str, Any]]:
    terms = _terms(query)
    vector_rows = chunks.vector_search(
        embeddings.embed_texts([query])[0], 30, doc_ids, content_types, user_id
    ) if mode in {"hybrid", "vector"} else []
    keyword_rows = chunks.keyword_search(" | ".join(terms), 30, doc_ids, content_types, user_id) if terms and mode in {"hybrid", "keyword"} else []
    if mode == "vector":
        return _merge(vector_rows, [], k)
    if mode == "keyword":
        return _merge([], keyword_rows, k)
    return _merge(vector_rows, keyword_rows, k)
