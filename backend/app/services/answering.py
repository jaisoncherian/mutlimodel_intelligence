"""Orchestrator for Phase 4A/4B/4C: grounded answers with citations, calculations, and vision.

Flow (Phase 4C, multimodal two-pass):
  1. Retrieve with hybrid search (services/search.py).
  2. Deduplicate chunks whose normalised text is identical.
  3. Guard: no hits, or best vector_similarity < MIN_SIMILARITY → insufficient_evidence.
  4. Label text sources (S1, S2, …).
  5. Check vision routing (services/vision.py). If visual keywords or figures are
     detected and VISION_ENABLED is True, load at most 2 page images from storage,
     downscale to <=1024 px, and attach as IMG1, IMG2 with base64 PNGs. If fetch
     fails, log a warning and fall back to text only.
  6. Pass 1 – call the model with ANSWER_WITH_CALC_SCHEMA (and images if used).
     Model returns status/answer/claims/missing + an optional calculations[] plan.
  7. Validate citations from Pass 1 (drop unknown IDs, downgrade status if needed).
  8. Run the calculator on any planned calculations (services/calculator.py).
     Operands citing chart-only sources (IMG...) or missing from text/table sources
     are rejected.
  9. Pass 2 (only if verified calculations exist) – compose the final answer
     with {c1}/{c2} placeholders; Python substitutes the formatted values.
  10. Detect unverified numbers in the final answer text; log a warning and add
      "unverified_numbers" to the response (full verification is Phase 5).
  11. Persist conversation, user message, assistant message, and citation rows
      (citations for IMG sources have content_type="image", page number, and no URL).
  12. Return a structured dict ready to jsonify.
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any
from uuid import UUID

from flask import current_app

from ..repositories import conversations as conv_repo
from ..services import calculator as calc_service
from ..services import search as search_service
from ..services import vision as vision_service
from ..services.llm import OllamaClient, OllamaError, make_client_from_config
from ..services.prompts import (
    ANSWER_SCHEMA,
    ANSWER_WITH_CALC_SCHEMA,
    COMPOSE_SCHEMA,
    build_answer_messages,
    build_compose_messages,
    build_source_block,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Text normalisation for duplicate detection
# ---------------------------------------------------------------------------

def _normalise(text: str) -> str:
    """Collapse whitespace and lower-case text for equality comparison."""
    return re.sub(r"\s+", " ", text.strip().lower())


def _normalize_missing(missing: Any) -> str | None:
    """Normalize the 'missing' field. Returns None if empty or literal 'None',
    or stripped text if genuine missing information is described."""
    if missing is None:
        return None
    s = str(missing).strip()
    if (
        not s
        or s.lower() in ("none", "none.", "n/a", "nil", "nothing", "null")
        or "no missing" in s.lower()
    ):
        return None
    # Strip placeholder artifacts like "{c1}, {c2}"
    if re.match(r"^(\s*\{[a-zA-Z0-9_]+\}\s*,?)+$", s):
        return None
    return s


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def answer_question(
    question: str,
    doc_ids: list[UUID] | None,
    conversation_id: UUID | None,
    k: int,
    ollama_client: OllamaClient | None = None,
    storage_download_fn: Any = None,
) -> dict[str, Any]:
    """Retrieve evidence, call the model (1–2 passes), validate, compute, persist, and return.

    Args:
        question:            The user's question text.
        doc_ids:             Optional list of document UUIDs to restrict retrieval.
        conversation_id:     Existing conversation UUID, or None to create a new one.
        k:                   Number of chunks to retrieve (capped at 12).
        ollama_client:       Injected for testing; defaults to one built from config.
        storage_download_fn: Optional callable for storage image downloads.

    Returns:
        A dict matching the /ask response schema.
    """
    config = current_app.config
    if ollama_client is None:
        ollama_client = make_client_from_config(config)

    min_similarity: float = float(config.get("MIN_SIMILARITY", 0.15))
    vision_enabled: bool = bool(config.get("VISION_ENABLED", True))
    timings: dict[str, int] = {}

    # ------------------------------------------------------------------
    # Step 1 – Retrieve chunks
    # ------------------------------------------------------------------
    t0 = time.perf_counter()
    hits = search_service.search(
        query=question,
        k=k,
        doc_ids=doc_ids,
        mode="hybrid",
        include_references=False,
    )
    timings["retrieval_ms"] = int((time.perf_counter() - t0) * 1000)

    # ------------------------------------------------------------------
    # Step 2 – Deduplicate chunks with identical normalised text
    # ------------------------------------------------------------------
    hits = _deduplicate(hits)

    # ------------------------------------------------------------------
    # Step 3 – Similarity guard
    # ------------------------------------------------------------------
    if not hits:
        return _no_evidence_response(conversation_id, question, timings)

    # Only block when the best hit HAS a similarity score AND it is below
    # threshold. Keyword-only hits (similarity=None) are NOT blocked.
    best_similarity = hits[0]["scores"].get("vector_similarity")
    if best_similarity is not None and best_similarity < min_similarity:
        logger.info(
            "Similarity guard fired: best_similarity=%.4f < MIN_SIMILARITY=%.4f",
            best_similarity,
            min_similarity,
        )
        return _no_evidence_response(conversation_id, question, timings)

    # ------------------------------------------------------------------
    # Step 4 – Label text sources and build source block
    # ------------------------------------------------------------------
    for idx, hit in enumerate(hits, 1):
        hit["source_id"] = f"S{idx}"

    valid_source_ids = {hit["source_id"] for hit in hits}
    source_block = build_source_block(hits)

    # ------------------------------------------------------------------
    # Step 4b – Multi-modal vision context (Phase 4C)
    # ------------------------------------------------------------------
    image_sources: list[dict[str, Any]] = []
    images_b64: list[str] = []
    used_vision = False

    if vision_enabled and vision_service.needs_vision(question, hits):
        try:
            pages_to_fetch = vision_service.select_vision_pages(hits, max_pages=2)
            if pages_to_fetch:
                image_sources = vision_service.fetch_and_prepare_images(
                    pages_to_fetch, download_fn=storage_download_fn
                )
                images_b64 = [img["base64"] for img in image_sources]
                if images_b64:
                    used_vision = True
                    for img in image_sources:
                        valid_source_ids.add(img["source_id"])
        except Exception as exc:
            logger.warning(
                "Vision image fetch failed; continuing with text only: %s", exc
            )
            image_sources = []
            images_b64 = []
            used_vision = False

    # ------------------------------------------------------------------
    # Step 5 – Pass 1: plan answer + optional calculations
    # ------------------------------------------------------------------
    messages_p1 = build_answer_messages(
        question, source_block, image_sources=image_sources if used_vision else None
    )

    t0 = time.perf_counter()
    # OllamaError propagates to the API layer which returns 503.
    raw_text_p1, usage_p1 = ollama_client.chat(
        messages=messages_p1,
        schema=ANSWER_WITH_CALC_SCHEMA,
        images=images_b64 if used_vision else None,
    )
    timings["model_pass1_ms"] = int((time.perf_counter() - t0) * 1000)

    parsed_p1 = _parse_model_json(
        raw_text_p1,
        ollama_client,
        messages_p1,
        ANSWER_WITH_CALC_SCHEMA,
        images=images_b64 if used_vision else None,
    )
    if parsed_p1 is None:
        return _safe_failure_response(conversation_id, question, usage_p1, timings)

    parsed_p1 = _validate_citations(parsed_p1, valid_source_ids)

    # ------------------------------------------------------------------
    # Step 6 – Run the calculator on any planned calculations
    # ------------------------------------------------------------------
    planned_calcs: list[dict[str, Any]] = parsed_p1.get("calculations") or []
    verified_calcs: list[dict[str, Any]] = []
    rejected_calcs: list[dict[str, Any]] = []

    if planned_calcs:
        # Standardize calculation IDs to c1, c2, ... if non-standard
        for idx, calc in enumerate(planned_calcs, 1):
            raw_cid = str(calc.get("id", "")).strip()
            if raw_cid.startswith("{") and raw_cid.endswith("}"):
                raw_cid = raw_cid[1:-1].strip()
            if re.match(r"^c\d+$", raw_cid):
                calc["id"] = raw_cid
            else:
                calc["id"] = f"c{idx}"

        verified_calcs, rejected_calcs = calc_service.run_calculations(
            planned_calcs, hits
        )
        # If the model planned calculations but all were rejected, we can no
        # longer claim the answer is fully verified.
        if not verified_calcs and parsed_p1.get("status") == "answered":
            parsed_p1["status"] = "partial"
            logger.warning(
                "All %d planned calculations were rejected; downgrading status to partial",
                len(planned_calcs),
            )

    # ------------------------------------------------------------------
    # Step 7 – Pass 2 (compose): only when verified calculations exist
    # ------------------------------------------------------------------
    final_answer = parsed_p1.get("answer", "")
    final_claims = parsed_p1.get("claims", [])
    final_missing = parsed_p1.get("missing", "")
    final_status = parsed_p1.get("status", "insufficient_evidence")

    # If status was reported as 'partial' but missing is empty/None and claims exist,
    # the answer is complete -> normalize to 'answered'.
    if final_status == "partial" and _normalize_missing(final_missing) is None and final_claims:
        final_status = "answered"

    if verified_calcs:
        messages_p2 = build_compose_messages(
            question,
            source_block,
            verified_calcs,
            image_sources=image_sources if used_vision else None,
        )
        t0 = time.perf_counter()
        try:
            raw_text_p2, _ = ollama_client.chat(
                messages=messages_p2,
                schema=COMPOSE_SCHEMA,
                images=images_b64 if used_vision else None,
            )
        except OllamaError:
            logger.warning(
                "Pass 2 (compose) raised OllamaError; falling back to Pass 1 answer"
            )
            raw_text_p2 = None
        timings["model_pass2_ms"] = int((time.perf_counter() - t0) * 1000)

        if raw_text_p2:
            parsed_p2 = _parse_model_json(
                raw_text_p2,
                ollama_client,
                messages_p2,
                COMPOSE_SCHEMA,
                images=images_b64 if used_vision else None,
            )
            if parsed_p2 is not None:
                parsed_p2 = _validate_citations(parsed_p2, valid_source_ids)
                p2_answer = parsed_p2.get("answer", "")
                # Substitute {c1}/{c2}/… → formatted values
                substituted_p2_answer = calc_service.substitute_placeholders(
                    p2_answer, verified_calcs
                )

                # Check if Pass 2 produced unresolved placeholders
                unresolved_p2 = re.findall(r"\{c\d+\}", substituted_p2_answer)
                p1_unresolved = re.findall(r"\{c\d+\}", parsed_p1.get("answer", ""))

                if unresolved_p2 and not p1_unresolved and parsed_p1.get("answer", "").strip():
                    logger.warning(
                        "Pass 2 produced unresolved placeholders %s; falling back to Pass 1 answer with verified source values",
                        unresolved_p2,
                    )
                    final_answer = parsed_p1.get("answer", "")
                    final_claims = parsed_p1.get("claims", final_claims)
                    final_missing = parsed_p1.get("missing", final_missing)
                else:
                    final_answer = substituted_p2_answer
                    final_claims = parsed_p2.get("claims", final_claims)
                    final_missing = parsed_p2.get("missing", final_missing)

    # Check for any remaining unresolved placeholders in final_answer
    remaining_unresolved = sorted(set(re.findall(r"\{c\d+\}", final_answer)))
    if remaining_unresolved:
        logger.warning(
            "Final answer contains unresolved placeholders: %s", remaining_unresolved
        )
        # Requirement 3: If placeholders remain unresolved, never return status: "answered".
        if final_claims:
            final_status = "partial"
        else:
            final_status = "insufficient_evidence"

        unresolved_str = ", ".join(remaining_unresolved)
        norm_miss = _normalize_missing(final_missing)
        if norm_miss is None:
            final_missing = f"Unresolved calculation placeholders: {unresolved_str}"
        elif unresolved_str not in norm_miss:
            final_missing = f"{norm_miss} (Unresolved placeholders: {unresolved_str})"
    else:
        # If all planned calculations were verified and substituted, the answer is fully verified.
        if verified_calcs and not rejected_calcs:
            final_status = "answered"

    # Normalize missing: when answered, missing is None; otherwise normalized string
    if final_status == "answered":
        final_missing = None
    else:
        final_missing = _normalize_missing(final_missing)

    # ------------------------------------------------------------------
    # Step 8 – Detect numbers written directly by the model (not from sources)
    # ------------------------------------------------------------------
    unverified_numbers = calc_service.find_unverified_numbers(
        final_answer, hits, verified_calcs
    )
    if unverified_numbers:
        logger.warning(
            "Unverified numbers in answer (not from sources or calculator): %s",
            unverified_numbers,
        )

    # ------------------------------------------------------------------
    # Step 9 – Build citation objects from the sources actually used
    # ------------------------------------------------------------------
    cited_ids = _collect_cited_source_ids({"claims": final_claims})
    # Also ensure any source cited by verified calculations is included
    for calc in verified_calcs:
        for op in calc.get("operands", []):
            src = op.get("source")
            if src and src in valid_source_ids:
                cited_ids.add(src)

    citation_objects = _build_citation_objects(
        cited_ids, hits, image_sources=image_sources if used_vision else None
    )

    # ------------------------------------------------------------------
    # Step 10 – Persist
    # ------------------------------------------------------------------
    t_persist_start = time.perf_counter()

    if conversation_id is None:
        conversation_id = conv_repo.create_conversation(question[:60])

    conv_repo.insert_message(conversation_id, "user", question)

    verification: dict[str, Any] = {
        "answering": {
            "status": final_status,
            "timings_ms": timings,
            "usage_pass1": usage_p1,
        }
    }

    assistant_msg_id = conv_repo.insert_message(
        conversation_id=conversation_id,
        role="assistant",
        content=final_answer,
        verification=verification,
        used_vision=used_vision,
    )

    db_citations = [
        {
            "doc_id": c["doc_id"],
            "page_number": c["page"],
            "section": c.get("section"),
            "snippet": c.get("snippet"),
            "content_type": c.get("content_type"),
        }
        for c in citation_objects
    ]
    conv_repo.insert_citations(assistant_msg_id, db_citations)

    timings["persist_ms"] = int((time.perf_counter() - t_persist_start) * 1000)
    timings["total_ms"] = sum(timings.values())

    # ------------------------------------------------------------------
    # Step 11 – Build response
    # ------------------------------------------------------------------
    result: dict[str, Any] = {
        "conversation_id": str(conversation_id),
        "message_id": assistant_msg_id,
        "status": final_status,
        "answer": final_answer,
        "missing": final_missing,
        "citations": citation_objects,
        "calculations": verified_calcs,
        "rejected_calculations": rejected_calcs,
        "used_vision": used_vision,
        "timings_ms": timings,
    }
    if unverified_numbers:
        result["unverified_numbers"] = unverified_numbers

    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _deduplicate(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove chunks with identical normalised text; record duplicate filenames
    in the 'also_in' key of the surviving hit.

    We keep the first occurrence (highest RRF score) and discard later ones.
    """
    seen: dict[str, int] = {}  # normalised_text → index in output
    output: list[dict[str, Any]] = []

    for hit in hits:
        key = _normalise(hit.get("text", ""))
        if key in seen:
            surviving = output[seen[key]]
            surviving.setdefault("also_in", [])
            fname = hit.get("filename", "")
            if fname and fname not in surviving["also_in"]:
                surviving["also_in"].append(fname)
        else:
            hit = {**hit, "also_in": []}
            seen[key] = len(output)
            output.append(hit)

    return output


