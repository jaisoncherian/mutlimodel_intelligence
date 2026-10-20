"""Safe calculation engine for Phase 4B.

Design decisions (for interview):
- No eval(), no exec(). Every operation is a named Python expression.
- decimal.Decimal is used for all arithmetic so we don't get floating-point
  drift on financial numbers (e.g. 33.89% instead of 33.890000000000001%).
- The whitelist of operations is a frozenset so it's impossible to run an
  unknown operation — the code simply raises CalculatorError.
- Verbatim verification: before computing, we check that each operand's
  value_text appears as a substring (whitespace-normalised) in the cited
  source chunk.  If it doesn't, the whole calculation is rejected.
- argmax/argmin return the *label* string of the best operand, not a number.
- All public API functions are pure (no network, no DB, no Flask).
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any


class CalculatorError(Exception):
    """Raised for invalid input, unknown operations, or verification failures."""


# ---------------------------------------------------------------------------
# Whitelisted operations
# ---------------------------------------------------------------------------

VALID_OPERATIONS = frozenset({
    "add", "subtract", "multiply", "divide",
    "percent_change", "percent_of",
    "average", "sum", "min", "max",
    "argmax", "argmin",
})


# ---------------------------------------------------------------------------
# Number parser
# ---------------------------------------------------------------------------

def parse_number(text: str) -> Decimal:
    """Parse a human-readable number string to a Decimal.

    Handles:
    - Thousands separators:        "1,250"      → 1250
    - Leading currency symbols:    "$1.2M"      → 1200000
    - Trailing percent sign:       "12.5%"      → 12.5
    - Parentheses as negative:     "(300)"      → -300
    - K / M / B magnitude suffix:  "500K"       → 500000

    Raises:
        ValueError: if the string cannot be interpreted as a number.
    """
    if not isinstance(text, str):
        raise ValueError(f"Expected str, got {type(text).__name__}")

    original = text
    text = text.strip()
    if not text:
        raise ValueError("Cannot parse an empty string as a number")

    # 1. Parentheses → negative
    negative = False
    if text.startswith("(") and text.endswith(")"):
        negative = True
        text = text[1:-1].strip()

    # 2. Strip trailing percent sign (we keep the numeric value; the unit % is
    #    tracked by the calculation's "unit" field, not by the value itself).
    text = text.rstrip("%").strip()

    # 3. Strip leading currency symbols ($, £, €, ¥, ₹)
    text = re.sub(r"^[£$€¥₹]\s*", "", text)

    # 4. K / M / B magnitude suffixes (case-insensitive)
    multiplier = Decimal("1")
    if text and text[-1].upper() == "K":
        multiplier = Decimal("1000")
        text = text[:-1].strip()
    elif text and text[-1].upper() == "M":
        multiplier = Decimal("1000000")
        text = text[:-1].strip()
    elif text and text[-1].upper() == "B":
        multiplier = Decimal("1000000000")
        text = text[:-1].strip()

    # 5. Remove thousands separators (commas between digit groups only)
    text = text.replace(",", "")

    # 6. Must now be a plain decimal number
    if not re.fullmatch(r"-?\d+(\.\d+)?", text):
        raise ValueError(
            f"Cannot parse {original!r} as a number "
            f"(after stripping symbols, remaining text is {text!r})"
        )

    try:
        value = Decimal(text) * multiplier
    except InvalidOperation as exc:
        raise ValueError(f"Decimal parse failed for {original!r}") from exc

    return -value if negative else value


# ---------------------------------------------------------------------------
# Verbatim verification
# ---------------------------------------------------------------------------

def is_verbatim(value_text: str, source_text: str) -> bool:
    """Return True if value_text appears (whitespace-normalised) in source_text.

    Allows leading currency symbols ($/£/€/¥/₹) attached by the model when the
    source table header specifies the currency in USD/etc.
    """
    if not value_text or not source_text:
        return False
    norm_value = re.sub(r"\s+", " ", value_text).strip()
    norm_source = re.sub(r"\s+", " ", source_text)
    if norm_value in norm_source:
        return True

    # Strip leading currency symbols if model attached $ from column header "USD"
    stripped_value = re.sub(r"^[£$€¥₹]\s*", "", norm_value)
    if stripped_value and stripped_value in norm_source:
        return True

    return False


# ---------------------------------------------------------------------------
# Computation
# ---------------------------------------------------------------------------

def _compute(
    operation: str,
    operands: list[dict[str, Any]],
) -> tuple[Decimal | str, bool]:
    """Compute `operation` on `operands`.

    Returns:
        (result, is_label) where:
        - result is a Decimal for numeric operations.
        - result is a str (the winning label) for argmax / argmin.
        - is_label is True only for argmax / argmin.

    Raises:
        CalculatorError: on invalid operand count or division by zero.
    """
    if not operands:
        raise CalculatorError("No operands provided")

    values: list[Decimal] = [op["value"] for op in operands]

    if operation in ("add", "sum"):
        return sum(values, Decimal("0")), False

    if operation == "subtract":
        if len(values) != 2:
            raise CalculatorError("subtract requires exactly 2 operands")
        return values[0] - values[1], False

    if operation == "multiply":
        result = Decimal("1")
        for v in values:
            result *= v
        return result, False

    if operation == "divide":
        if len(values) != 2:
            raise CalculatorError("divide requires exactly 2 operands")
        if values[1] == Decimal("0"):
            raise CalculatorError("Division by zero")
        return values[0] / values[1], False

    if operation == "percent_change":
        # Convention: operands[0] = old value, operands[1] = new value.
        # Result = (new - old) / |old| × 100
        if len(values) != 2:
            raise CalculatorError(
                "percent_change requires exactly 2 operands: old value first, new value second"
            )
        old, new = values[0], values[1]
        if old == Decimal("0"):
            raise CalculatorError(
                "Division by zero: the old value is 0, cannot compute percent change"
            )
        return (new - old) / abs(old) * Decimal("100"), False

    if operation == "percent_of":
        # Convention: operands[0] = part, operands[1] = whole.
        # Result = part / whole × 100
        if len(values) != 2:
            raise CalculatorError(
                "percent_of requires exactly 2 operands: part first, whole second"
            )
        part, whole = values[0], values[1]
        if whole == Decimal("0"):
            raise CalculatorError("Division by zero: the whole value is 0")
        return (part / whole) * Decimal("100"), False

    if operation == "average":
        return sum(values, Decimal("0")) / Decimal(len(values)), False

    if operation == "min":
        return min(values), False

    if operation == "max":
        return max(values), False

    if operation == "argmax":
        best = max(operands, key=lambda op: op["value"])
        return best["label"], True

    if operation == "argmin":
        best = min(operands, key=lambda op: op["value"])
        return best["label"], True

    raise CalculatorError(f"Unknown operation: {operation!r}")


# ---------------------------------------------------------------------------
# Result formatting
# ---------------------------------------------------------------------------

def _format_result(
    result: Decimal,
    operation: str,
    unit: str,
) -> str:
    """Format a Decimal result as a human-readable string.

    - Percentage operations always show two decimal places and a % sign.
    - Other results strip trailing zeros up to four decimal places.
    - If a non-% unit is provided it is appended.
    """
    if operation in ("percent_change", "percent_of") or (unit and unit.strip() == "%"):
        return f"{result:.2f}%"

    # Strip trailing zeros; e.g. "42500.0000" → "42500"
    formatted = f"{result:.4f}".rstrip("0").rstrip(".")

    unit_clean = (unit or "").strip()
    if unit_clean and unit_clean != "%":
        return f"{formatted} {unit_clean}"
    return formatted


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def run_calculations(
    planned: list[dict[str, Any]],
    hits: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Verify operands and compute each planned calculation.

    Args:
        planned: List of calculation dicts from the model's Pass 1 response.
                 Each must have: id, operation, operands (list of
                 {label, value_text, source}), unit.
        hits:    Retrieved source chunks, each with a "source_id" key and
                 a "text" key.

    Returns:
        (verified, rejected) where:
        - verified: list of successfully computed calculation dicts.
        - rejected: list of dicts with id, operation, and reason string.
    """
    # Build source_id → text lookup for verbatim verification.
    source_map: dict[str, str] = {
        hit["source_id"]: hit.get("text", "") for hit in hits
    }

    verified: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []

    for calc in planned:
        calc_id = calc.get("id", "?")
        operation = str(calc.get("operation", ""))
        unit = str(calc.get("unit", ""))
        raw_operands: list[dict[str, Any]] = calc.get("operands", [])

        try:
            if operation not in VALID_OPERATIONS:
                raise CalculatorError(f"Unknown operation: {operation!r}")

            # Parse and verify each operand.
            parsed_operands: list[dict[str, Any]] = []
            for op in raw_operands:
                label = str(op.get("label", ""))
                value_text = str(op.get("value_text", ""))
                source_id = str(op.get("source", ""))
                if source_id.startswith("IMG"):
                    raise CalculatorError(
                        f"Operand {value_text!r} cited chart/image source {source_id!r}. "
                        "Values read from a chart cannot be used in calculations unless "
                        "also verified in a text or table source."
                    )

                if source_id not in source_map:
                    raise CalculatorError(
                        f"Operand source {source_id!r} is not among the retrieved sources."
                    )

                source_text = source_map.get(source_id, "")

                # 1. First check the cited source chunk
                matched_source_id = source_id if is_verbatim(value_text, source_text) else None

                # 2. If not found in cited source, check across all retrieved evidence chunks
                #    (e.g., text summary was cited, but exact row is in the table chunk)
                if matched_source_id is None:
                    for sid, stext in source_map.items():
                        if is_verbatim(value_text, stext):
                            matched_source_id = sid
                            break

                if matched_source_id is None:
                    raise CalculatorError(
                        f"Operand value {value_text!r} was not found verbatim "
                        f"in source {source_id!r} or any other retrieved evidence chunk. "
                        "The model may have misread or hallucinated this value."
                    )

                value = parse_number(value_text)
                parsed_operands.append(
                    {
                        "label": label,
                        "value": value,
                        "value_text": value_text,
                        "source": matched_source_id,
                    }
                )

            # Compute.
            raw_result, is_label = _compute(operation, parsed_operands)

            if is_label:
                # argmax / argmin — result is the winning label string.
                formatted = str(raw_result)
                result_value: float | str = str(raw_result)
            else:
                assert isinstance(raw_result, Decimal)
                formatted = _format_result(raw_result, operation, unit)
                # Convert to float for JSON serialisation (precision is
                # preserved in the formatted string for display).
                result_value = float(raw_result)

            verified.append({
                "id": calc_id,
                "operation": operation,
                "operands": [
                    {
                        "label": op["label"],
                        "value_text": op["value_text"],
                        "source": op["source"],
                    }
                    for op in parsed_operands
                ],
                "result": result_value,
                "formatted": formatted,
                "unit": unit,
            })

        except (CalculatorError, ValueError) as exc:
            rejected.append({
                "id": calc_id,
                "operation": operation,
                "reason": str(exc),
            })

    return verified, rejected


