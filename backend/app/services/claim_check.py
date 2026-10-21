"""Phase 5A: Claim support checks (heuristic).

Checks how well each claim in the model's answer is supported by its cited
source text. Uses a two-stage approach:

  Stage 1 – Lexical pass (deterministic computation, heuristic threshold):
    Lowercase content-word overlap after stopword removal.
    "Supported" when ratio >= HIGH_THRESHOLD AND every claim number is in cited text.
    "Borderline" when LOW_THRESHOLD <= ratio < HIGH_THRESHOLD.
    "Unsupported" when ratio < LOW_THRESHOLD OR a claim number is missing from cited text.

  Stage 2 – LLM pass (heuristic, only for borderline claims):
    One Qwen call per borderline claim, with ONLY the claim text and its cited
    source text. Thinking is disabled. If the LLM call fails, the claim stays
    "weak" rather than being promoted to "supported".

Kind label: "heuristic" for all claim-support results. These are fallible
signals. API output never says "verified" or "proven" for these checks.

All public functions can be called without Flask context for unit testing.
Thresholds are UNCALIBRATED guesses – see config.py comment.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Stopwords (minimal English list – content words are what remain)
# ---------------------------------------------------------------------------

_STOPWORDS = frozenset({
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "can", "could", "of", "in", "on", "at",
    "to", "for", "with", "by", "from", "into", "through", "during",
    "and", "or", "but", "not", "no", "nor", "so", "yet", "both",
    "it", "its", "this", "that", "these", "those", "i", "we", "you",
    "he", "she", "they", "them", "their", "our", "your", "my", "his",
    "her", "which", "who", "what", "if", "as", "up", "out", "about",
    "than", "then", "also", "just", "more", "some", "all", "any", "each",
    "also", "very", "one", "two", "three",
})

# Pattern to extract "words" (letters and digits only).
_WORD_RE = re.compile(r"[a-z0-9]+")


def _content_words(text: str) -> set[str]:
    """Return the set of lowercase content words (non-stopwords)."""
    return {w for w in _WORD_RE.findall(text.lower()) if w not in _STOPWORDS}


def _lexical_overlap(claim_text: str, source_text: str) -> float:
    """Compute Jaccard-style overlap ratio between content words.

    Returns: len(intersection) / len(claim_words) when claim_words is non-empty,
             0.0 otherwise.
    """
    claim_words = _content_words(claim_text)
    if not claim_words:
        return 0.0
    source_words = _content_words(source_text)
    return len(claim_words & source_words) / len(claim_words)


# ---------------------------------------------------------------------------
# Number presence check within claim + cited source
# ---------------------------------------------------------------------------

_NUM_RE = re.compile(r"\d[\d,]*(?:\.\d+)?(?:[KMBkmb%])?")


def _claim_numbers(claim_text: str) -> list[str]:
    """Extract bare number strings from claim text for presence verification."""
    return _NUM_RE.findall(claim_text)


def _number_present_in_source(num: str, source_text: str) -> bool:
    """Return True if *num* (stripped of commas) appears in *source_text*."""
    stripped = num.replace(",", "")
    norm_source = re.sub(r"\s+", " ", source_text)
    return num in norm_source or stripped in norm_source


# ---------------------------------------------------------------------------
# LLM claim-support prompt (Phase 5A requirement)
# ---------------------------------------------------------------------------

# Kept minimal so the small model can follow it reliably.
CLAIM_CHECK_SYSTEM = """\
You are a factual claim verifier. You will be given a claim and a source text.
Decide whether the claim is supported by the source text.
Rules:
1. Judge ONLY from the provided source text. Ignore any outside knowledge.
2. Reject any claim that adds facts not stated in the source text.
3. Respond ONLY with valid JSON: {"verdict": "supported"|"partially_supported"|"not_supported", "reason": "<one sentence>"}
4. Do NOT include any explanation outside the JSON object.
"""

CLAIM_CHECK_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "verdict": {
            "type": "string",
            "enum": ["supported", "partially_supported", "not_supported"],
        },
        "reason": {"type": "string"},
    },
    "required": ["verdict", "reason"],
}


def _build_claim_check_messages(
    claim_text: str, source_text: str
) -> list[dict[str, str]]:
    """Build the minimal messages list for the LLM claim-check call."""
    # Truncate source text to ≤ 800 chars to keep the context small.
    truncated = source_text[:800] + ("…" if len(source_text) > 800 else "")
    user_content = (
        f"Claim: {claim_text}\n\n"
        f"Source text:\n{truncated}\n\n"
        "Respond in valid JSON matching the schema provided."
    )
    return [
        {"role": "system", "content": CLAIM_CHECK_SYSTEM},
        {"role": "user", "content": user_content},
    ]


# ---------------------------------------------------------------------------
# Main public function
# ---------------------------------------------------------------------------

def check_claim_support(
    claims: list[dict[str, Any]],
    hits: list[dict[str, Any]],
    image_source_ids: set[str] | None = None,
    ollama_client: Any | None = None,
    verify_mode: str = "both",
    max_llm_claims: int = 5,
    high_threshold: float = 0.60,
    low_threshold: float = 0.35,
) -> list[dict[str, Any]]:
    """Evaluate each claim against its cited source texts.

    Args:
        claims:           Claim list from the model response (text + sources).
        hits:             Retrieved source chunks with source_id and text.
        image_source_ids: Source ids that are images (cannot be text-verified).
        ollama_client:    Injected OllamaClient (None = LLM pass skipped).
        verify_mode:      "off" | "lexical" | "llm" | "both".
        max_llm_claims:   Maximum borderline claims to send to the LLM per answer.
        high_threshold:   UNCALIBRATED – overlap ratio for "supported".
        low_threshold:    UNCALIBRATED – overlap ratio below which = "unsupported".

    Returns:
        List of per-claim result dicts:
        {
            text:      str   – the claim text
            sources:   list  – cited source ids
            support:   "supported"|"weak"|"unsupported"|"visual_unverifiable"
            method:    "lexical"|"llm"|"none"
            overlap:   float – lexical overlap ratio (0.0 for image-only)
            kind:      "heuristic"  ← always; these results are fallible signals
        }

    Note: "supported" here means "passed heuristic check", NOT "proven correct".
    Thresholds (high_threshold, low_threshold) are UNCALIBRATED guesses.
    """
    image_ids = image_source_ids or set()
    source_map: dict[str, str] = {
        hit["source_id"]: hit.get("text", "") for hit in hits
    }

    llm_budget = max_llm_claims  # remaining LLM calls for this answer
    results: list[dict[str, Any]] = []

    for claim in claims:
        claim_text = claim.get("text", "")
        claim_sources = claim.get("sources", [])

        # ---- Images-only claim: cannot text-verify -------------------------
        text_sources = [s for s in claim_sources if s not in image_ids]
        if not text_sources:
            results.append({
                "text": claim_text,
                "sources": claim_sources,
                "support": "visual_unverifiable",
                "method": "none",
                "overlap": 0.0,
                "kind": "heuristic",
            })
            continue

        # ---- Gather cited source texts ------------------------------------
        cited_text = " ".join(source_map.get(s, "") for s in text_sources)

        # ---- Lexical pass --------------------------------------------------
        overlap = _lexical_overlap(claim_text, cited_text)

        # Check that every number in the claim appears in the cited source.
        claim_nums = _claim_numbers(claim_text)
        all_nums_present = all(
            _number_present_in_source(n, cited_text) for n in claim_nums
        )

        if overlap >= high_threshold and all_nums_present:
            lexical_verdict = "supported"
        elif overlap < low_threshold or not all_nums_present:
            lexical_verdict = "unsupported"
        else:
            lexical_verdict = "borderline"

        # If LLM pass is disabled or not needed, resolve immediately.
        if lexical_verdict != "borderline" or verify_mode not in {"llm", "both"}:
            final_support = lexical_verdict if lexical_verdict != "borderline" else "weak"
            results.append({
                "text": claim_text,
                "sources": claim_sources,
                "support": final_support,
                "method": "lexical",
                "overlap": round(overlap, 4),
                "kind": "heuristic",
            })
            continue

        # ---- LLM pass (borderline claims only) ----------------------------
        if llm_budget <= 0 or ollama_client is None:
            # Budget exhausted or no client: borderline → weak.
            results.append({
                "text": claim_text,
                "sources": claim_sources,
                "support": "weak",
                "method": "lexical",
                "overlap": round(overlap, 4),
                "kind": "heuristic",
            })
            continue

        llm_budget -= 1
        llm_verdict, llm_method = _run_llm_claim_check(
            claim_text, cited_text, ollama_client
        )
        results.append({
            "text": claim_text,
            "sources": claim_sources,
            "support": llm_verdict,
            "method": llm_method,
            "overlap": round(overlap, 4),
            "kind": "heuristic",
        })

    return results


# ---------------------------------------------------------------------------
# LLM claim check helper
# ---------------------------------------------------------------------------

def _run_llm_claim_check(
    claim_text: str,
    cited_text: str,
    ollama_client: Any,
) -> tuple[str, str]:
    """Run one LLM call to verify a borderline claim.

    Returns (support_verdict, method_label) where support_verdict is one of
    "supported", "weak", "unsupported".

    On any failure the claim stays "weak" (requirement: LLM failure → weak,
    never "supported").
    """
    messages = _build_claim_check_messages(claim_text, cited_text)
    try:
        raw_text, _ = ollama_client.chat(
            messages=messages,
            schema=CLAIM_CHECK_SCHEMA,
            # thinking off: requirement specifies no chain-of-thought for this call
        )
    except Exception as exc:
        logger.warning(
            "LLM claim-check call failed; borderline claim stays 'weak': %s", exc
        )
        return "weak", "lexical"

    try:
        # Strip markdown fences if present.
        cleaned = raw_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
            cleaned = re.sub(r"\s*```$", "", cleaned).strip()
        parsed = json.loads(cleaned)
        verdict = parsed.get("verdict", "")
    except (json.JSONDecodeError, ValueError, AttributeError) as exc:
        logger.warning("LLM claim-check returned invalid JSON; staying 'weak': %s", exc)
        return "weak", "lexical"

    if verdict == "supported":
        return "supported", "llm"
    elif verdict == "partially_supported":
        return "weak", "llm"
    else:
        return "unsupported", "llm"
