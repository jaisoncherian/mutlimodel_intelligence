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