# ---------------------------------------------------------------------------
# Placeholder substitution
# ---------------------------------------------------------------------------

def substitute_placeholders(
    text: str,
    verified_calcs: list[dict[str, Any]],
) -> str:
    """Replace {c1}, {c2}, … in text with the verified formatted values.

    Handles optional whitespace inside brackets (e.g. { c1 }), avoids duplicating
    units when the text already contains the unit (e.g. {c1} USD), and removes
    any accidental duplicate units.

    Example:
        text = "Revenue grew by {c1} from Q1 to Q4."
        verified_calcs = [{"id": "c1", "formatted": "33.89%", ...}]
        → "Revenue grew by 33.89% from Q1 to Q4."
    """
    for calc in verified_calcs:
        cid = str(calc.get("id", "")).strip()
        if not cid:
            continue
        formatted = str(calc.get("formatted", ""))
        unit = str(calc.get("unit", "")).strip()

        # If formatted value already includes unit (e.g. "42500 USD" or "33.89%"),
        # and the text has "{c1} USD" or "{c1}%", replace placeholder + trailing unit
        if unit and unit != "%":
            text = re.sub(
                rf"\{{\s*{re.escape(cid)}\s*\}}\s*{re.escape(unit)}\b",
                formatted,
                text,
            )
        elif unit == "%":
            text = re.sub(
                rf"\{{\s*{re.escape(cid)}\s*\}}\s*%",
                formatted,
                text,
            )

        # General replacement for {\s*cid\s*}
        text = re.sub(
            rf"\{{\s*{re.escape(cid)}\s*\}}",
            formatted,
            text,
        )

    # Clean up any accidental duplicate units like "USD USD" or "% %"
    text = re.sub(r"\bUSD\s+USD\b", "USD", text)
    text = re.sub(r"%\s*%", "%", text)
    return text


