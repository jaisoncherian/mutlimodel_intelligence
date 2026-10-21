"""Phase 5A: Number grounding checks (deterministic).

Rules (requirement 4):
- Extract every significant number from the final answer text.
- A number is grounded ONLY when:
    (a) the same value appears verbatim in one of THAT CLAIM'S cited source texts, OR
    (b) it matches a calculator result whose operands passed Stage 4B verification
        and are cited.
- Numbers appearing only in uncited sources are NOT grounded.
- Ignore: source-id tokens like [S1]/[IMG2], "page N" references, list ordinals.
- Years: treated the same as any other number per requirement 4 – grounded only if
  present in the claim's cited source or the question.
- Image numbers are "approximate" and never count as grounded.
- Thousands-separators, currency symbols, percentages, K/M/B suffixes, parenthesised
  negatives all handled (reuses calculator.parse_number for normalisation).

All public functions are pure (no network, no DB, no Flask).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any

from .calculator import parse_number

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Source-id tokens like [S1], [S2], [IMG1] – used to skip citation markers.
_SOURCE_ID_RE = re.compile(r"\[(?:S\d+|IMG\d+)\]")

# "page N" or "page N," style references to ignore.
_PAGE_REF_RE = re.compile(r"\bpage\s+\d+\b", re.IGNORECASE)

# List ordinals like "1.", "2)", "1st", "2nd", "3rd", "Nth" to ignore.
_ORDINAL_RE = re.compile(
    r"(?<!\d)\d+(?:st|nd|rd|th)\b"  # 1st 2nd 3rd 4th …
    r"|\b\d+[.)]\s",                 # 1. or 2) at start of list item
    re.IGNORECASE,
)

# Matches number tokens in various formats:
#   parenthesised negatives: (300)
#   currency prefix:         $1.2M  £500K
#   thousands-separated:     1,250
#   K/M/B suffix:            12.5K
#   plain decimal:           33.89
#   plain integer:           125400
# Note: We deliberately include single-digit and 2-digit numbers here so that
# the caller can decide which to include; we filter later by context.
_NUMBER_TOKEN_RE = re.compile(
    r"(?:"
    r"\([£$€¥₹]?\s*\d[\d,]*(?:\.\d+)?[KMBkmb]?\)"  # parenthesised negatives: (300)
    r"|[£$€¥₹]\s*\d[\d,]*(?:\.\d+)?[KMBkmb]?%?"    # currency prefix: $1.2M
    r"|\d[\d,]*(?:\.\d+)?[KMBkmb]?%"                # with % suffix: 12.5%
    r"|\d{1,3}(?:,\d{3})+(?:\.\d+)?[KMBkmb]?"       # thousands-sep: 1,250
    r"|\d{4,}(?:\.\d+)?[KMBkmb]?"                   # 4+ digit integer
    r"|\d+\.\d+[KMBkmb]?"                            # decimal: 33.89
    r"|\d+[KMBkmb]"                                  # magnitude suffix only: 5K
    r")"
)

# Contextual filter: skip year-like 4-digit numbers only in contexts like
# "Q1 2025" or standalone years. We mark them ignorable but still check
# whether they appear in the cited source per requirement 4.
_YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")


# ---------------------------------------------------------------------------
# Text preparation helpers
# ---------------------------------------------------------------------------

def _strip_citation_markers(text: str) -> str:
    """Remove [S1], [IMG2] etc. so their digits aren't extracted as numbers."""
    return _SOURCE_ID_RE.sub("", text)


def _build_ignore_spans(text: str) -> list[tuple[int, int]]:
    """Return (start, end) spans of tokens that should be ignored during extraction.

    Ignored: [S1] markers (already stripped), page references, ordinals.
    """
    spans: list[tuple[int, int]] = []
    for pat in (_PAGE_REF_RE, _ORDINAL_RE):
        for m in pat.finditer(text):
            spans.append((m.start(), m.end()))
    return spans


def _is_in_ignored_span(start: int, spans: list[tuple[int, int]]) -> bool:
    for s, e in spans:
        if s <= start < e:
            return True
    return False


