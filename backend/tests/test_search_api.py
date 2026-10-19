"""Search API tests with the search service mocked."""

from __future__ import annotations

from app import create_app


def test_search_include_references_invalid_value_rejected() -> None:
    app = create_app({"TESTING": True, "DATABASE_URL": ""})
    client = app.test_client()
    response = client.get("/search?q=revenue&include_references=maybe")
    assert response.status_code == 400


def test_search_include_references_passed_to_service(monkeypatch) -> None:
    captured: dict[str, object] = {}

    def fake_search(query, k=5, doc_ids=None, content_types=None, mode="hybrid",
                    user_id=None, include_references=False):
        captured["include_references"] = include_references
        return []

    import app.services.search as search_module
    monkeypatch.setattr(search_module, "search", fake_search)

    app = create_app({"TESTING": True, "DATABASE_URL": ""})
    client = app.test_client()

    client.get("/search?q=revenue")
    assert captured["include_references"] is False

    client.get("/search?q=revenue&include_references=true")
    assert captured["include_references"] is True

    client.get("/search?q=revenue&include_references=false")
    assert captured["include_references"] is False
