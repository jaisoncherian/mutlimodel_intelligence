"""Postgres connection pool helpers."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

from psycopg import Connection
from psycopg_pool import ConnectionPool

_pool: ConnectionPool | None = None


def init_pool(config: dict[str, Any]) -> None:
    """Configure the process-wide pool without opening a database connection."""
    global _pool
    if _pool is not None:
        _pool.close()
    database_url = str(config.get("DATABASE_URL", ""))
    pool_timeout = float(config.get("DB_POOL_TIMEOUT", 30.0))
    _pool = ConnectionPool(
        conninfo=database_url,
        min_size=0,
        max_size=5,
        timeout=pool_timeout,
        open=False,
    )


def close_pool() -> None:
    """Close the configured connection pool."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_conn() -> Iterator[Connection[Any]]:
    """Yield a pooled connection and commit or roll back the transaction."""
    if _pool is None:
        raise RuntimeError("Database pool has not been initialized")
    _pool.open()
    with _pool.connection() as connection:
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
