"""Phase 4A: /ask endpoint and conversation management endpoints.

POST /ask              – answer a question with citations
GET  /conversations    – list all conversations
GET  /conversations/<id>/messages – messages + citations for a conversation
DELETE /conversations/<id>         – delete a conversation
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import BadRequest, NotFound

from ..repositories import conversations as conv_repo
from ..services.answering import answer_question
from ..services.llm import OllamaError

logger = logging.getLogger(__name__)

ask_bp = Blueprint("ask", __name__)


# ---------------------------------------------------------------------------
# Helper – parse a UUID from a URL segment or raise 404
# ---------------------------------------------------------------------------

def _parse_uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except ValueError as exc:
        raise NotFound("Not found.") from exc


# ---------------------------------------------------------------------------
# POST /ask
# ---------------------------------------------------------------------------

@ask_bp.post("/ask")
def ask() -> tuple[Any, int]:
    """Answer a question from retrieved evidence using the local Qwen model.

    Request body (JSON):
        question        str  (required, 1-1000 chars)
        doc_ids         list[str uuid]  (optional, restricts retrieval)
        conversation_id str uuid        (optional, continues an existing conversation)
        k               int             (optional, default 8, max 12)

    Response (200):
        conversation_id, message_id, status, answer, missing,
        citations, calculations, used_vision, timings_ms
    """
    body = request.get_json(silent=True) or {}

    # ---- Validate question ------------------------------------------------
    question = body.get("question", "")
    if not isinstance(question, str) or not question.strip():
        raise BadRequest("question is required and must be a non-empty string.")
    question = question.strip()
    if len(question) > 1000:
        raise BadRequest("question must be 1000 characters or fewer.")

    # ---- Validate k -------------------------------------------------------
    raw_k = body.get("k", 8)
    try:
        k = int(raw_k)
    except (TypeError, ValueError) as exc:
        raise BadRequest("k must be an integer.") from exc
    k = max(1, min(k, 12))

    # ---- Validate doc_ids -------------------------------------------------
    raw_doc_ids = body.get("doc_ids")
    doc_ids: list[UUID] | None = None
    if raw_doc_ids is not None:
        if not isinstance(raw_doc_ids, list):
            raise BadRequest("doc_ids must be a list of UUID strings.")
        try:
            doc_ids = [UUID(str(d)) for d in raw_doc_ids]
        except ValueError as exc:
            raise BadRequest("doc_ids must contain valid UUIDs.") from exc

    # ---- Validate conversation_id -----------------------------------------
    raw_conv_id = body.get("conversation_id")
    conversation_id: UUID | None = None
    if raw_conv_id is not None:
        try:
            conversation_id = UUID(str(raw_conv_id))
        except ValueError as exc:
            raise BadRequest("conversation_id must be a valid UUID.") from exc
        # Verify the conversation exists.
        if conv_repo.get_conversation(conversation_id) is None:
            raise NotFound("Conversation not found.")

    # ---- Eval overrides (options field) -----------------------------------
    # The "options" field is INERT unless ALLOW_EVAL_OVERRIDES=true.
    # When the flag is false (the default), the field is parsed but ignored.
    # Behaviour change introduced in Phase 5A: see project README decision log.
    options: dict = body.get("options") or {}
    eval_overrides: dict = {}
    if options and current_app.config.get("ALLOW_EVAL_OVERRIDES", False):
        if "verify_mode" in options:
            vm = str(options["verify_mode"]).lower()
            if vm not in {"off", "lexical", "llm", "both"}:
                raise BadRequest("options.verify_mode must be off|lexical|llm|both.")
            eval_overrides["VERIFY_MODE"] = vm
        if "k" in options:
            try:
                eval_overrides["k"] = max(1, min(int(options["k"]), 12))
            except (TypeError, ValueError) as exc:
                raise BadRequest("options.k must be an integer.") from exc
        if "vision" in options:
            eval_overrides["VISION_ENABLED"] = bool(options["vision"])
        if "think" in options:
            eval_overrides["OLLAMA_THINK"] = bool(options["think"])
        # Override k at request level too.
        if "k" in eval_overrides:
            k = eval_overrides.pop("k")
    elif options:
        logger.debug(
            "options field present but ALLOW_EVAL_OVERRIDES=false; ignoring overrides"
        )

    # ---- Call the orchestrator -------------------------------------------
    try:
        result = answer_question(
            question=question,
            doc_ids=doc_ids,
            conversation_id=conversation_id,
            k=k,
            eval_overrides=eval_overrides if eval_overrides else None,
        )
    except OllamaError as exc:
        msg = str(exc)
        if "semaphore_timeout" in msg:
            return jsonify(error="The model is busy, please retry."), 503
        logger.warning("Ollama error: %s", msg)
        return jsonify(error="The AI model is currently unavailable. Please try again later."), 503

    return jsonify(result), 200


# ---------------------------------------------------------------------------
# GET /conversations
# ---------------------------------------------------------------------------

@ask_bp.get("/conversations")
def list_conversations() -> tuple[Any, int]:
    """Return all conversations, newest first."""
    rows = conv_repo.list_conversations()
    # Convert non-serialisable types (UUID, datetime) to strings.
    output = [_serialise_row(row) for row in rows]
    return jsonify(output), 200


# ---------------------------------------------------------------------------
# GET /conversations/<id>/messages
# ---------------------------------------------------------------------------

@ask_bp.get("/conversations/<conversation_id>/messages")
def get_conversation_messages(conversation_id: str) -> tuple[Any, int]:
    """Return all messages (with citations) for a conversation."""
    conv_uuid = _parse_uuid(conversation_id)
    if conv_repo.get_conversation(conv_uuid) is None:
        raise NotFound("Conversation not found.")
    messages = conv_repo.list_messages(conv_uuid)
    output = [_serialise_row(msg) for msg in messages]
    return jsonify(output), 200


# ---------------------------------------------------------------------------
# DELETE /conversations/<id>
# ---------------------------------------------------------------------------

@ask_bp.delete("/conversations/<conversation_id>")
def delete_conversation(conversation_id: str) -> tuple[Any, int]:
    """Delete a conversation and all its messages and citations."""
    conv_uuid = _parse_uuid(conversation_id)
    if conv_repo.get_conversation(conv_uuid) is None:
        raise NotFound("Conversation not found.")
    conv_repo.delete_conversation(conv_uuid)
    return jsonify(deleted=True), 200


# ---------------------------------------------------------------------------
# Serialisation helper
# ---------------------------------------------------------------------------

def _serialise_row(row: dict[str, Any]) -> dict[str, Any]:
    """Recursively convert UUID and datetime objects to strings."""
    import datetime

    result: dict[str, Any] = {}
    for key, value in row.items():
        if isinstance(value, UUID):
            result[key] = str(value)
        elif isinstance(value, datetime.datetime):
            result[key] = value.isoformat()
        elif isinstance(value, list):
            result[key] = [
                _serialise_row(item) if isinstance(item, dict) else item
                for item in value
            ]
        elif isinstance(value, dict):
            result[key] = _serialise_row(value)
        else:
            result[key] = value
    return result
