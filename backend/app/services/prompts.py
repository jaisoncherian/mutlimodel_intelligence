"""All prompt text for Phase 4 lives here so it is easy to read and tune.

Keep every prompt short and strict: the model is small (4 B params) so
brevity beats verbosity.  Numbered source labels (S1, S2, …) make it easy
for the model to cite correctly and for Python to validate citations.
"""

from __future__ import annotations

from typing import Any


# ---------------------------------------------------------------------------
# Stage 4A – grounded answer
# ---------------------------------------------------------------------------

SYSTEM_ANSWER = """\
You are a precise document-answering assistant.
Rules:
1. Answer ONLY from the numbered sources provided by the user.
   Do NOT use any outside knowledge.
2. If the sources contain the complete answer to all parts of the question,
   set status to "answered" and set "missing" to "".
3. If only part of the question is supported, set status to "partial",
   answer the supported part, and state the unsupported part in "missing".
4. If the sources do not contain the answer, set status to
   "insufficient_evidence" and describe what is missing in "missing".
   Never guess or infer beyond what is written.
5. Every claim must cite one or more source IDs (e.g. "S1", "S3").
   Copy numbers EXACTLY as written in the source; do not compute anything.
6. When calculations are required, put the raw values in the "calculations" array
   with short sequential IDs ("c1", "c2").
7. Be concise. Prefer bullet points for lists of facts.
"""

SYSTEM_ANSWER_WITH_VISION = """\
You are a precise document-answering assistant with vision capability.
Rules:
1. Answer ONLY from the numbered text sources and page images provided.
   Do NOT use any outside knowledge.
2. If the sources contain the complete answer to all parts of the question,
   set status to "answered" and set "missing" to "".
3. If only part of the question is supported, set status to "partial",
   answer the supported part, and state the unsupported part in "missing".
4. If the sources do not contain the answer, set status to
   "insufficient_evidence" and describe what is missing in "missing".
   Never guess or infer beyond what is written or shown.
5. Every claim must cite one or more source IDs (e.g. "S1", "S3", "IMG1").
   Copy numbers EXACTLY as written in the source; do not compute anything.
6. When calculations are required, put the raw values in the "calculations" array
   with short sequential IDs ("c1", "c2").
7. The provided images (e.g. [IMG1], [IMG2]) are original document pages.
   Read chart/graph values from an image only when the text sources do not state them.
   Say "approximately" for values estimated from a plot or chart.
8. Be concise. Prefer bullet points for lists of facts.
"""


def build_source_block(hits: list[dict[str, Any]]) -> str:
    """Format retrieved chunks as a numbered source list for the prompt.

    Example output:
        [S1] file=report.pdf page=3 section="Revenue" type=text
        The revenue for Q1 was 125,400 …

        [S2] file=report.pdf page=5 section="Quarterly Financial Table" type=table
        | Quarter | Revenue |
        …
    """
    lines: list[str] = []
    for hit in hits:
        label = hit["source_id"]          # e.g. "S1"
        filename = hit.get("filename", "")
        page = hit.get("page_number", "?")
        section = hit.get("section") or ""
        content_type = hit.get("content_type", "text")
        text = hit.get("text", "")
        section_part = f' section="{section}"' if section else ""
        lines.append(
            f'[{label}] file={filename} page={page}{section_part} type={content_type}\n{text}'
        )
    return "\n\n".join(lines)


def build_image_source_block(image_sources: list[dict[str, Any]]) -> str:
    """Format image sources as a numbered source list for the prompt."""
    lines: list[str] = []
    for img in image_sources:
        label = img["source_id"]  # e.g. "IMG1"
        filename = img.get("filename", "")
        page = img.get("page_number", "?")
        lines.append(f'[{label}] file={filename} page={page} (original page image)')
    return "\n\n".join(lines)


