from __future__ import annotations

from app.services import search


def test_search_merges_and_deduplicates_with_rrf(monkeypatch) -> None:
    monkeypatch.setattr(search.embeddings, "embed_texts", lambda texts: [[0.1, 0.2]])
    monkeypatch.setattr(
        search.chunks,
        "vector_search",
        lambda *args, **kwargs: [
            {"chunk_id": 1, "doc_id": "d", "filename": "a.pdf", "page_number": 1,
             "content_type": "text", "text": "one", "vector_similarity": 0.9},
            {"chunk_id": 2, "doc_id": "d", "filename": "a.pdf", "page_number": 2,
             "content_type": "text", "text": "two", "vector_similarity": 0.8},
        ],
    )
    monkeypatch.setattr(
        search.chunks,
        "keyword_search",
        lambda *args, **kwargs: [
            {"chunk_id": 2, "doc_id": "d", "filename": "a.pdf", "page_number": 2,
             "content_type": "text", "text": "two", "keyword_score": 1.0},
        ],
    )
    results = search.search("useful query", k=2)
    assert [item["chunk_id"] for item in results] == [2, 1]
    assert results[0]["scores"]["vector_rank"] == 2
    assert results[0]["scores"]["keyword_rank"] == 1


def test_keyword_search_uses_or_terms_and_skips_stopwords(monkeypatch) -> None:
    calls: list[tuple[object, ...]] = []
    monkeypatch.setattr(
        search.chunks,
        "keyword_search",
        lambda *args, **kwargs: calls.append(args) or [],
    )
    assert search.search("the revenue and cost", mode="keyword") == []
    assert calls[0][0] == "revenue | cost"
