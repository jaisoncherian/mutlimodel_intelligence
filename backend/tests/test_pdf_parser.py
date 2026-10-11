"""Unit tests for PDF parsing without a database or network."""

from __future__ import annotations

import io
import shutil

import fitz
import pytest
from PIL import Image, ImageDraw, ImageFont

from app.services.pdf_parser import (
    PdfError,
    extract_page_text,
    extract_tables,
    ocr_page,
    validate_pdf,
)


def _pdf_with_pages(page_texts: list[str]) -> bytes:
    document = fitz.open()
    for text in page_texts:
        page = document.new_page()
        page.insert_text((72, 72), text)
    data = document.tobytes()
    document.close()
    return data


def test_text_is_separate_per_page_and_numbered_by_parser() -> None:
    document = fitz.open(stream=_pdf_with_pages(["first page", "second page"]), filetype="pdf")
    try:
        values = [extract_page_text(page)[0] for page in document]
    finally:
        document.close()
    assert values == ["first page", "second page"]


def test_two_columns_are_read_left_before_right() -> None:
    document = fitz.open()
    page = document.new_page()
    page.insert_textbox(fitz.Rect(50, 50, 250, 300), "left column")
    page.insert_textbox(fitz.Rect(350, 50, 550, 300), "right column")
    text, _ = extract_page_text(page)
    document.close()
    assert text.index("left column") < text.index("right column")


@pytest.mark.parametrize("data", [b"not a pdf", b"%PDF-fake"])
def test_invalid_pdf_bytes_are_rejected(data: bytes) -> None:
    with pytest.raises(PdfError):
        validate_pdf(data)


def test_encrypted_pdf_is_rejected() -> None:
    document = fitz.open()
    document.new_page().insert_text((72, 72), "secret")
    encrypted = document.tobytes(
        encryption=fitz.PDF_ENCRYPT_AES_256,
        owner_pw="owner",
        user_pw="user",
    )
    document.close()
    with pytest.raises(PdfError, match="Password"):
        validate_pdf(encrypted)


def test_zero_page_pdf_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    class EmptyDocument:
        needs_pass = False

        def __enter__(self) -> "EmptyDocument":
            return self

        def __exit__(self, *args: object) -> None:
            return None

        def __len__(self) -> int:
            return 0

    monkeypatch.setattr("app.services.pdf_parser.fitz.open", lambda **kwargs: EmptyDocument())
    with pytest.raises(PdfError):
        validate_pdf(b"%PDF-1.7")


def test_oversized_file_is_rejected_by_upload_limit() -> None:
    app = __import__("app").create_app(
        {"TESTING": True, "DATABASE_URL": "", "MAX_FILE_SIZE": 3}
    )
    response = app.test_client().post(
        "/documents/upload",
        data={"files": (io.BytesIO(b"%PDF-oversized"), "file.pdf")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 202
    assert response.get_json()[0]["error"] == "File is too large."


def test_table_extracts_headers_rows_and_markdown() -> None:
    document = fitz.open()
    page = document.new_page(width=300, height=200)
    for x in (40, 140, 240):
        page.draw_line((x, 40), (x, 140))
    for y in (40, 90, 140):
        page.draw_line((40, y), (240, y))
    values = [["Name", "Score"], ["Ada", "10"]]
    for row, y in enumerate((70, 120)):
        for column, x in enumerate((50, 150)):
            page.insert_text((x, y), values[row][column])
    data = document.tobytes()
    document.close()
    import pdfplumber

    with pdfplumber.open(io.BytesIO(data)) as plumber:
        tables = extract_tables(plumber.pages[0])
    assert tables
    assert tables[0]["headers"] == ["Name", "Score"]
    assert tables[0]["rows"][0] == ["Ada", "10"]


def test_image_only_pdf_ocr_reads_words() -> None:
    if shutil.which("tesseract") is None:
        pytest.skip("Tesseract is not available on PATH.")
    image = Image.new("RGB", (1400, 400), "white")
    font = ImageFont.truetype(r"C:\Windows\Fonts\arial.ttf", 96)
    ImageDraw.Draw(image).text((50, 120), "HELLO WORLD", fill="black", font=font)
    image_buffer = io.BytesIO()
    image.save(image_buffer, format="PNG")
    document = fitz.open()
    page = document.new_page(width=1000, height=300)
    page.insert_image(page.rect, stream=image_buffer.getvalue())
    text, _ = ocr_page(page)
    document.close()
    assert "HELLO" in text
    assert "WORLD" in text
