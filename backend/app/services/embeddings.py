"""Lazy CPU-only sentence-transformer embeddings."""

from __future__ import annotations

import threading
from typing import Any

_lock = threading.Lock()
_model: Any | None = None


def _get_model() -> Any:
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                from sentence_transformers import SentenceTransformer
                _model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", device="cpu")
    return _model


def token_count(text: str) -> int:
    """Use the production model tokenizer when available."""
    tokenizer = _get_model().tokenizer
    return len(tokenizer.encode(text, add_special_tokens=True))


def embed_texts(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    if not texts:
        return []
    vectors = _get_model().encode(
        texts, batch_size=batch_size, device="cpu", normalize_embeddings=True,
        convert_to_numpy=True, show_progress_bar=False,
    )
    return [list(map(float, vector)) for vector in vectors]
