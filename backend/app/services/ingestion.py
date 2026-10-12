"""Background document ingestion pipeline."""

from __future__ import annotations

import logging
import io
from concurrent.futures import ThreadPoolExecutor
from typing import Any
from uuid import UUID

import fitz
import pdfplumber
from flask import Flask

from ..repositories import documents
from . import pdf_parser, storage

logger = logging.getLogger(__name__)
executor = ThreadPoolExecutor(max_workers=2)


def submit_document(app: Flask, document_id: UUID) -> None:
    """Submit work while preserving an application context in the worker."""
    executor.submit(_run_in_context, app, document_id)


def _run_in_context(app: Flask, document_id: UUID) -> None:
    with app.app_context():
        process_document(document_id)


def process_document(document_id: UUID) -> None:
    """Extract one document and save all page data in document-level batches."""
    document = documents.get_document(document_id)
    if document is None:
        logger.error("Cannot ingest missing document %s", document_id)
        return
    pdf_path = str(document["storage_path"])
    page_records: list[dict[str, Any]] = []
    table_records: list[dict[str, Any]] = []
    try:
        pdf_bytes = storage.download("pdfs", pdf_path)
        with fitz.open(stream=pdf_bytes, filetype="pdf") as pdf:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as plumber_pdf:
                for index, page in enumerate(pdf, start=1):
                    page_record: dict[str, Any] = {
                        "page_number": index,
                        "text": "",
                        "blocks": [],
                        "is_scanned": False,
                        "image_path": None,
                        "extraction_method": "text",
                        "ocr_confidence": None,
                    }
                    try:
                        text, blocks = pdf_parser.extract_page_text(page)
                        page_record["text"] = text
                        page_record["blocks"] = blocks
                        image_path = f"{document_id}/{index}.png"
                        storage.upload_bytes(
                            "page-images",
                            image_path,
                            pdf_parser.render_page_png(page),
                            "image/png",
                        )
                        page_record["image_path"] = image_path
                        if pdf_parser.needs_ocr(text, page):
                            ocr_text, confidence = pdf_parser.ocr_page(page)
                            page_record["text"] = ocr_text
                            page_record["is_scanned"] = True
                            page_record["ocr_confidence"] = confidence
                            page_record["extraction_method"] = (
                                "mixed" if text.strip() else "ocr"
                            )
                        for table_index, table in enumerate(
                            pdf_parser.extract_tables(plumber_pdf.pages[index - 1])
                        ):
                            table_records.append(
                                {
                                    "page_number": index,
                                    "table_index": table_index,
                                    **table,
                                }
                            )
                    except Exception:
                        logger.exception(
                            "Failed to process page %s for document %s",
                            index,
                            document_id,
                        )
                    page_records.append(page_record)
        documents.clear_pages_and_tables(document_id)
        documents.save_pages_and_tables(document_id, page_records, table_records)
        documents.set_status(document_id, "ready", len(page_records), None)
    except Exception:
        logger.exception("Failed to ingest document %s", document_id)
        try:
            storage.cleanup_document_storage(document_id, include_pdf=False)
        except Exception:
            logger.exception("Failed to clean page images for document %s", document_id)
        documents.set_status(
            document_id,
            "failed",
            error_message="Document processing failed.",
        )