# ---------------------------------------------------------------------------
# Normalisation for comparison
# ---------------------------------------------------------------------------

def _normalize_value(text: str) -> Decimal | None:
    """Parse a number token to Decimal for comparison; return None on failure."""
    try:
        return parse_number(text)
    except (ValueError, InvalidOperation):
        return None


def _values_equal(a: Decimal, b: Decimal) -> bool:
    """Return True when two Decimals are equal (handles trailing zeros)."""
    # Compare normalised forms: 1.20 == 1.2
    try:
        return a.normalize() == b.normalize() or a == b
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Source text extraction
# ---------------------------------------------------------------------------

def _get_source_text(source_id: str, hits: list[dict[str, Any]]) -> str:
    """Return the text of the source chunk with the given id, or ''."""
    for hit in hits:
        if hit.get("source_id") == source_id:
            return hit.get("text", "")
    return ""


def _number_in_text(value: Decimal, text: str) -> bool:
    """Return True if any number token in *text* normalises to *value*."""
    for m in _NUMBER_TOKEN_RE.finditer(text):
        cand = _normalize_value(m.group())
        if cand is not None and _values_equal(value, cand):
            return True
    return False


# ---------------------------------------------------------------------------
# Calculator result lookup
# ---------------------------------------------------------------------------

def _calc_result_value(calc: dict[str, Any]) -> Decimal | None:
    """Return the Decimal result of a verified calculation, or None."""
    raw = calc.get("result")
    if raw is None:
        return None
    try:
        return Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return None


def _number_grounded_by_calc(
    value: Decimal,
    verified_calcs: list[dict[str, Any]],
    claim_sources: list[str],
    hits: list[dict[str, Any]],
) -> str | None:
    """Return calc id (e.g. 'calc:c1') if *value* matches a verified result
    whose operands are cited by *claim_sources*.  Otherwise return None.

    A calc's operands are considered cited when the operand's source is among
    claim_sources OR appears in the retrieved hits that back claim_sources.
    """
    for calc in verified_calcs:
        result = _calc_result_value(calc)
        if result is None:
            continue
        if not _values_equal(value, result):
            continue
        # Check operand sources are among claim_sources or a superset of hits.
        operand_sources = {op.get("source", "") for op in calc.get("operands", [])}
        # Operands must all appear in the retrieved hit set (they passed 4B).
        # For grounding purposes we require at least one operand source is cited
        # by the claim that contains this number.
        if operand_sources & set(claim_sources):
            return f"calc:{calc['id']}"
    return None


# ---------------------------------------------------------------------------
# Main extraction and grounding function
# ---------------------------------------------------------------------------

