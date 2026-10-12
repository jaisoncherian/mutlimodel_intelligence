from __future__ import annotations

from app.services.chunker import chunk_pages
from app.services.sections import detect_sections
from app.services.text_cleaning import clean_text


def test_clean_text_handles_ligatures_hyphens_and_page_numbers() -> None:
    text = "ﬁle fam-\nily state-of-the-art\n\n2"
    assert clean_text(text) == "file family state-of-the-art"


def test_sections_detect_heading_and_carry_forward() -> None:
    pages = [
        {"page_number": 1, "blocks": [
            {"text": "Introduction", "font_size": 18},
            {"text": "Body text here.", "font_size": 10},
        ]},
        {"page_number": 2, "blocks": [{"text": "Continued body text.", "font_size": 10}]},
    ]
    result = detect_sections(pages)
    assert result[0]["blocks"][1]["section"] == "Introduction"
    assert result[1]["blocks"][0]["section"] == "Introduction"


def test_chunking_is_page_local_and_removes_tiny_chunks() -> None:
    pages = [
        {"page_number": 1, "text": "one two three four five six seven eight nine ten", "blocks": []},
        {"page_number": 2, "text": "another page with enough words to make a chunk", "blocks": []},
    ]
    chunks = chunk_pages(pages, [], lambda text: len(text.split()))
    assert chunks
    assert {row["page_number"] for row in chunks} == {1, 2}
    assert all(row["token_count"] <= 240 for row in chunks)