def _clean_json_string(text: str) -> str:
    """Strip markdown code fences and extraneous text outside of the JSON object."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
        text = text.strip()
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        text = text[start : end + 1]
    return text


def _parse_model_json(
    raw_text: str,
    client: OllamaClient,
    messages: list[dict[str, Any]],
    schema: dict[str, Any],
    images: list[str] | None = None,
) -> dict[str, Any] | None:
    """Try to parse the model's JSON response.

    If parsing fails, retry once with a stricter reminder appended to the
    conversation (using the same schema), then give up and return None.
    """
    try:
        cleaned = _clean_json_string(raw_text)
        return json.loads(cleaned)
    except (json.JSONDecodeError, ValueError):
        logger.warning("Model returned invalid JSON on first attempt; retrying.")

    retry_messages = messages + [
        {"role": "assistant", "content": raw_text},
        {
            "role": "user",
            "content": (
                "Your previous response was not valid JSON. "
                "Reply ONLY with a valid JSON object matching the schema. "
                "No markdown, no extra text."
            ),
        },
    ]
    try:
        retry_text, _ = client.chat(
            messages=retry_messages, schema=schema, images=images
        )
        cleaned_retry = _clean_json_string(retry_text)
        return json.loads(cleaned_retry)
    except (OllamaError, json.JSONDecodeError, ValueError):
        logger.error("Model returned invalid JSON on retry; failing safely.")
        return None


def _validate_citations(
    parsed: dict[str, Any],
    valid_source_ids: set[str],
) -> dict[str, Any]:
    """Drop unknown source IDs, remove empty claims, downgrade status when
    no valid citations survive.

    Returns a shallow copy of `parsed` with corrections applied.
    """
    parsed = dict(parsed)
    valid_claims = []
    for claim in parsed.get("claims", []):
        good_sources = [s for s in claim.get("sources", []) if s in valid_source_ids]
        if good_sources:
            valid_claims.append({**claim, "sources": good_sources})

    parsed["claims"] = valid_claims

    if parsed.get("status") in {"answered", "partial"} and not valid_claims:
        parsed["status"] = "insufficient_evidence"
        parsed["missing"] = (
            parsed.get("missing", "")
            + " (No valid source citations remained after validation.)"
        ).strip()

    return parsed


def _collect_cited_source_ids(parsed: dict[str, Any]) -> set[str]:
    """Collect the set of source IDs that appear in at least one claim."""
    cited: set[str] = set()
    for claim in parsed.get("claims", []):
        for sid in claim.get("sources", []):
            cited.add(sid)
    return cited


def _build_citation_objects(
    cited_ids: set[str],
    hits: list[dict[str, Any]],
    image_sources: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Build the citation list for the API response and for DB persistence."""
    hit_map = {hit["source_id"]: hit for hit in hits}
    img_map = {img["source_id"]: img for img in (image_sources or [])}

    def _sort_key(s: str) -> tuple[int, int]:
        if s.startswith("S"):
            return (0, int(s[1:]) if s[1:].isdigit() else 0)
        if s.startswith("IMG"):
            return (1, int(s[3:]) if s[3:].isdigit() else 0)
        return (2, 0)

    result = []
    for sid in sorted(cited_ids, key=_sort_key):
        if sid.startswith("S"):
            hit = hit_map.get(sid)
            if hit is None:
                continue
            text = hit.get("text") or ""
            snippet = text if len(text) <= 400 else text[:400]
            result.append({
                "source_id": sid,
                "doc_id": str(hit["doc_id"]),
                "filename": hit.get("filename", ""),
                "also_in": hit.get("also_in", []),
                "page": hit.get("page_number"),
                "section": hit.get("section"),
                "content_type": hit.get("content_type"),
                "snippet": snippet,
            })
        elif sid.startswith("IMG"):
            img = img_map.get(sid)
            if img is None:
                continue
            result.append({
                "source_id": sid,
                "doc_id": str(img["doc_id"]),
                "filename": img.get("filename", ""),
                "also_in": [],
                "page": img.get("page_number"),
                "section": None,
                "content_type": "image",
                "snippet": f"Page {img.get('page_number')} image",
            })

    return result