def build_answer_messages(
    question: str,
    source_block: str,
    image_sources: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
    """Return the chat messages list for the grounded-answer call."""
    if image_sources:
        system_content = SYSTEM_ANSWER_WITH_VISION
        image_block = build_image_source_block(image_sources)
        user_content = (
            f"Sources:\n\n{source_block}\n\n"
            f"Page Images:\n\n{image_block}\n\n"
            f"Question: {question}\n\n"
            "Respond in valid JSON matching the schema provided."
        )
    else:
        system_content = SYSTEM_ANSWER
        user_content = (
            f"Sources:\n\n{source_block}\n\n"
            f"Question: {question}\n\n"
            "Respond in valid JSON matching the schema provided."
        )

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]


# ---------------------------------------------------------------------------
# JSON schema the model must conform to (Stage 4A — still used by retry path)
# ---------------------------------------------------------------------------

ANSWER_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "status": {
            "type": "string",
            "enum": ["answered", "partial", "insufficient_evidence"],
        },
        "answer": {"type": "string"},
        "claims": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string"},
                    "sources": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": ["text", "sources"],
            },
        },
        "missing": {"type": "string"},
    },
    "required": ["status", "answer", "claims", "missing"],
}

# ---------------------------------------------------------------------------
# Stage 4B – Pass 1: plan answer AND any required calculations
# ---------------------------------------------------------------------------

# The model sees the same sources as 4A but the schema gains a "calculations"
# array.  For questions that need no arithmetic the model returns an empty
# array; we skip Pass 2 entirely in that case.
#
# SYSTEM_ANSWER rule 4 already says "Copy numbers EXACTLY as written in the
# source; do not compute anything."  The model therefore puts the *raw text*
# ("125,400") into value_text, and Python does the arithmetic.

_CLAIM_ITEM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "text": {"type": "string"},
        "sources": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["text", "sources"],
}

_OPERAND_ITEM: dict[str, Any] = {
    "type": "object",
    "properties": {
        "label": {"type": "string"},       # human-readable name, e.g. "Q1 revenue"
        "value_text": {"type": "string"},  # copied verbatim from source, e.g. "125,400"
        "source": {"type": "string"},      # source ID, e.g. "S2"
    },
    "required": ["label", "value_text", "source"],
}

_VALID_OPERATIONS = [
    "add", "subtract", "multiply", "divide",
    "percent_change", "percent_of",
    "average", "sum", "min", "max", "argmax", "argmin",
]

ANSWER_WITH_CALC_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "status": {
            "type": "string",
            "enum": ["answered", "partial", "insufficient_evidence"],
        },
        "answer": {"type": "string"},
        "claims": {"type": "array", "items": _CLAIM_ITEM},
        "missing": {"type": "string"},
        "calculations": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        # e.g. "c1", "c2" — unique within the response
                    },
                    "operation": {
                        "type": "string",
                        "enum": _VALID_OPERATIONS,
                    },
                    "operands": {
                        "type": "array",
                        "items": _OPERAND_ITEM,
                    },
                    "unit": {
                        "type": "string",
                        # e.g. "%" or "USD" or "" — used for formatting
                    },
                },
                "required": ["id", "operation", "operands", "unit"],
            },
        },
    },
    "required": ["status", "answer", "claims", "missing", "calculations"],
}

# ---------------------------------------------------------------------------
# Stage 4B – Pass 2: compose the final answer using placeholder references
# ---------------------------------------------------------------------------

SYSTEM_COMPOSE = """\
You are a precise document-answering assistant writing a final answer.
You are given numbered sources and pre-verified calculation results.
Rules:
1. Answer ONLY from the numbered sources and the provided calculation results.
   Do NOT use any outside knowledge.
2. Every computed value from the 'Verified calculations' block MUST appear
   using its exact placeholder tag (e.g. {c1}, {c2}).
   Do NOT compute values directly and do NOT invent placeholders that are not in the 'Verified calculations' block.
3. Raw numbers copied directly from the sources (such as historical revenue,
   operating cost, units, or dates) are NOT calculations: write them exactly
   as given in the source (e.g. "$125,400", "$83,200", "$167,900").
   NEVER replace raw source numbers with {c...} placeholders.
4. Every claim must cite one or more source IDs (e.g. "S1", "S3").
5. If the sources and calculations answer the question completely, set "missing" to "".
   Do NOT list calculation placeholders in "missing".
6. Be concise.
"""


