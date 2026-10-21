"""Phase 5A: Verification orchestrator and policy engine.

Runs AFTER answering (after placeholder substitution) and BEFORE persistence.
Flow:
  1. Citation validity     [deterministic]
  2. Number grounding      [deterministic]
  3. Claim support         [heuristic – lexical first, LLM for borderline]
  4. Answer coverage       [deterministic]
  5. Policy                [deterministic] – remove unsupported claims, rebuild answer,
                            set confidence level, handle VERIFY_FAIL_POLICY

Confidence labels are rule-based and never asked from the model:
  "high"      = every claim supported, no weak claim, every number grounded, no
                image-only claim, no uncovered sentence, no rejected calculation.
                "high" means "passed all automated heuristic checks", NOT "correct".
  "medium"    = any weak claim, approximate number, image-only claim, or
                uncovered sentence.
  "low"       = partial status or any removed claim.
  "unchecked" = VERIFY_MODE is "off".
  "unverified"= verification layer itself raised an exception.

Config keys (from app.config):
  VERIFY_MODE             off | lexical | llm | both  (default "both")
  VERIFY_MAX_CLAIMS_LLM   int (default 5)
  VERIFY_FAIL_POLICY      flag | refuse  (default "flag")
  VERIFY_LEXICAL_HIGH     float (default 0.60)   UNCALIBRATED
  VERIFY_LEXICAL_LOW      float (default 0.35)   UNCALIBRATED
  ALLOW_EVAL_OVERRIDES    bool  (default False)
"""

from __future__ import annotations

import logging
import re
import time
from typing import Any

from .claim_check import check_claim_support
from .number_check import check_number_grounding

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Sentence splitter (simple rule-based – no NLTK dependency)
# ---------------------------------------------------------------------------

def _split_sentences(text: str) -> list[str]:
    """Split *text* into sentences on '.', '!', '?' boundaries.

    Keeps bullet-point items as their own sentences.
    """
    # Split on sentence-ending punctuation followed by whitespace or end.
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    sentences: list[str] = []
    for part in parts:
        stripped = part.strip()
        if stripped:
            sentences.append(stripped)
    return sentences


# ---------------------------------------------------------------------------
# Answer coverage check  [deterministic]
# ---------------------------------------------------------------------------

def _check_answer_coverage(
    answer: str, claims: list[dict[str, Any]]
) -> list[str]:
    """Return list of answer sentences not covered by any claim.

    A sentence is "covered" if at least one claim's text overlaps with it
    (simple substring or content-word match).
    Requirement 10: every uncovered sentence blocks confidence "high".
    """
    sentences = _split_sentences(answer)
    all_claim_text = " ".join(c.get("text", "") for c in claims).lower()

    uncovered: list[str] = []
    for sent in sentences:
        words = set(re.findall(r"[a-z0-9]+", sent.lower()))
        # Remove stopwords for overlap.
        content = words - {
            "a", "an", "the", "is", "are", "was", "were", "and", "or",
            "in", "on", "of", "to", "it", "that", "this",
        }
        if not content:
            continue  # empty or stopword-only sentence; skip
        matched = any(w in all_claim_text for w in content)
        if not matched:
            uncovered.append(sent)
    return uncovered


# ---------------------------------------------------------------------------
# Citation validity check  [deterministic]
# ---------------------------------------------------------------------------

def _check_citation_validity(
    claims: list[dict[str, Any]],
    sources_sent: list[str],
) -> dict[str, Any]:
    """Verify every citation maps to a source that was actually sent to the model.

    sources_sent: list of source_ids that were included in the prompt
                  (S1, S2, … and IMG1, IMG2, …).

    Returns dict with:
        passed: bool
        invalid_ids: list of source ids that appear in claims but were NOT in sources_sent
        claims_without_valid_citation: list of claim texts with no valid citation
    """
    valid_set = set(sources_sent)
    invalid_ids: set[str] = set()
    claims_without_valid: list[str] = []

    for claim in claims:
        claim_sources = claim.get("sources", [])
        valid_for_claim = [s for s in claim_sources if s in valid_set]
        bad_for_claim = [s for s in claim_sources if s not in valid_set]
        invalid_ids.update(bad_for_claim)
        if not valid_for_claim:
            claims_without_valid.append(claim.get("text", "")[:200])

    return {
        "passed": not invalid_ids and not claims_without_valid,
        "sources_sent": list(sources_sent),
        "invalid_ids": sorted(invalid_ids),
        "claims_without_valid_citation": claims_without_valid,
    }


