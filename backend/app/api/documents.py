"""Document upload and document data endpoints."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID, uuid4

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest, NotFound, RequestEntityTooLarge

from ..models.schemas import (
    DocumentDetails,
    DocumentSummary,
    PageResponse,
    UploadResult,
)
from ..repositories import documents
from ..services import ingestion, pdf_parser, storage

logger = logging.getLogger(__name__)
documents_bp = Blueprint("documents", __name__, url_prefix="/documents")


def _document_id(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError as error:
        raise NotFound("Document not found.") from error


def _safe_upload_error(error: Exception) -> str:
    if isinstance(error, pdf_parser.PdfError):
        return str(error)
    return "The file could not be processed."


@documents_bp.post("/upload")
def upload_documents() -> tuple[Any, int]:
    """Validate and enqueue multiple PDF uploads independently."""
    files = request.files.getlist("files")
    if not files:
        raise BadRequest("At least one PDF is required.")
    results: list[UploadResult] = []
    max_size = int(current_app.config["MAX_FILE_SIZE"])
    for file in files:
        filename = file.filename or ""
        try:
            if not filename.lower().endswith(".pdf"):
                raise pdf_parser.PdfError("Only PDF files are accepted.")
            data = file.read()
            if len(data) > max_size:
                raise RequestEntityTooLarge()
            pdf_parser.validate_pdf(data)
            document_id = uuid4()
            path = f"{document_id}.pdf"
            storage.upload_bytes("pdfs", path, data, "application/pdf")
            try:
                documents.insert_document(document_id, filename, path)
            except Exception:
                storage.delete_prefix("pdfs", str(document_id))
                raise
            ingestion.submit_document(current_app._get_current_object(), document_id)
            results.append(
                UploadResult(
                    filename=filename,
                    document_id=document_id,
                    status="processing",
                )
            )
        except RequestEntityTooLarge:
            results.append(UploadResult(filename=filename, error="File is too large."))
        except Exception as error:
            logger.exception("Rejected upload %s", filename)
            results.append(UploadResult(filename=filename, error=_safe_upload_error(error)))
    return jsonify([result.model_dump(mode="json") for result in results]), 202


@documents_bp.get("")
def list_all_documents() -> tuple[Any, int]:
    return jsonify(
        [DocumentSummary.model_validate(row).model_dump(mode="json") for row in documents.list_documents()]
    ), 200


@documents_bp.get("/<document_id>")
def get_document(document_id: str) -> tuple[Any, int]:
    row = documents.get_document(_document_id(document_id))
    if row is None:
        raise NotFound("Document not found.")
    return jsonify(DocumentDetails.model_validate(row).model_dump(mode="json")), 200


@documents_bp.get("/<document_id>/pages/<int:page_number>")
def get_document_page(document_id: str, page_number: int) -> tuple[Any, int]:
    if page_number < 1:
        raise NotFound("Page not found.")
    row = documents.get_page(_document_id(document_id), page_number)
    if row is None:
        raise NotFound("Page not found.")
    return jsonify(PageResponse.model_validate(row).model_dump(mode="json")), 200


@documents_bp.get("/<document_id>/pages/<int:page_number>/image")
def get_page_image(document_id: str, page_number: int) -> tuple[Any, int]:
    document = documents.get_document(_document_id(document_id))
    if document is None:
        raise NotFound("Document not found.")
    if page_number < 1:
        raise NotFound("Page not found.")
    path = f"{document_id}/{page_number}.png"
    return jsonify(
        url=storage.create_signed_url("page-images", path, seconds=300)
    ), 200


@documents_bp.delete("/<document_id>")
def delete_document(document_id: str) -> tuple[Any, int]:
    parsed_id = _document_id(document_id)
    if documents.get_document(parsed_id) is None:
        raise NotFound("Document not found.")
    documents.delete_document(parsed_id)
    storage.delete_prefix("pdfs", str(parsed_id))
    storage.delete_prefix("page-images", str(parsed_id))
    return "", 204


@documents_bp.post("/<document_id>/reprocess")
def reprocess_document(document_id: str) -> tuple[Any, int]:
    parsed_id = _document_id(document_id)
    if documents.get_document(parsed_id) is None:
        raise NotFound("Document not found.")
    documents.clear_pages_and_tables(parsed_id)
    documents.set_status(parsed_id, "processing", error_message=None)
    storage.delete_prefix("page-images", str(parsed_id))
    ingestion.submit_document(current_app._get_current_object(), parsed_id)
    return jsonify(document_id=str(parsed_id), status="processing"), 202