def check_number_grounding(
    answer: str,
    claims: list[dict[str, Any]],
    hits: list[dict[str, Any]],
    verified_calcs: list[dict[str, Any]],
    image_source_ids: set[str] | None = None,
    question: str = "",
) -> list[dict[str, Any]]:
    """Extract every number from *answer* and determine its grounding.

    Args:
        answer:           Final answer text after placeholder substitution.
        claims:           List of claim dicts with 'text' and 'sources' keys.
        hits:             Retrieved source chunks, each with 'source_id' and 'text'.
        verified_calcs:   Verified calculator results from Stage 4B.
        image_source_ids: Set of source ids that are images (IMG1, IMG2…).
        question:         Original question text (years/page-refs in question
                          may be ignored per requirement 4).

    Returns:
        List of per-number result dicts:
        {
            text:           str   – the raw token as it appears in the answer
            value:          str   – normalised Decimal string (or None if unparseable)
            claim_index:    int | None – index of the claim that contains this number
            grounded_in:    str | None – "S2" / "calc:c1" / None
            approximate:    bool  – True if the source is an image (visual)
            ignored_reason: str | None – why ignored (e.g. "source_id_marker")
            ok:             bool  – True when grounded or ignored
        }

    kind: "deterministic"  (requirement 2 – no model calls, pure rules)

    IMPORTANT: "present in the cited source" is a NECESSARY CONDITION to call a
    number grounded, not PROOF that it belongs to the right quantity.
    """
    image_ids = image_source_ids or set()

    # Strip citation markers before scanning for number tokens.
    stripped_answer = _strip_citation_markers(answer)
    ignored_spans = _build_ignore_spans(stripped_answer)

    # Also collect numbers in the question text for year-ignore logic.
    question_numbers: set[Decimal] = set()
    for m in _NUMBER_TOKEN_RE.finditer(question):
        v = _normalize_value(m.group())
        if v is not None:
            question_numbers.add(v)

    # Build a mapping from character offset in stripped_answer to claim index.
    # We associate each number with the claim whose text best contains it.
    # Simple approach: for each number token in answer, find which claim contains it.
    claim_offsets: list[tuple[int, int, int]] = []  # (start, end, claim_idx)
    for ci, claim in enumerate(claims):
        # Find where in the stripped answer this claim's text occurs.
        claim_text = _strip_citation_markers(claim.get("text", ""))
        pos = stripped_answer.find(claim_text)
        if pos != -1:
            claim_offsets.append((pos, pos + len(claim_text), ci))

    def _find_claim_for_position(pos: int) -> int | None:
        for (s, e, ci) in claim_offsets:
            if s <= pos < e:
                return ci
        return None

    results: list[dict[str, Any]] = []

    for m in _NUMBER_TOKEN_RE.finditer(stripped_answer):
        token = m.group()
        start = m.start()

        # Skip tokens in ignored spans (page refs, ordinals).
        if _is_in_ignored_span(start, ignored_spans):
            results.append(_ignored_entry(token, "page_ref_or_ordinal"))
            continue

        value = _normalize_value(token)
        if value is None:
            # Unparseable token; skip.
            results.append(_ignored_entry(token, "unparseable"))
            continue

        # Determine if this is a year-like value.
        is_year = bool(_YEAR_PATTERN.fullmatch(token.strip()))

        # Years: ignore only if they appear in the question or cited source
        # (per requirement 4 – every ignored token must be listed).
        if is_year and value in question_numbers:
            results.append(_ignored_entry(token, f"year_in_question:{token}"))
            continue

        # Find the associated claim.
        claim_idx = _find_claim_for_position(start)
        claim = claims[claim_idx] if claim_idx is not None else None
        claim_sources = claim.get("sources", []) if claim else []

        # Check if all cited sources are image-only for this claim.
        all_image = bool(claim_sources) and all(s in image_ids for s in claim_sources)
        if all_image:
            results.append({
                "text": token,
                "value": str(value),
                "claim_index": claim_idx,
                "grounded_in": None,
                "approximate": True,
                "ignored_reason": None,
                "ok": False,  # image numbers are approximate, not grounded
            })
            continue

        # Try to ground in cited sources.
        grounded_in: str | None = None
        for sid in claim_sources:
            if sid in image_ids:
                continue  # images cannot ground numbers deterministically
            src_text = _get_source_text(sid, hits)
            if _number_in_text(value, src_text):
                # Also check year in cited source is OK per req 4.
                grounded_in = sid
                break

        # If not grounded in cited source text, try calculator results.
        if grounded_in is None and verified_calcs:
            grounded_in = _number_grounded_by_calc(
                value, verified_calcs, claim_sources, hits
            )

        # Year that is in the cited source but grounding check failed:
        # list as ignored per requirement 4.
        if is_year and grounded_in is not None:
            results.append(_ignored_entry(token, f"year_in_cited_source:{token}"))
            continue

        results.append({
            "text": token,
            "value": str(value),
            "claim_index": claim_idx,
            "grounded_in": grounded_in,
            "approximate": False,
            "ignored_reason": None,
            "ok": grounded_in is not None,
        })

    return results


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _ignored_entry(token: str, reason: str) -> dict[str, Any]:
    return {
        "text": token,
        "value": None,
        "claim_index": None,
        "grounded_in": None,
        "approximate": False,
        "ignored_reason": reason,
        "ok": True,  # ignored tokens do not fail grounding
    }
