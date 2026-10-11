"""Application health endpoint."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, jsonify

from ..db import get_conn

health_bp = Blueprint("health", __name__)


@health_bp.get("/health")
def health() -> tuple[Any, int]:
    """Report application and database availability."""
    try:
        with get_conn() as connection:
            with connection.cursor() as cursor:
                cursor.execute("select 1")
                cursor.fetchone()
    except Exception:
        return jsonify(status="degraded", database="unavailable"), 503
    return jsonify(status="ok", database="ok"), 200
