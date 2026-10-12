"""API tests with storage, repository, and background work mocked."""

from __future__ import annotations

import io
from datetime import datetime, timezone
from uuid import UUID, uuid4

import fitz
import pytest

from app import create_app
from app.repositories import documents
from app.services import ingestion, storage


def _pdf() -> bytes:
    document = fitz.open()
    document.new_page().insert_text((72, 72), "A valid document page.")
    data = document.tobytes()
    document.close()
    return data


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch):
    app = create_app({"TESTING": True, "DATABASE_URL": ""})
    monkeypatch.setattr(storage, "upload_bytes", lambda *args: None)
    monkeypatch.setattr(storage, "delete_prefix", lambda *args: None)
    monkeypatch.setattr(storage, "cleanup_document_storage", lambda *args, **kwargs: "ok")
    monkeypatch.setattr(ingestion, "submit_document", lambda *args: None)
    return app


def test_multifile_upload_returns_mixed_results(app, monkeypatch) -> None:
    inserted: list[UUID] = []
    monkeypatch.setattr(
        documents,
        "insert_document",
        lambda document_id, filename, path: inserted.append(document_id),
    )
    response = app.test_client().post(
        "/documents/upload",
        data={
            "files": [
                (io.BytesIO(_pdf()), "good.pdf"),
                (io.BytesIO(b"random"), "bad.pdf"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 202
    result = response.get_json()
    assert result[0]["status"] == "processing"
    assert result[1]["error"]
    assert len(inserted) == 1


def test_document_crud_and_reprocess(app, monkeypatch) -> None:
    document_id = uuid4()
    row = {
        "id": document_id,
        "filename": "a.pdf",
        "storage_path": f"{document_id}.pdf",
        "page_count": 1,
        "status": "ready",
        "error_message": None,
        "uploaded_at": datetime.now(timezone.utc),
    }
    monkeypatch.setattr(documents, "get_document", lambda value: row if value == document_id else None)
    monkeypatch.setattr(documents, "list_documents", lambda: [row])
    monkeypatch.setattr(documents, "clear_pages_and_tables", lambda value: None)
    monkeypatch.setattr(documents, "set_status", lambda *args, **kwargs: None)
    monkeypatch.setattr(documents, "delete_document", lambda value: None)
    client = app.test_client()
    assert client.get("/documents").status_code == 200
    assert client.get(f"/documents/{document_id}").status_code == 200
    assert client.post(f"/documents/{document_id}/reprocess").status_code == 202
    delete_response = client.delete(f"/documents/{document_id}")
    assert delete_response.status_code == 200
    assert delete_response.get_json() == {"deleted": True, "storage_cleanup": "ok"}
    assert client.get("/documents/00000000-0000-0000-0000-000000000000").status_code == 404


def test_delete_reports_partial_storage_cleanup(app, monkeypatch) -> None:
    document_id = uuid4()
    row = {
        "id": document_id,
        "filename": "a.pdf",
        "storage_path": f"{document_id}.pdf",
        "page_count": 1,
        "status": "ready",
        "error_message": None,
        "uploaded_at": datetime.now(timezone.utc),
    }
    monkeypatch.setattr(documents, "get_document", lambda value: row if value == document_id else None)
    monkeypatch.setattr(documents, "delete_document", lambda value: None)
    monkeypatch.setattr(storage, "cleanup_document_storage", lambda *args, **kwargs: "partial")

    response = app.test_client().delete(f"/documents/{document_id}")

    assert response.status_code == 200
    assert response.get_json() == {"deleted": True, "storage_cleanup": "partial"}
