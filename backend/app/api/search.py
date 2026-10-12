"""Search, chunk inspection, and document reindex endpoints."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadRequest, NotFound

from ..models.schemas import ChunkResponse, SearchHit
from ..repositories import chunks, documents
from ..services import indexing, search as search_service

search_bp = Blueprint("search", __name__)


def _uuid_list(value: str | None) -> list[UUID] | None:
    if not value:
        return None
    try:
        return [UUID(item.strip()) for item in value.split(",") if item.strip()]
    except ValueError as error:
        raise BadRequest("doc_ids must contain valid UUIDs.") from error


@search_bp.get("/search")
def search_documents() -> tuple[Any, int]:
    query = request.args.get("q", "").strip()
    if not query:
        raise BadRequest("q is required.")
    if len(query) > 500:
        raise BadRequest("q must be 500 characters or fewer.")
    try:
        k = min(max(int(request.args.get("k", 5)), 1), 20)
    except ValueError as error:
        raise BadRequest("k must be an integer.") from error
    mode = request.args.get("mode", "hybrid")
    if mode not in {"hybrid", "vector", "keyword"}:
        raise BadRequest("mode must be hybrid, vector, or keyword.")
    content_types = request.args.get("types")
    if content_types:
        content_types_list = [item.strip() for item in content_types.split(",") if item.strip()]
        if any(item not in {"text", "table", "ocr", "chart"} for item in content_types_list):
            raise BadRequest("types contains an unsupported content type.")
    else:
        content_types_list = None
    hits = search_service.search(
        query, k, _uuid_list(request.args.get("doc_ids")), content_types_list, mode
    )
    return jsonify([SearchHit.model_validate(hit).model_dump(mode="json") for hit in hits]), 200


@search_bp.get("/documents/<document_id>/chunks")
def list_document_chunks(document_id: str) -> tuple[Any, int]:
    try:
        parsed_id = UUID(document_id)
    except ValueError as error:
        raise NotFound("Document not found.") from error
    if documents.get_document(parsed_id) is None:
        raise NotFound("Document not found.")
    try:
        limit = min(max(int(request.args.get("limit", 50)), 1), 100)
        offset = max(int(request.args.get("offset", 0)), 0)
        page = request.args.get("page")
        page_number = int(page) if page else None
    except ValueError as error:
        raise BadRequest("page, limit, and offset must be integers.") from error
    content_type = request.args.get("type")
    if content_type and content_type not in {"text", "table", "ocr", "chart"}:
        raise BadRequest("type is unsupported.")
    rows = chunks.list_chunks(parsed_id, page_number, content_type, limit, offset)
    return jsonify([ChunkResponse.model_validate(row).model_dump(mode="json") for row in rows]), 200


@search_bp.post("/documents/<document_id>/reindex")
def reindex_document(document_id: str) -> tuple[Any, int]:
    try:
        parsed_id = UUID(document_id)
    except ValueError as error:
        raise NotFound("Document not found.") from error
    if documents.get_document(parsed_id) is None:
        raise NotFound("Document not found.")
    count = indexing.index_document(parsed_id)
    return jsonify({"document_id": str(parsed_id), "chunk_count": count, "status": "ready"}), 200