# ---------------------------------------------------------------------------
# Policy: rebuild answer from remaining claims
# ---------------------------------------------------------------------------

def _rebuild_answer(claims: list[dict[str, Any]]) -> str:
    """Concatenate surviving claim texts into a plain-text answer.

    Each claim includes its [S#] citation markers (they are already embedded
    in the claim text by the model).
    """
    parts: list[str] = []
    for c in claims:
        text = c.get("text", "").strip()
        sources = c.get("sources", [])
        if text:
            # Append source markers if not already in the text.
            src_str = " ".join(f"[{s}]" for s in sources)
            if src_str and src_str not in text:
                parts.append(f"{text} {src_str}")
            else:
                parts.append(text)
    return " ".join(parts)


# ---------------------------------------------------------------------------
# Confidence determination  [deterministic rule-based]
# ---------------------------------------------------------------------------

def _determine_confidence(
    status: str,
    claim_results: list[dict[str, Any]],
    number_results: list[dict[str, Any]],
    removed_claims: list[dict[str, Any]],
    rejected_calcs: list[dict[str, Any]],
    uncovered_sentences: list[str],
) -> str:
    """Apply the rule-based confidence rules.

    "high"   = every claim passed heuristic checks, no weak claim, every
               number grounded, no image-only claim, no uncovered sentence,
               no rejected calculation.
               NOTE: "high" means "passed all automated checks" — NOT "correct".
    "medium" = any weak claim, approximate number, image-only claim, or
               uncovered sentence.
    "low"    = partial status or any removed claim.
    """
    if status == "partial" or removed_claims:
        return "low"

    has_weak = any(c.get("support") == "weak" for c in claim_results)
    has_unsupported = any(c.get("support") == "unsupported" for c in claim_results)
    has_visual = any(c.get("support") == "visual_unverifiable" for c in claim_results)
    has_ungrounded = any(
        not r.get("ok") and not r.get("ignored_reason") for r in number_results
    )
    has_approximate = any(r.get("approximate") for r in number_results)
    has_rejected_calc = bool(rejected_calcs)

    if has_unsupported:
        # Unsupported claims should have been removed by policy; if any slip
        # through (e.g. policy=flag), treat as low.
        return "low"

    if (
        has_weak
        or has_visual
        or has_ungrounded
        or has_approximate
        or uncovered_sentences
        or has_rejected_calc
    ):
        return "medium"

    return "high"


# ---------------------------------------------------------------------------
# Error response builder
# ---------------------------------------------------------------------------

