"""Small Supabase Storage wrapper."""

from __future__ import annotations

import logging
from typing import Any

from supabase import create_client

logger = logging.getLogger(__name__)
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


def delete_prefix(bucket: str, prefix: str) -> str:
    """Delete all objects under a storage prefix and report partial cleanup."""
    try:
        bucket_api = _get_client().storage.from_(bucket)
    except Exception:
        logger.exception("Storage cleanup failed for bucket=%s prefix=%s", bucket, prefix)
        return "partial"
    page_size = 100
    offset = 0
    paths: list[str] = []

    while True:
        try:
            page = bucket_api.list(prefix, {"limit": page_size, "offset": offset})
        except TypeError:
            try:
                page = bucket_api.list(prefix)
            except Exception:
                logger.exception(
                    "Storage listing failed for bucket=%s prefix=%s",
                    bucket,
                    prefix,
                )
                return "partial"
            items = page or []
            for item in items:
                name = item.get("name") if isinstance(item, dict) else None
                if not name:
                    continue
                normalized_name = str(name)
                prefix_path = prefix.rstrip("/")
                if prefix_path and not normalized_name.startswith(f"{prefix_path}/"):
                    normalized_name = f"{prefix_path}/{normalized_name}"
                paths.append(normalized_name)
            break
        except Exception:
            logger.exception(
                "Storage listing failed for bucket=%s prefix=%s",
                bucket,
                prefix,
            )
            return "partial"

        objects = page or []
        if not objects:
            break

        for item in objects:
            name = item.get("name") if isinstance(item, dict) else None
            if not name:
                continue
            normalized_name = str(name)
            prefix_path = prefix.rstrip("/")
            if prefix_path and not normalized_name.startswith(f"{prefix_path}/"):
                normalized_name = f"{prefix_path}/{normalized_name}"
            paths.append(normalized_name)

        if len(objects) < page_size:
            break
        offset += len(objects)

    requested = len(paths)
    if requested == 0:
        return "ok"

    removed_total = 0
    for index in range(0, requested, 100):
        batch = paths[index : index + 100]
        try:
            result = bucket_api.remove(batch)
        except Exception:
            logger.exception("Storage cleanup failed for bucket=%s prefix=%s", bucket, prefix)
            return "partial"

        removed = len(result or [])
        removed_total += removed
        if removed < len(batch):
            logger.warning(
                "Storage cleanup partial for bucket=%s prefix=%s: requested=%s removed=%s",
                bucket,
                prefix,
                len(batch),
                removed,
            )

    if removed_total < requested:
        logger.warning(
            "Storage cleanup partial for bucket=%s prefix=%s: requested=%s removed=%s",
            bucket,
            prefix,
            requested,
            removed_total,
        )
        return "partial"
    return "ok"


def cleanup_document_storage(document_id: str | Any, include_pdf: bool = True) -> str:
    """Delete the document's PDF and page-image files while leaving DB rows intact."""
    document_key = str(document_id)
    status = "ok"

    if include_pdf:
        pdf_path = f"{document_key}.pdf"
        try:
            result = _get_client().storage.from_("pdfs").remove([pdf_path])
            removed = len(result or [])
            if removed < 1:
                logger.warning(
                    "Storage cleanup partial for bucket=%s path=%s: requested=%s removed=%s",
                    "pdfs",
                    pdf_path,
                    1,
                    removed,
                )
                status = "partial"
        except Exception:
            logger.exception(
                "Storage cleanup failed for document %s in bucket=%s path=%s",
                document_key,
                "pdfs",
                pdf_path,
            )
            status = "partial"

    try:
        image_status = delete_prefix("page-images", f"{document_key}/")
    except Exception:
        logger.exception("Storage cleanup failed for document %s in page-images", document_key)
        image_status = "partial"
    if image_status != "ok":
        status = "partial"
    return status


def create_signed_url(bucket: str, path: str, seconds: int = 300) -> str:
    """Create a short-lived signed URL for a private object."""
    result = _get_client().storage.from_(bucket).create_signed_url(path, seconds)
    return str(result["signedURL"] if "signedURL" in result else result["signed_url"])