SYSTEM_COMPOSE_WITH_VISION = """\
You are a precise document-answering assistant writing a final answer.
You are given numbered sources, page images, and pre-verified calculation results.
Rules:
1. Answer ONLY from the numbered sources, page images, and the provided calculation results.
   Do NOT use any outside knowledge.
2. Every computed value from the 'Verified calculations' block MUST appear
   using its exact placeholder tag (e.g. {c1}, {c2}).
   Do NOT compute values directly and do NOT invent placeholders that are not in the 'Verified calculations' block.
3. Raw numbers copied directly from the sources (such as historical revenue,
   operating cost, units, or dates) are NOT calculations: write them exactly
   as given in the source (e.g. "$125,400", "$83,200", "$167,900").
   NEVER replace raw source numbers with {c...} placeholders.
4. The provided images (e.g. [IMG1], [IMG2]) are original document pages.
   Read chart/graph values from an image only when the text sources do not state them.
   Say "approximately" for values estimated from a plot or chart.
5. Every claim must cite one or more source IDs (e.g. "S1", "IMG1").
6. If the sources and calculations answer the question completely, set "missing" to "".
   Do NOT list calculation placeholders in "missing".
7. Be concise.
"""


def build_calc_block(verified_calcs: list[dict[str, Any]]) -> str:
    """Format verified calculator results for the Pass 2 prompt.

    Example output:
        [c1] percent_change(Q1 revenue=125,400, Q4 revenue=167,900) = 33.89%
    """
    lines: list[str] = []
    for calc in verified_calcs:
        cid = calc["id"]
        operation = calc["operation"]
        unit = calc.get("unit", "")
        formatted = calc["formatted"]
        ops_desc = ", ".join(
            f"{op['label']}={op['value_text']}"
            for op in calc.get("operands", [])
        )
        unit_part = f" unit={unit}" if unit and unit != "%" else ""
        lines.append(f"[{cid}] {operation}({ops_desc}){unit_part} = {formatted}")
    return "\n".join(lines)


def build_compose_messages(
    question: str,
    source_block: str,
    verified_calcs: list[dict[str, Any]],
    image_sources: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
    """Return the chat messages list for the compose pass (Pass 2)."""
    calc_block = build_calc_block(verified_calcs)
    placeholders = ", ".join("{" + c["id"] + "}" for c in verified_calcs)

    if image_sources:
        system_content = SYSTEM_COMPOSE_WITH_VISION
        image_block = build_image_source_block(image_sources)
        user_content = (
            f"Sources:\n\n{source_block}\n\n"
            f"Page Images:\n\n{image_block}\n\n"
            f"Verified calculations — use these placeholders ({placeholders}):\n"
            f"{calc_block}\n\n"
            f"Question: {question}\n\n"
            "Respond in valid JSON matching the schema provided."
        )
    else:
        system_content = SYSTEM_COMPOSE
        user_content = (
            f"Sources:\n\n{source_block}\n\n"
            f"Verified calculations — use these placeholders ({placeholders}):\n"
            f"{calc_block}\n\n"
            f"Question: {question}\n\n"
            "Respond in valid JSON matching the schema provided."
        )

    return [
        {"role": "system", "content": system_content},
        {"role": "user", "content": user_content},
    ]


# Pass 2 schema: same as 4A but no status (Pass 1's status is authoritative)
# and no calculations field (those are done).
COMPOSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "answer": {"type": "string"},
        "claims": {"type": "array", "items": _CLAIM_ITEM},
        "missing": {"type": "string"},
    },
    "required": ["answer", "claims", "missing"],
}
