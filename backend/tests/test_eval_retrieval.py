from __future__ import annotations

from scripts.eval_retrieval import (
    _count_partial,
    _first_complete_match,
    _format_hit,
    _shorten_text,
)


def test_cross_document_match_requires_every_expected_page() -> None:
    results = [
        {"filename": "text_table.pdf", "page_number": 3},
        {"filename": "unrelated.pdf", "page_number": 1},
    ]
    expected = [
        {"filename": "text_table.pdf", "page": 3},
        {"filename": "two_column.pdf", "page": 1},
    ]

    assert _first_complete_match(results, expected) is None


def test_cross_document_match_rank_is_last_required_result() -> None:
    results = [
        {"filename": "text_table.pdf", "page_number": 3},
        {"filename": "two_column.pdf", "page_number": 1},
    ]
    expected = [
        {"filename": "text_table.pdf", "page": 3},
        {"filename": "two_column.pdf", "page": 1},
    ]

    assert _first_complete_match(results, expected) == 2


def test_count_partial_counts_found_expected_pairs() -> None:
    results = [
        {"filename": "text_table.pdf", "page_number": 3},
        {"filename": "unrelated.pdf", "page_number": 1},
    ]
    expected = [
        {"filename": "text_table.pdf", "page": 3},
        {"filename": "two_column.pdf", "page": 1},
    ]
    assert _count_partial(results, expected) == 1
    assert _count_partial([], expected) == 0


def test_shorten_text_truncates_and_cleans_whitespace() -> None:
    assert _shorten_text("short text", max_len=20) == "short text"
    long_text = "This is a very long string that should be truncated properly to fit within the character limit."
    shortened = _shorten_text(long_text, max_len=30)
    assert len(shortened) == 30
    assert shortened.endswith("...")
    assert _shorten_text("line\nbreak\t spaces") == "line break spaces"


def test_format_hit_replaces_newlines_in_section() -> None:
    hit = {
        "filename": "doc.pdf",
        "page_number": 4,
        "section": "1.1\nOUR CONTRIBUTIONS",
        "content_type": "text",
    }
    assert _format_hit(hit) == "doc.pdf:4|1.1 OUR CONTRIBUTIONS|text"
