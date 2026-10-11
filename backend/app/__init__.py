"""Flask application factory for DocuLens AI."""

from __future__ import annotations

import logging
from typing import Any

from flask import Flask
from flask_cors import CORS
import pytesseract

from .config import Config
from .db import close_pool, init_pool
from .errors import register_error_handlers
from .repositories import documents


def create_app(overrides: dict[str, Any] | None = None) -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    if app.config.get("TESSERACT_CMD"):
        pytesseract.pytesseract.tesseract_cmd = app.config["TESSERACT_CMD"]
    app.config["MAX_CONTENT_LENGTH"] = app.config.get(
        "MAX_REQUEST_CONTENT_LENGTH",
        app.config["MAX_CONTENT_LENGTH"],
    )

    logging.basicConfig(
        level=getattr(logging, str(app.config["LOG_LEVEL"]).upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    init_pool(app.config)
    CORS(app, resources={r"/*": {"origins": ["http://localhost:5173"]}})

    from .api.health import health_bp
    from .api.documents import documents_bp
    from .services.ingestion import executor

    app.register_blueprint(health_bp)
    app.register_blueprint(documents_bp)
    register_error_handlers(app)
    app.extensions["close_db_pool"] = close_pool
    app.extensions["ingestion_executor"] = executor
    if app.config.get("DATABASE_URL"):
        try:
            documents.mark_processing_as_failed()
        except Exception:
            logging.getLogger(__name__).exception(
                "Could not mark interrupted documents as failed"
            )
    return app
