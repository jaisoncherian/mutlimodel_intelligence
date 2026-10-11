"""JSON error handlers."""

from __future__ import annotations

import logging
from typing import Any

from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


def register_error_handlers(app: Flask) -> None:
    """Register JSON responses for expected and unexpected errors."""

    @app.errorhandler(HTTPException)
    def handle_http_exception(error: HTTPException) -> tuple[Any, int]:
        return jsonify(error=error.description), error.code or 500

    @app.errorhandler(Exception)
    def handle_exception(error: Exception) -> tuple[Any, int]:
        logger.exception("Unhandled application exception")
        return jsonify(error="Internal server error"), 500
