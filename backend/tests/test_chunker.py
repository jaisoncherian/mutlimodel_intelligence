"""Tests for page-local chunking and section assignment."""

from __future__ import annotations

from app.services import chunker


def _counter(text: str) -> int:
    return len(text.split())


def _page(page_number: int, blocks: list[dict], **kwargs) -> dict:
    return {"page_number": page_number, "blocks": blocks, **kwargs}


def test_heading_in_middle_splits_chunk_and_section_follows_first_block() -> None:
    pages = [
        _page(
            13,
            [
                {"text": "ImageNet setup text about training runs.", "section": "C PROOF OF THEOREM 1"},
                {"text": "More setup text continues the theorem section.", "section": "C PROOF OF THEOREM 1"},
                {"text": "E FITTING RANDOM LABELS WITH EXPLICIT REGULARIZATION", "section": "E FITTING RANDOM LABELS WITH EXPLICIT REGULARIZATION"},
                {"text": "with ReLU activiations. Hence, the final size is computed here.", "section": "E FITTING RANDOM LABELS WITH EXPLICIT REGULARIZATION"},
            ],
        )
    ]
    rows = chunker.chunk_pages(pages, [], _counter)
    sections = [r["section"] for r in rows]
    # First block's section wins for the first chunk; heading starts a new chunk.
    assert sections[0] == "C PROOF OF THEOREM 1"
    assert "E FITTING RANDOM LABELS WITH EXPLICIT REGULARIZATION" in sections
    # No chunk spans both sections.
    assert all(
        "ImageNet" not in r["content"] or r["section"] == "C PROOF OF THEOREM 1"
        for r in rows
    )


def test_first_block_section_wins_not_last_heading() -> None:
    pages = [
        _page(
            14,
            [
                {"text": "with ReLU activiations. Hence, the final size is small.", "section": "D PREVIOUS SECTION"},
                {"text": "E FITTING RANDOM LABELS WITH EXPLICIT REGULARIZATION", "section": "E FITTING RANDOM LABELS WITH EXPLICIT REGULARIZATION"},
            ],
        )
    ]
    rows = chunker.chunk_pages(pages, [], _counter)
    assert rows[0]["section"] == "D PREVIOUS SECTION"
    assert rows[0]["content"].startswith("with ReLU activiations")
    assert rows[1]["section"] == "E FITTING RANDOM LABELS WITH EXPLICIT REGULARIZATION"


def test_heading_at_page_end_carries_forward_to_next_page() -> None:
    pages = [
        _page(
            5,
            [
                {"text": "Body text before the heading.", "section": "Old Section"},
                {"text": "NEW HEADING AT PAGE END", "section": "NEW HEADING AT PAGE END"},
            ],
        ),
        _page(
            6,
            [
                {"text": "Body text on next page continues the new section.", "section": "NEW HEADING AT PAGE END"},
                {"text": "More text still in the new section.", "section": "NEW HEADING AT PAGE END"},
            ],
        ),
    ]
    rows = chunker.chunk_pages(pages, [], _counter)
    page5 = [r for r in rows if r["page_number"] == 5]
    page6 = [r for r in rows if r["page_number"] == 6]
    # Heading starts its own chunk on page 5 (not merged into previous chunk).
    assert page5[-1]["section"] == "NEW HEADING AT PAGE END"
    assert page5[-1]["content"].startswith("NEW HEADING AT PAGE END")
    # Next page carries the heading section forward.
    assert all(r["section"] == "NEW HEADING AT PAGE END" for r in page6)


def test_page_without_headings_unchanged() -> None:
    pages = [
        _page(
            1,
            [
                {"text": "Just regular body text here.", "section": "Page 1"},
                {"text": "More regular text continues here.", "section": "Page 1"},
            ],
        )
    ]
    rows = chunker.chunk_pages(pages, [], _counter)
    assert len(rows) == 1
    assert rows[0]["section"] == "Page 1"


def test_ocr_page_unchanged() -> None:
    pages = [
        _page(
            2,
            [],
            extraction_method="ocr",
            text="OCR extracted text. Second sentence here. Third sentence.",
            section="OCR Section",
        )
    ]
    rows = chunker.chunk_pages(pages, [], _counter)
    assert all(r["content_type"] == "ocr" for r in rows)
    assert all(r["section"] == "OCR Section" for r in rows)
    assert len(rows) >= 1
