from __future__ import annotations

from scripts.eval_retrieval import _first_complete_match


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
