"""Thin wrapper around Ollama's /api/chat HTTP endpoint.

Design decisions (for interview):
- We call Ollama with plain `requests` instead of an SDK so there is no extra
  dependency and the HTTP contract is explicit in the code.
- A single process-wide threading.Semaphore(1) ensures only one model request
  runs at a time (6 GB VRAM limit).  A waiting thread gets at most 30 s before
  we return 503 so the caller can retry.
- Timeouts: 5 s connect, 180 s read.  Ollama streams by default; we request
  stream=False so we get one JSON object back.
- Structured outputs: when `schema` is provided we pass it as Ollama's `format`
  field (JSON Schema dict).  Ollama will constrain the grammar of the response.
- The "think" field is sent by default only when OLLAMA_THINK=true.  If Ollama
  rejects it (older builds), we retry once without it and log a warning.
- The client is injected into services so unit tests can swap in a fake without
  touching Flask config.
"""

from __future__ import annotations

import json
import logging
import threading
import time
from typing import Any

import requests

logger = logging.getLogger(__name__)

# One model request at a time (VRAM constraint).
_semaphore = threading.Semaphore(1)
# How long a caller will wait for the semaphore before giving up.
_SEMAPHORE_TIMEOUT_S = 30


class OllamaError(Exception):
    """Raised when Ollama is unreachable or returns an unexpected response."""


class OllamaClient:
    """HTTP client for Ollama's /api/chat endpoint.

    Args:
        base_url: Root URL of the Ollama server (no trailing slash).
        model:    Exact model tag, e.g. "qwen2.5vl:4b".
        think:    Whether to enable chain-of-thought reasoning (costs tokens).
    """

    def __init__(self, base_url: str, model: str, think: bool = False) -> None:
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.think = think

    def chat(
        self,
        messages: list[dict[str, Any]],
        schema: dict[str, Any] | None = None,
        images: list[str] | None = None,
        num_predict: int = 700,
    ) -> tuple[str, dict[str, int]]:
        """Send a chat request and return (text_content, usage_counts).

        Args:
            messages:    List of {"role": ..., "content": ...} dicts.
            schema:      Optional JSON Schema for structured output.
            images:      Optional list of base64-encoded PNG strings (for the
                         last user message).
            num_predict: Maximum tokens to generate.

        Returns:
            A tuple of (response_text, usage) where usage has keys
            "prompt_eval_count" and "eval_count" (both ints, may be 0 if
            Ollama did not report them).

        Raises:
            OllamaError: Ollama is unreachable, timed out, or returned an
                         HTTP error status.
        """
        # ---- acquire VRAM semaphore ----------------------------------------
        acquired = _semaphore.acquire(timeout=_SEMAPHORE_TIMEOUT_S)
        if not acquired:
            raise OllamaError("semaphore_timeout")

        try:
            return self._do_chat(messages, schema, images, num_predict)
        finally:
            _semaphore.release()

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _do_chat(
        self,
        messages: list[dict[str, Any]],
        schema: dict[str, Any] | None,
        images: list[str] | None,
        num_predict: int,
    ) -> tuple[str, dict[str, int]]:
        """Build the request payload and call Ollama (with one think-retry)."""
        payload = self._build_payload(messages, schema, images, num_predict, include_think=self.think)
        try:
            return self._post(payload)
        except OllamaError as exc:
            # If the error is specifically about the "think" field being
            # unrecognised (older Ollama builds), retry without it.
            if self.think and "think" in str(exc).lower():
                logger.warning(
                    "Ollama rejected the 'think' field; retrying without it. "
                    "Consider upgrading Ollama or setting OLLAMA_THINK=false."
                )
                payload = self._build_payload(
                    messages, schema, images, num_predict, include_think=False
                )
                return self._post(payload)
            raise

    def _build_payload(
        self,
        messages: list[dict[str, Any]],
        schema: dict[str, Any] | None,
        images: list[str] | None,
        num_predict: int,
        include_think: bool,
    ) -> dict[str, Any]:
        """Construct the /api/chat JSON body."""
        # If there are images, attach them to the last user message.
        final_messages = list(messages)
        if images:
            # Find the last user turn and inject images into it.
            for idx in range(len(final_messages) - 1, -1, -1):
                if final_messages[idx].get("role") == "user":
                    final_messages[idx] = {
                        **final_messages[idx],
                        "images": images,
                    }
                    break

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": final_messages,
            "stream": False,
            "keep_alive": "10m",
            "options": {
                "temperature": 0,
                "num_ctx": 8192,
                "num_predict": num_predict,
            },
        }
        if schema is not None:
            payload["format"] = schema
        # Send 'think': self.think directly. When False, Qwen3.5 outputs direct
        # response tokens rather than spending the num_predict quota on internal
        # chain-of-thought tokens.
        if include_think is not None:
            payload["think"] = include_think

        return payload

    def _post(self, payload: dict[str, Any]) -> tuple[str, dict[str, int]]:
        """POST to /api/chat and return (text, usage).  Raises OllamaError on failure."""
        url = f"{self.base_url}/api/chat"
        try:
            t0 = time.perf_counter()
            response = requests.post(
                url,
                json=payload,
                timeout=(5, 180),  # (connect_timeout, read_timeout)
            )
            elapsed_ms = int((time.perf_counter() - t0) * 1000)
        except requests.exceptions.ConnectionError as exc:
            raise OllamaError(f"Ollama unreachable at {self.base_url}") from exc
        except requests.exceptions.Timeout as exc:
            raise OllamaError("Ollama request timed out") from exc
        except Exception as exc:
            raise OllamaError(f"Unexpected error contacting Ollama: {exc}") from exc

        if not response.ok:
            body = response.text[:300]  # Truncate to avoid logging secrets.
            raise OllamaError(
                f"Ollama returned HTTP {response.status_code}: {body}"
            )

        try:
            data = response.json()
        except json.JSONDecodeError as exc:
            raise OllamaError("Ollama returned non-JSON response") from exc

        # Extract the text from the assistant message.
        text: str = data.get("message", {}).get("content", "")

        # Collect token usage counters (Ollama returns these at top level).
        usage: dict[str, int] = {
            "prompt_eval_count": int(data.get("prompt_eval_count", 0)),
            "eval_count": int(data.get("eval_count", 0)),
        }

        logger.debug(
            "Ollama model=%s elapsed_ms=%d prompt_tokens=%d gen_tokens=%d",
            payload["model"],
            elapsed_ms,
            usage["prompt_eval_count"],
            usage["eval_count"],
        )

        return text, usage


def make_client_from_config(config: dict[str, Any], is_vision: bool = False) -> OllamaClient:
    """Instantiate an OllamaClient from Flask app.config.

    If is_vision=True and OLLAMA_VISION_MODEL is set in config, it uses that;
    otherwise falls back to OLLAMA_MODEL (default: qwen3.5:4b).
    """
    model = (
        config.get("OLLAMA_VISION_MODEL")
        if is_vision and config.get("OLLAMA_VISION_MODEL")
        else config.get("OLLAMA_MODEL", "qwen3.5:4b")
    )
    return OllamaClient(
        base_url=config.get("OLLAMA_BASE_URL", "http://localhost:11434"),
        model=model,
        think=bool(config.get("OLLAMA_THINK", False)),
    )
