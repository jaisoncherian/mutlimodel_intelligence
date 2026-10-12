"""Create sample PDFs for the live smoke test.

This script prepares realistic fixture files for the running Flask app and
Supabase Storage. It is intentionally not part of pytest because it targets the
live integration environment rather than mocked unit tests.
"""

from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import fitz
from PIL import Image, ImageFilter


DEFAULT_DIR = Path(__file__).resolve().parents[1] / "data" / "sample_pdfs"


def _as_path(value: str | None, *, default: Path) -> Path:
    if value is None:
        return default
    return Path(value).expanduser().resolve()


def _write_fake_pdf(path: Path) -> None:
    path.write_bytes(b"this is not a pdf")


def _build_two_column_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((60, 120), "Left column text: the left side explains the core idea.", fontsize=18)
    page.insert_text((60, 180), "This paragraph is intentionally placed on the left to check ordering.", fontsize=15)
    page.insert_text((340, 120), "Right column text: the right side contains the trailing fact.", fontsize=18)
    page.insert_text((340, 180), "This paragraph is intentionally placed on the right to verify column order.", fontsize=15)
    doc.save(path)
    doc.close()


def _build_table_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    x0, y0 = 80, 120
    cell_w = 140
    cell_h = 60
    values = [
        ["value1", "value2", "value3"],
        ["row2-col1", "row2-col2", "row2-col3"],
        ["row3-col1", "row3-col2", "row3-col3"],
    ]

    for row_index in range(4):
        for col_index in range(4):
            left = x0 + col_index * cell_w
            top = y0 + row_index * cell_h
            right = left + cell_w
            bottom = top + cell_h
            page.draw_rect(fitz.Rect(left, top, right, bottom), color=(0, 0, 0), fill=None, overlay=False)

    for row_index, row in enumerate(values):
        for col_index, value in enumerate(row):
            left = x0 + col_index * cell_w + 10
            top = y0 + row_index * cell_h + 20
            page.insert_text((left, top), value, fontsize=12)

    doc.save(path)
    doc.close()


def _build_scan_pdf(source: Path, path: Path) -> None:
    if not source.exists():
        raise FileNotFoundError(f"Source PDF not found: {source}")

    with fitz.open(source) as source_doc:
        if source_doc.page_count < 1:
            raise ValueError(f"Source PDF has no pages: {source}")
        page = source_doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(150 / 72, 150 / 72), alpha=False)
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        image = image.rotate(2, expand=True, resample=Image.Resampling.BICUBIC)
        image = image.filter(ImageFilter.GaussianBlur(radius=0.7))

        buffer = io.BytesIO()
        image.save(buffer, format="PDF", resolution=150)
        buffer.seek(0)
        path.write_bytes(buffer.getvalue())


def _maybe_create(path: Path, builder, *, force: bool) -> bool:
    if path.exists() and not force:
        return False
    builder(path)
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate live PDF fixture files.")
    parser.add_argument("--dir", type=str, default=str(DEFAULT_DIR), help="Directory to write fixture files into.")
    parser.add_argument("--source", type=str, default=None, help="Source PDF used to generate scan.pdf.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files.")
    args = parser.parse_args()

    target_dir = _as_path(args.dir, default=DEFAULT_DIR)
    target_dir.mkdir(parents=True, exist_ok=True)

    created: list[str] = []

    for filename, builder in (
        ("text_table.pdf", _build_table_pdf),
        ("two_column.pdf", _build_two_column_pdf),
    ):
        path = target_dir / filename
        if _maybe_create(path, builder, force=args.force):
            created.append(filename)

    scan_path = target_dir / "scan.pdf"
    if args.source:
        if _maybe_create(scan_path, lambda destination: _build_scan_pdf(Path(args.source), destination), force=args.force):
            created.append("scan.pdf")
    elif not scan_path.exists():
        print("Skip: scan.pdf requires --source to create a rendered image-only PDF.")

    fake_path = target_dir / "fake.pdf"
    if _maybe_create(fake_path, _write_fake_pdf, force=args.force):
        created.append("fake.pdf")

    if created:
        print(f"Created: {', '.join(created)}")
    else:
        print("No files created; existing fixtures remain in place. Use --force to overwrite.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
