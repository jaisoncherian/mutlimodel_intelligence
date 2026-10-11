"""Small Supabase Storage wrapper."""

from __future__ import annotations

from typing import Any

from supabase import create_client

_client: Any | None = None


def _get_client() -> Any:
    global _client
    if _client is None:
        from flask import current_app

        url = current_app.config["SUPABASE_URL"]
        key = current_app.config["SUPABASE_SECRET_KEY"]
        if not url or not key:
            raise RuntimeError("Supabase Storage is not configured")
        _client = create_client(url, key)
    return _client


def reset_client() -> None:
    """Clear the cached client, primarily for tests and configuration changes."""
    global _client
    _client = None


def upload_bytes(bucket: str, path: str, data: bytes, content_type: str) -> Any:
    """Upload bytes to a private Supabase Storage bucket."""
    return _get_client().storage.from_(bucket).upload(
        path,
        data,
        {"content-type": content_type, "upsert": "true"},
    )


def download(bucket: str, path: str) -> bytes:
    """Download an object from Supabase Storage."""
    return _get_client().storage.from_(bucket).download(path)


def delete_prefix(bucket: str, prefix: str) -> None:
    """Delete all objects under a storage prefix."""
    bucket_api = _get_client().storage.from_(bucket)
    objects = bucket_api.list(prefix)
    paths = [
        str(item["name"])
        for item in objects
        if item.get("name")
    ]
    if paths:
        bucket_api.remove(paths)


def create_signed_url(bucket: str, path: str, seconds: int = 300) -> str:
    """Create a short-lived signed URL for a private object."""
    result = _get_client().storage.from_(bucket).create_signed_url(path, seconds)
    return str(result["signedURL"] if "signedURL" in result else result["signed_url"])
