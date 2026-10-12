from __future__ import annotations

from uuid import uuid4

from app.services import embeddings, indexing


def test_index_document_inserts_chunks_and_updates_count(monkeypatch) -> None:
    document_id = uuid4()
    inserted_rows: list[dict[str, object]] = []
    indexed_counts: list[int] = []

    monkeypatch.setattr(
        indexing.documents,
        "list_pages_for_index",
        lambda value: [
            {
                "page_number": 1,
                "text": "Northwind manufactures sensors and assemblies.",
                "blocks": [],
                "extraction_method": "text",
            }
        ],
    )
    monkeypatch.setattr(indexing.documents, "list_tables_for_index", lambda value: [])
    monkeypatch.setattr(
        indexing.documents,
        "get_document",
        lambda value: {"user_id": None},
    )
    monkeypatch.setattr(indexing.chunks, "delete_chunks", lambda value: None)
    monkeypatch.setattr(
        indexing.chunks,
        "insert_chunks",
        lambda doc_id, user_id, rows: inserted_rows.extend(rows) or len(rows),
    )
    monkeypatch.setattr(
        indexing.documents,
        "set_indexed",
        lambda doc_id, count: indexed_counts.append(count),
    )
    monkeypatch.setattr(embeddings, "token_count", lambda text: len(text.split()))
    monkeypatch.setattr(
        embeddings,
        "embed_texts",
        lambda texts: [[0.1] * 384 for _ in texts],
    )

    count = indexing.index_document(document_id)

    assert count == 1
    assert len(inserted_rows) == 1
    assert inserted_rows[0]["content_type"] == "text"
    assert indexed_counts == [1]