def _no_evidence_response(
    conversation_id: UUID | None,
    question: str,
    timings: dict[str, int],
) -> dict[str, Any]:
    """Return insufficient_evidence without calling the model."""
    if conversation_id is None:
        conversation_id = conv_repo.create_conversation(question[:60])

    conv_repo.insert_message(conversation_id, "user", question)
    msg_id = conv_repo.insert_message(
        conversation_id,
        "assistant",
        "I could not find relevant information in the uploaded documents.",
        verification={"answering": {"status": "insufficient_evidence", "timings_ms": timings}},
        used_vision=False,
    )

    return {
        "conversation_id": str(conversation_id),
        "message_id": msg_id,
        "status": "insufficient_evidence",
        "answer": "I could not find relevant information in the uploaded documents.",
        "missing": "No sufficiently relevant sources were found.",
        "citations": [],
        "calculations": [],
        "rejected_calculations": [],
        "used_vision": False,
        "timings_ms": timings,
    }


def _safe_failure_response(
    conversation_id: UUID | None,
    question: str,
    usage: dict[str, int],
    timings: dict[str, int],
) -> dict[str, Any]:
    """Return insufficient_evidence when both JSON-parse attempts failed."""
    if conversation_id is None:
        conversation_id = conv_repo.create_conversation(question[:60])

    conv_repo.insert_message(conversation_id, "user", question)
    msg_id = conv_repo.insert_message(
        conversation_id,
        "assistant",
        "The model could not produce a valid structured response.",
        verification={
            "answering": {
                "status": "insufficient_evidence",
                "timings_ms": timings,
                "usage": usage,
                "reason": "model_json_parse_failure",
            }
        },
        used_vision=False,
    )

    return {
        "conversation_id": str(conversation_id),
        "message_id": msg_id,
        "status": "insufficient_evidence",
        "answer": "The model could not produce a valid structured response.",
        "missing": "Model JSON parse failure after retry.",
        "citations": [],
        "calculations": [],
        "rejected_calculations": [],
        "used_vision": False,
        "timings_ms": timings,
    }
