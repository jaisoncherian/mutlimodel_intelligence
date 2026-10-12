"""All SQL used by document ingestion and document endpoints."""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ..db import get_conn


def insert_document(document_id: UUID, filename: str, storage_path: str) -> None:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                insert into documents (id, filename, storage_path, status)
                values (%s, %s, %s, 'processing')
                """,
                (document_id, filename, storage_path),
            )


def get_document(document_id: UUID) -> dict[str, Any] | None:
    with get_conn() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                select id, user_id, filename, storage_path, page_count, status,
                       error_message, uploaded_at, chunk_count, indexed_at
                from documents where id = %s
                """,
                (document_id,),
            )
            return cursor.fetchone()


def list_pages_for_index(document_id: UUID) -> list[dict[str, Any]]:
    with get_conn() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                select page_number, text, blocks, extraction_method
                from pages where doc_id = %s order by page_number
                """,
                (document_id,),
            )
            return list(cursor.fetchall())


def list_tables_for_index(document_id: UUID) -> list[dict[str, Any]]:
    with get_conn() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                select page_number, table_index, headers, rows, markdown
                from page_tables where doc_id = %s
                order by page_number, table_index
                """,
                (document_id,),
            )
            return list(cursor.fetchall())


def list_documents() -> list[dict[str, Any]]:
    with get_conn() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                select id, filename, page_count, status, uploaded_at, chunk_count
                from documents order by uploaded_at desc
                """
            )
            return list(cursor.fetchall())


def delete_document(document_id: UUID) -> None:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            cursor.execute("delete from documents where id = %s", (document_id,))


def clear_pages_and_tables(document_id: UUID) -> None:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            cursor.execute("delete from page_tables where doc_id = %s", (document_id,))
            cursor.execute("delete from pages where doc_id = %s", (document_id,))


def save_pages_and_tables(
    document_id: UUID,
    pages: list[dict[str, Any]],
    tables: list[dict[str, Any]],
) -> None:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            for page in pages:
                cursor.execute(
                    """
                    insert into pages
                        (doc_id, page_number, text, is_scanned, image_path,
                         blocks, extraction_method, ocr_confidence)
                    values (%s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        document_id,
                        page["page_number"],
                        page["text"],
                        page["is_scanned"],
                        page["image_path"],
                        Jsonb(page["blocks"]),
                        page["extraction_method"],
                        page["ocr_confidence"],
                    ),
                )
            for table in tables:
                cursor.execute(
                    """
                    insert into page_tables
                        (doc_id, page_number, table_index, headers, rows, markdown)
                    values (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        document_id,
                        table["page_number"],
                        table["table_index"],
                        Jsonb(table["headers"]),
                        Jsonb(table["rows"]),
                        table["markdown"],
                    ),
                )


def set_status(
    document_id: UUID,
    status: str,
    page_count: int | None = None,
    error_message: str | None = None,
) -> None:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update documents
                set status = %s, page_count = coalesce(%s, page_count),
                    error_message = %s
                where id = %s
                """,
                (status, page_count, error_message, document_id),
            )


def set_indexed(document_id: UUID, chunk_count: int) -> None:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update documents
                set chunk_count = %s, indexed_at = now()
                where id = %s
                """,
                (chunk_count, document_id),
            )


def mark_processing_as_failed() -> None:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                update documents
                set status = 'failed', error_message = 'interrupted by restart'
                where status = 'processing'
                """
            )


def get_page(document_id: UUID, page_number: int) -> dict[str, Any] | None:
    with get_conn() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                select id, page_number, text, extraction_method, is_scanned,
                       ocr_confidence
                from pages
                where doc_id = %s and page_number = %s
                """,
                (document_id, page_number),
            )
            page = cursor.fetchone()
            if page is None:
                return None
            cursor.execute(
                """
                select table_index, headers, rows, markdown
                from page_tables
                where doc_id = %s and page_number = %s
                order by table_index
                """,
                (document_id, page_number),
            )
            page["tables"] = list(cursor.fetchall())
            return page
