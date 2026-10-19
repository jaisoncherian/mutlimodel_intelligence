"""All SQL for chunk indexing and retrieval."""

from __future__ import annotations

from typing import Any, Iterable
from uuid import UUID

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from ..db import get_conn


def delete_chunks(doc_id: UUID) -> None:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            cursor.execute("delete from chunks where doc_id = %s", (doc_id,))


def insert_chunks(doc_id: UUID, user_id: UUID | None,
                  rows: Iterable[dict[str, Any]]) -> int:
    values = list(rows)
    if not values:
        return 0
    with get_conn() as connection:
        with connection.cursor() as cursor:
            for row in values:
                vector = "[" + ",".join(str(float(v)) for v in row["embedding"]) + "]"
                cursor.execute(
                    """
                    insert into chunks
                        (doc_id, user_id, page_number, section, content_type,
                         chunk_index, table_index, token_count, content, embedding)
                    values (%s, %s, %s, %s, %s, %s, %s, %s, %s,
                            %s::extensions.vector)
                    on conflict (doc_id, page_number, content_type, chunk_index)
                    do update set section = excluded.section,
                        table_index = excluded.table_index, token_count = excluded.token_count,
                        content = excluded.content, embedding = excluded.embedding
                    """,
                    (doc_id, user_id, row["page_number"], row["section"],
                     row["content_type"], row["chunk_index"], row.get("table_index"),
                     row["token_count"], row["content"], vector),
                )
    return len(values)


def list_chunks(doc_id: UUID, page: int | None = None, content_type: str | None = None,
                limit: int = 50, offset: int = 0) -> list[dict[str, Any]]:
    conditions = ["doc_id = %s"]
    params: list[Any] = [doc_id]
    if page is not None:
        conditions.append("page_number = %s")
        params.append(page)
    if content_type is not None:
        conditions.append("content_type = %s")
        params.append(content_type)
    params.extend([limit, offset])
    with get_conn() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                f"""
                select id, doc_id, page_number, section, content_type,
                       chunk_index, table_index, token_count, content as text
                from chunks where {' and '.join(conditions)}
                order by page_number, content_type, chunk_index
                limit %s offset %s
                """,
                params,
            )
            return list(cursor.fetchall())


def count_chunks(doc_id: UUID) -> int:
    with get_conn() as connection:
        with connection.cursor() as cursor:
            cursor.execute("select count(*) from chunks where doc_id = %s", (doc_id,))
            return int(cursor.fetchone()[0])


def vector_search(query_vector: list[float], k: int = 30, doc_ids: list[UUID] | None = None,
                  content_types: list[str] | None = None, user_id: UUID | None = None,
                  include_references: bool = False) -> list[dict[str, Any]]:
    vector = "[" + ",".join(str(float(v)) for v in query_vector) + "]"
    conditions = ["c.embedding is not null"]
    if not include_references:
        conditions.append(
            "(c.section IS NULL OR lower(c.section) NOT IN ('references', 'bibliography', 'works cited'))"
        )
    filter_params: list[Any] = []
    if doc_ids:
        conditions.append("c.doc_id = any(%s)")
        filter_params.append(doc_ids)
    if content_types:
        conditions.append("c.content_type = any(%s)")
        filter_params.append(content_types)
    if user_id is not None:
        conditions.append("c.user_id = %s")
        filter_params.append(user_id)
    with get_conn() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                f"""
                select c.id as chunk_id, c.doc_id, d.filename, c.page_number,
                       c.section, c.content_type, c.table_index, c.content as text,
                       1 - (c.embedding <=> %s::extensions.vector) as vector_similarity
                from chunks c join documents d on d.id = c.doc_id
                where {' and '.join(conditions)}
                order by c.embedding <=> %s::extensions.vector
                limit %s
                """,
                [vector, *filter_params, vector, k],
            )
            return list(cursor.fetchall())


def keyword_search(tsquery: str, k: int = 30, doc_ids: list[UUID] | None = None,
                   content_types: list[str] | None = None, user_id: UUID | None = None,
                   include_references: bool = False) -> list[dict[str, Any]]:
    conditions = ["c.fts @@ to_tsquery('english', %s)"]
    if not include_references:
        conditions.append(
            "(c.section IS NULL OR lower(c.section) NOT IN ('references', 'bibliography', 'works cited'))"
        )
    filter_params: list[Any] = []
    if doc_ids:
        conditions.append("c.doc_id = any(%s)")
        filter_params.append(doc_ids)
    if content_types:
        conditions.append("c.content_type = any(%s)")
        filter_params.append(content_types)
    if user_id is not None:
        conditions.append("c.user_id = %s")
        filter_params.append(user_id)
    with get_conn() as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                f"""
                select c.id as chunk_id, c.doc_id, d.filename, c.page_number,
                       c.section, c.content_type, c.table_index, c.content as text,
                       ts_rank_cd(c.fts, to_tsquery('english', %s)) as keyword_score
                from chunks c join documents d on d.id = c.doc_id
                where {' and '.join(conditions)}
                order by keyword_score desc
                limit %s
                """,
                [tsquery, tsquery, *filter_params, k],
            )
            return list(cursor.fetchall())
