"""Flask application factory for DocuLens AI."""

from __future__ import annotations

import logging
from typing import Any

from flask import Flask

from .config import Config
from .db import close_pool, init_pool
from .errors import register_error_handlers


def create_app(overrides: dict[str, Any] | None = None) -> Flask:
    """Create and configure the Flask application."""
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)

    logging.basicConfig(
        level=getattr(logging, str(app.config["LOG_LEVEL"]).upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    init_pool(app.config)

    from .api.health import health_bp

    app.register_blueprint(health_bp)
    register_error_handlers(app)
    app.teardown_appcontext(lambda _exception: None)
    app.extensions["close_db_pool"] = close_pool
    return app
