"""Pydantic response models for document endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class UploadResult(BaseModel):
    filename: str
    document_id: UUID | None = None
    status: str | None = None
    error: str | None = None


class DocumentSummary(BaseModel):
    id: UUID
    filename: str
    status: str
    page_count: int | None = None
    uploaded_at: datetime | None = None
    chunk_count: int | None = None


class DocumentDetails(DocumentSummary):
    error_message: str | None = None


class TableResponse(BaseModel):
    table_index: int
    headers: Any
    rows: Any
    markdown: str | None = None


class PageResponse(BaseModel):
    page_number: int
    text: str | None
    extraction_method: str | None
    is_scanned: bool
    ocr_confidence: float | None
    tables: list[TableResponse]


class ChunkResponse(BaseModel):
    id: int
    doc_id: UUID
    page_number: int
    section: str | None = None
    content_type: str
    chunk_index: int
    table_index: int | None = None
    token_count: int | None = None
    text: str


class SearchScores(BaseModel):
    rrf: float | None = None
    vector_similarity: float | None = None
    vector_rank: int | None = None
    keyword_rank: int | None = None


class SearchHit(BaseModel):
    chunk_id: int
    doc_id: UUID
    filename: str
    page_number: int
    section: str | None = None
    content_type: str
    table_index: int | None = None
    text: str
    scores: SearchScores
