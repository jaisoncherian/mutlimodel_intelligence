"""Tests for the Phase 1 HTTP foundation."""

from __future__ import annotations

from app import create_app


def test_unknown_route_returns_json_404() -> None:
    client = create_app({"TESTING": True, "DATABASE_URL": ""}).test_client()
    response = client.get("/does-not-exist")
    assert response.status_code == 404
    assert "error" in response.get_json()


def test_health_reports_unavailable_database() -> None:
    client = create_app(
        {
            "TESTING": True,
            "DATABASE_URL": "postgresql://x:x@127.0.0.1:1/x",
            "DB_POOL_TIMEOUT": 1.0,
        }
    ).test_client()
    response = client.get("/health")
    assert response.status_code == 503
    assert response.get_json() == {
        "status": "degraded",
        "database": "unavailable",
    }


def test_unhandled_exception_does_not_expose_traceback() -> None:
    app = create_app({"TESTING": False, "DATABASE_URL": ""})

    @app.get("/explode")
    def explode() -> None:
        raise RuntimeError("private failure details")

    response = app.test_client().get("/explode")
    assert response.status_code == 500
    assert response.get_json() == {"error": "Internal server error"}
    assert b"Traceback" not in response.data
    assert b"private failure details" not in response.data