def _error_result(
    mode: str,
    policy: str,
    reason: str,
    draft_status: str,
    draft_answer: str,
    draft_missing: str | None,
    draft_claims: list[dict[str, Any]],
) -> dict[str, Any]:
    """Return a safe error result per requirement 8.

    No document text, no secrets, no stack traces in the output.
    """
    DISCLAIMER = (
        "Heuristic checks are fallible signals and a 'passed' result does not "
        "prove the answer is correct."
    )
    base = {
        "state": "error",
        "mode": mode,
        "confidence": "unverified",
        "checks": [],
        "claims": [],
        "numbers": [],
        "uncovered_sentences": [],
        "removed_claims": [],
        "sources_sent": [],
        "timings_ms": {},
        "disclaimer": DISCLAIMER,
        "error_reason": reason,
    }
    if policy == "refuse":
        base["status"] = "insufficient_evidence"
        base["answer"] = (
            "The answer could not be verified. Please try again."
        )
        base["missing"] = "Verification error."
    else:
        # "flag": return the draft answer clearly marked unverified.
        base["status"] = draft_status
        base["answer"] = draft_answer
        base["missing"] = draft_missing
    return base


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def verify_answer(
    draft: dict[str, Any],
    sources_sent: list[str],
    verified_calcs: list[dict[str, Any]],
    rejected_calcs: list[dict[str, Any]],
    hits: list[dict[str, Any]],
    ollama_client: Any | None = None,
    config: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Run all Phase 5A verification checks on a draft answer.

    Args:
        draft:          The draft answer dict from answering.answer_question
                        (contains status, answer, claims, missing).
        sources_sent:   Source ids actually included in the model prompt
                        (S1..Sn + IMG1..IMGm that were sent, NOT just retrieved).
        verified_calcs: Calculator results that passed Stage 4B.
        rejected_calcs: Calculator plans that were rejected by Stage 4B.
        hits:           Retrieved source chunks with source_id and text.
        ollama_client:  Injected OllamaClient for LLM claim checks (None = skip).
        config:         Dict of config values (reads VERIFY_* keys).

    Returns:
        Verification result dict; see module docstring for schema.

    Requirement 8: if this function itself raises, the caller must catch it
    and return state="error", confidence="unverified". This function catches
    errors inside individual checks and marks them as failed rather than
    propagating.
    """
    cfg = config or {}
    DISCLAIMER = (
        "Heuristic checks are fallible signals and a 'passed' result does not "
        "prove the answer is correct."
    )

    mode: str = str(cfg.get("VERIFY_MODE", "both")).lower()
    policy: str = str(cfg.get("VERIFY_FAIL_POLICY", "flag")).lower()
    max_llm_claims: int = int(cfg.get("VERIFY_MAX_CLAIMS_LLM", 5))
    high_threshold: float = float(cfg.get("VERIFY_LEXICAL_HIGH", 0.60))
    low_threshold: float = float(cfg.get("VERIFY_LEXICAL_LOW", 0.35))

    # Short-circuit when verification is off.
    if mode == "off":
        return {
            "state": "ok",
            "mode": "off",
            "confidence": "unchecked",
            "checks": [],
            "claims": [],
            "numbers": [],
            "uncovered_sentences": [],
            "removed_claims": [],
            "sources_sent": list(sources_sent),
            "timings_ms": {},
            "disclaimer": DISCLAIMER,
            "status": draft.get("status"),
            "answer": draft.get("answer"),
            "missing": draft.get("missing"),
        }

    draft_status = draft.get("status", "insufficient_evidence")
    draft_answer = draft.get("answer", "")
    draft_claims = list(draft.get("claims", []))
    draft_missing = draft.get("missing")

    timings: dict[str, int] = {}
    checks: list[dict[str, Any]] = []

    # ------------------------------------------------------------------
    # Check 1 – Citation validity  [deterministic]
    # ------------------------------------------------------------------
    t0 = time.perf_counter()
    try:
        citation_result = _check_citation_validity(draft_claims, sources_sent)
        checks.append({
            "name": "citation_validity",
            "kind": "deterministic",
            "passed": citation_result["passed"],
            "details": {
                "sources_sent": citation_result["sources_sent"],
                "invalid_ids": citation_result["invalid_ids"],
                "claims_without_valid_citation": citation_result["claims_without_valid_citation"],
            },
        })
    except Exception as exc:
        logger.exception("Exception in citation_validity check; contained.")
        checks.append({
            "name": "citation_validity",
            "kind": "deterministic",
            "passed": False,
            "details": {"error": "check failed internally"},
        })
        citation_result = {"passed": False, "invalid_ids": [], "claims_without_valid_citation": []}
    timings["citation_validity_ms"] = int((time.perf_counter() - t0) * 1000)

    # ------------------------------------------------------------------
    # Check 2 – Number grounding  [deterministic]
    # ------------------------------------------------------------------
    t0 = time.perf_counter()
    image_source_ids = {s for s in sources_sent if s.startswith("IMG")}
    number_results: list[dict[str, Any]] = []
    try:
        number_results = check_number_grounding(
            answer=draft_answer,
            claims=draft_claims,
            hits=hits,
            verified_calcs=verified_calcs,
            image_source_ids=image_source_ids,
        )
        numbers_passed = all(r.get("ok") for r in number_results)
        checks.append({
            "name": "number_grounding",
            "kind": "deterministic",
            "passed": numbers_passed,
            "details": {"numbers": number_results},
        })
    except Exception as exc:
        logger.exception("Exception in number_grounding check; contained.")
        checks.append({
            "name": "number_grounding",
            "kind": "deterministic",
            "passed": False,
            "details": {"error": "check failed internally"},
        })
        numbers_passed = False
    timings["number_grounding_ms"] = int((time.perf_counter() - t0) * 1000)

    # ------------------------------------------------------------------
    # Check 3 – Claim support  [heuristic]
    # ------------------------------------------------------------------
    t0 = time.perf_counter()
    claim_results: list[dict[str, Any]] = []
    try:
        claim_results = check_claim_support(
            claims=draft_claims,
            hits=hits,
            image_source_ids=image_source_ids,
            ollama_client=ollama_client if mode in {"llm", "both"} else None,
            verify_mode=mode,
            max_llm_claims=max_llm_claims,
            high_threshold=high_threshold,
            low_threshold=low_threshold,
        )
        claims_passed = all(
            c.get("support") in {"supported", "visual_unverifiable"}
            for c in claim_results
        )
        checks.append({
            "name": "claim_support",
            "kind": "heuristic",
            "passed": claims_passed,
            "details": {
                "note": "passed heuristic check — not proven correct",
                "claims": [
                    {k: v for k, v in c.items() if k != "kind"}
                    for c in claim_results
                ],
            },
        })
    except Exception as exc:
        logger.exception("Exception in claim_support check; contained.")
        checks.append({
            "name": "claim_support",
            "kind": "heuristic",
            "passed": False,
            "details": {"error": "check failed internally"},
        })
        claim_results = []
    timings["claim_support_ms"] = int((time.perf_counter() - t0) * 1000)

    # ------------------------------------------------------------------
    # Check 4 – Answer coverage  [deterministic]
    # ------------------------------------------------------------------
    t0 = time.perf_counter()
    uncovered_sentences: list[str] = []
    try:
        uncovered_sentences = _check_answer_coverage(draft_answer, draft_claims)
        checks.append({
            "name": "answer_coverage",
            "kind": "deterministic",
            "passed": not uncovered_sentences,
            "details": {"uncovered_sentences": uncovered_sentences},
        })
    except Exception as exc:
        logger.exception("Exception in answer_coverage check; contained.")
        checks.append({
            "name": "answer_coverage",
            "kind": "deterministic",
            "passed": False,
            "details": {"error": "check failed internally"},
        })
    timings["answer_coverage_ms"] = int((time.perf_counter() - t0) * 1000)

    # ------------------------------------------------------------------
    # Policy: mark numbers with ungrounded non-approximate values as unsupported
    # ------------------------------------------------------------------
    # Upgrade claims whose cited number is not grounded to "unsupported".
    # We match by claim_index.
    ungrounded_claim_indices: set[int] = set()
    for nr in number_results:
        if (
            not nr.get("ok")
            and not nr.get("ignored_reason")
            and not nr.get("approximate")
            and nr.get("claim_index") is not None
        ):
            ungrounded_claim_indices.add(nr["claim_index"])

    # Also mark claims that are "unsupported" from claim_results.
    unsupported_claim_indices: set[int] = set()
    for i, cr in enumerate(claim_results):
        if cr.get("support") == "unsupported":
            unsupported_claim_indices.add(i)
    unsupported_claim_indices |= ungrounded_claim_indices

    # Remove unsupported claims.
    removed_claims: list[dict[str, Any]] = []
    surviving_claims: list[dict[str, Any]] = []
    for i, claim in enumerate(draft_claims):
        if i in unsupported_claim_indices:
            removed_claims.append({
                "text": claim.get("text", "")[:200],  # no full source text
                "sources": claim.get("sources", []),
                "reason": "unsupported or ungrounded number",
            })
        else:
            surviving_claims.append(claim)

    # Rebuild answer and status based on policy.
    final_status = draft_status
    final_answer = draft_answer
    final_missing = draft_missing

    if removed_claims:
        if surviving_claims:
            final_answer = _rebuild_answer(surviving_claims)
            final_status = "partial"
            missing_msg = "Some statements could not be verified against the sources."
            if final_missing:
                final_missing = f"{final_missing} {missing_msg}"
            else:
                final_missing = missing_msg
        else:
            # No claims remain.
            final_answer = (
                "The answer could not be verified against the sources."
                if policy == "flag"
                else "I could not find sufficient evidence to answer the question."
            )
            final_status = "insufficient_evidence"
            final_missing = "All claims were removed during verification."

    # ------------------------------------------------------------------
    # Confidence  [deterministic rule-based]
    # ------------------------------------------------------------------
    confidence = _determine_confidence(
        status=final_status,
        claim_results=claim_results,
        number_results=number_results,
        removed_claims=removed_claims,
        rejected_calcs=rejected_calcs,
        uncovered_sentences=uncovered_sentences,
    )

    timings["total_ms"] = sum(timings.values())

    # ------------------------------------------------------------------
    # Build verification payload
    # ------------------------------------------------------------------
    # Snippets of source text in the payload are capped at 200 chars (req 6).
    return {
        "state": "ok",
        "mode": mode,
        "confidence": confidence,
        "checks": checks,
        "claims": claim_results,
        "numbers": number_results,
        "uncovered_sentences": uncovered_sentences,
        "removed_claims": removed_claims,
        "sources_sent": list(sources_sent),
        "timings_ms": timings,
        "disclaimer": DISCLAIMER,
        # Final (possibly rebuilt) answer fields for the caller.
        "status": final_status,
        "answer": final_answer,
        "missing": final_missing,
    }