# ---------------------------------------------------------------------------
# Unverified number detection
# ---------------------------------------------------------------------------

# Matches "significant" numbers that likely represent data values:
# - thousands-separated: 1,250 or 1,234,567
# - 4+ digit plain integers: 1234
# - decimal numbers: 33.89
# Single/double-digit integers are skipped to avoid flagging things like
# "3 quarters" or "2 methods".
_DATA_NUMBER_RE = re.compile(
    r"(?<!\d)"           # not preceded by a digit
    r"(?:"
    r"\d{1,3}(?:,\d{3})+"   # thousands-separated: 1,250
    r"|\d{4,}"               # 4+ digit integer: 167900
    r"|\d+\.\d+"             # decimal: 33.89
    r")"
    r"(?:%|[KMBkmb])?"       # optional trailing % or magnitude suffix
    r"(?!\d)",               # not followed by a digit
)


def find_unverified_numbers(
    text: str,
    hits: list[dict[str, Any]],
    verified_calcs: list[dict[str, Any]],
) -> list[str]:
    """Find number-like tokens in text that don't appear in any source or calc.

    This is a best-effort check; full verification is Phase 5.
    A number is considered "known" if it appears as a literal substring in any
    source chunk text, or as the formatted result / operand value_text of a
    verified calculation.

    Returns a (possibly empty) list of unverified token strings.
    """
    candidates = _DATA_NUMBER_RE.findall(text)
    if not candidates:
        return []

    # Build the pool of known text.
    known_pool_parts: list[str] = []
    for hit in hits:
        known_pool_parts.append(hit.get("text", ""))
    for calc in verified_calcs:
        fmt = str(calc.get("formatted", ""))
        known_pool_parts.append(fmt)
        known_pool_parts.append(fmt.replace(",", ""))
        res = calc.get("result")
        if isinstance(res, (int, float, Decimal)):
            s = str(res)
            known_pool_parts.append(s)
            try:
                dec = Decimal(s)
                known_pool_parts.append(f"{dec:,.2f}")
                known_pool_parts.append(f"{dec:,.0f}")
                known_pool_parts.append(f"{dec:,f}".rstrip("0").rstrip("."))
            except Exception:
                pass
        for op in calc.get("operands", []):
            known_pool_parts.append(str(op.get("value_text", "")))
    known_pool = " ".join(known_pool_parts)

    unverified: list[str] = []
    for c in candidates:
        if c in known_pool:
            continue
        if c.replace(",", "") in known_pool:
            continue
        unverified.append(c)

    return unverified
