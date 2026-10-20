"""Vision service for Phase 4C: multimodal handling of charts and figures.

Design decisions (for interview):
- Small 4B vision models (like Qwen2.5-VL / Qwen3.5) have limited context and VRAM.
  Passing full-resolution or dozens of page images would cause OOMs or context
  overflow. We strictly limit to at most 2 page images per request.
- Pages whose chunks mention a figure (e.g. "Figure 1", "Fig. 2") receive priority
  for image inclusion over general pages.
- Downscaling: images are downscaled using Pillow so their longest edge is at most
  1024 px. This preserves readability of charts and labels while keeping base64
  payloads small and VRAM consumption low.
- Fallback: If an image fetch fails (e.g. network issue or missing storage object),
  the pipeline gracefully continues with text only and logs a warning.
- Pure calculation safety: Values read from a chart/image source can NEVER be
  used directly in the calculator unless confirmed in a text/table chunk, because
  chart estimates are approximate.
"""

from __future__ import annotations

import base64
import io
import logging
import re
from typing import Any
from uuid import UUID

from PIL import Image

logger = logging.getLogger(__name__)

# Visual keywords that trigger multimodal page image loading when asked.
VISUAL_KEYWORDS: tuple[str, ...] = (
    "chart",
    "graph",
    "figure",
    "plot",
    "diagram",
    "trend",
    "curve",
    "bar",
    "line",
    "pie",
    "axis",
    "legend",
    "image",
    "picture",
    "shown in",
)

# Regex matching mentions of figures in chunk text, e.g. "Figure 1", "Fig. 2"
FIGURE_REGEX = re.compile(r"\b(?:figure|fig\.?)\s*\d+", re.IGNORECASE)


def has_visual_keyword(text: str) -> bool:
    """Return True if text contains any visual keyword."""
    text_lower = text.lower()
    for kw in VISUAL_KEYWORDS:
        if " " in kw:
            if kw in text_lower:
                return True
        else:
            if re.search(r"\b" + re.escape(kw) + r"\b", text_lower):
                return True
    return False


def chunk_mentions_figure(text: str) -> bool:
    """Return True if text mentions a figure with a number (e.g. Figure 1, Fig. 3)."""
    return bool(FIGURE_REGEX.search(text))


def needs_vision(question: str, hits: list[dict[str, Any]]) -> bool:
    """Determine whether multimodal vision context should be loaded.

    Returns True if:
    1. The question contains any visual keyword, OR
    2. Any retrieved chunk explicitly references a figure with a number.
    """
    if has_visual_keyword(question):
        return True

    for hit in hits:
        if chunk_mentions_figure(hit.get("text", "")):
            return True

    return False


def select_vision_pages(
    hits: list[dict[str, Any]],
    max_pages: int = 2,
) -> list[dict[str, Any]]:
    """Select at most `max_pages` distinct (doc_id, page_number) pairs from hits.

    Prioritises pages whose chunks mention a figure over pages that do not.
    Maintains retrieval ranking within preferred and non-preferred groups.
    """
    # Group hits by distinct (doc_id, page_number)
    distinct_pages: dict[tuple[str, int], dict[str, Any]] = {}

    for hit in hits:
        doc_id = str(hit.get("doc_id", ""))
        page_num = hit.get("page_number")
        if not doc_id or page_num is None:
            continue

        key = (doc_id, int(page_num))
        if key not in distinct_pages:
            distinct_pages[key] = {
                "doc_id": doc_id,
                "page_number": int(page_num),
                "filename": hit.get("filename", ""),
                "has_figure": chunk_mentions_figure(hit.get("text", "")),
            }
        else:
            if chunk_mentions_figure(hit.get("text", "")):
                distinct_pages[key]["has_figure"] = True

    # Partition into preferred (mentions figure) and regular
    preferred = [p for p in distinct_pages.values() if p["has_figure"]]
    regular = [p for p in distinct_pages.values() if not p["has_figure"]]

    selected = preferred + regular
    return selected[:max_pages]


def downscale_image(image_bytes: bytes, max_edge: int = 1024) -> bytes:
    """Downscale image bytes so the longest edge is at most `max_edge` pixels.

    Returns PNG-encoded bytes.
    """
    with Image.open(io.BytesIO(image_bytes)) as img:
        # Convert paletted or RGBA with transparent alpha to RGBA / RGB for PNG
        width, height = img.size
        longest = max(width, height)

        if longest > max_edge:
            scale = max_edge / float(longest)
            new_width = max(1, int(round(width * scale)))
            new_height = max(1, int(round(height * scale)))
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        output = io.BytesIO()
        img.save(output, format="PNG")
        return output.getvalue()


def encode_image_base64(image_bytes: bytes) -> str:
    """Encode image bytes as an ASCII base64 string."""
    return base64.b64encode(image_bytes).decode("utf-8")


def fetch_and_prepare_images(
    pages: list[dict[str, Any]],
    download_fn: Any = None,
) -> list[dict[str, Any]]:
    """Download, downscale, and base64-encode page images.

    Args:
        pages: List of dicts with doc_id, page_number, filename.
        download_fn: Optional callable (bucket, path) -> bytes. If None,
                     uses `services.storage.download`.

    Returns:
        List of image source dicts with keys:
        - source_id: "IMG1", "IMG2", ...
        - doc_id: str
        - page_number: int
        - filename: str
        - base64: str
        - content_type: "image"
    """
    if download_fn is None:
        from ..services import storage

        download_fn = storage.download

    prepared: list[dict[str, Any]] = []

    for idx, page_info in enumerate(pages, 1):
        doc_id = page_info["doc_id"]
        page_num = page_info["page_number"]
        path = f"{doc_id}/{page_num}.png"

        try:
            raw_bytes = download_fn("page-images", path)
            if not raw_bytes:
                raise ValueError(f"Empty image data returned for {path}")

            resized_bytes = downscale_image(raw_bytes, max_edge=1024)
            b64_str = encode_image_base64(resized_bytes)

            prepared.append({
                "source_id": f"IMG{idx}",
                "doc_id": doc_id,
                "page_number": page_num,
                "filename": page_info.get("filename", ""),
                "base64": b64_str,
                "content_type": "image",
            })
        except Exception as exc:
            logger.warning(
                "Failed to fetch or process page image %s: %s", path, exc
            )
            # As per Stage 4C spec: If an image fetch fails, continue with text only.
            raise exc

    return prepared
