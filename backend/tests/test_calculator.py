"""Phase 4B tests: calculator engine, two-pass orchestration, placeholder substitution.

No model, no database, no network required.

Run with:
    cd backend
    .venv\\Scripts\\python.exe -m pytest tests/test_calculator.py -v
"""

from __future__ import annotations

from decimal import Decimal

import pytest

from app.services.calculator import (
    CalculatorError,
    find_unverified_numbers,
    is_verbatim,
    parse_number,
    run_calculations,
    substitute_placeholders,
)


# ---------------------------------------------------------------------------
# parse_number
# ---------------------------------------------------------------------------

class TestParseNumber:
    def test_thousands_separator(self):
        assert parse_number("1,250") == Decimal("1250")

    def test_large_thousands_separated(self):
        assert parse_number("167,900") == Decimal("167900")

    def test_currency_prefix_millions(self):
        assert parse_number("$1.2M") == Decimal("1200000")

    def test_currency_prefix_plain(self):
        assert parse_number("$500") == Decimal("500")

    def test_trailing_percent_stripped(self):
        # The % is stripped; the numeric value is returned as-is.
        assert parse_number("12.5%") == Decimal("12.5")

    def test_parentheses_as_negative(self):
        assert parse_number("(300)") == Decimal("-300")

    def test_parentheses_with_comma(self):
        assert parse_number("(1,500)") == Decimal("-1500")

    def test_k_suffix(self):
        assert parse_number("500K") == Decimal("500000")

    def test_k_suffix_lowercase(self):
        assert parse_number("2.5k") == Decimal("2500")

    def test_b_suffix(self):
        assert parse_number("1B") == Decimal("1000000000")

    def test_plain_integer(self):
        assert parse_number("42") == Decimal("42")

    def test_plain_decimal(self):
        assert parse_number("3.14") == Decimal("3.14")

    def test_negative_plain(self):
        assert parse_number("-300") == Decimal("-300")

    def test_other_currency_symbols(self):
        assert parse_number("£1,000") == Decimal("1000")
        assert parse_number("€50") == Decimal("50")
        assert parse_number("₹1.5M") == Decimal("1500000")

    def test_garbage_raises(self):
        with pytest.raises(ValueError):
            parse_number("abc")

    def test_empty_raises(self):
        with pytest.raises(ValueError):
            parse_number("")

    def test_alphanumeric_raises(self):
        with pytest.raises(ValueError):
            parse_number("12abc")

    def test_non_string_raises(self):
        with pytest.raises(ValueError):
            parse_number(123)  # type: ignore


# ---------------------------------------------------------------------------
# is_verbatim
# ---------------------------------------------------------------------------

class TestIsVerbatim:
    def test_exact_match(self):
        assert is_verbatim("125,400", "Revenue was 125,400 in Q1.") is True

    def test_no_match(self):
        assert is_verbatim("999", "Revenue was 125,400 in Q1.") is False

    def test_whitespace_normalised(self):
        # Extra spaces in value_text should still match normalised source.
        assert is_verbatim(" 125,400 ", "Revenue was 125,400 in Q1.") is True

    def test_empty_value_returns_false(self):
        assert is_verbatim("", "some text") is False

    def test_empty_source_returns_false(self):
        assert is_verbatim("125,400", "") is False

    def test_currency_stripped_match(self):
        # "$138,750" should match "138,750" even if the dollar sign is only in the label/header
        assert is_verbatim("$138,750", "Q2 2025 | 138,750 | 91,100 | 5,120") is True
        assert is_verbatim("€100", "Cost: 100 EUR") is True


# ---------------------------------------------------------------------------
# Operations (via run_calculations with a fake source map)
# ---------------------------------------------------------------------------

def _calc(calc_id, operation, operands, unit=""):
    """Build a planned-calculation dict as the model would produce it."""
    return {
        "id": calc_id,
        "operation": operation,
        "operands": [
            {"label": op[0], "value_text": op[1], "source": op[2]}
            for op in operands
        ],
        "unit": unit,
    }


def _hit(source_id, text):
    """Build a minimal hit dict."""
    return {"source_id": source_id, "text": text, "filename": "report.pdf",
            "page_number": 1, "section": None, "content_type": "text"}


class TestOperations:
    # ---- add / sum --------------------------------------------------------

    def test_add(self):
        hits = [_hit("S1", "A=10 B=20")]
        verified, rejected = run_calculations(
            [_calc("c1", "add", [("A", "10", "S1"), ("B", "20", "S1")])], hits
        )
        assert rejected == []
        assert verified[0]["result"] == pytest.approx(30.0)

    def test_sum_alias(self):
        hits = [_hit("S1", "10 20 30")]
        verified, rejected = run_calculations(
            [_calc("c1", "sum", [("a", "10", "S1"), ("b", "20", "S1"), ("c", "30", "S1")])],
            hits,
        )
        assert rejected == []
        assert verified[0]["result"] == pytest.approx(60.0)

    # ---- subtract ---------------------------------------------------------

    def test_subtract(self):
        hits = [_hit("S1", "100 40")]
        verified, _ = run_calculations(
            [_calc("c1", "subtract", [("x", "100", "S1"), ("y", "40", "S1")])], hits
        )
        assert verified[0]["result"] == pytest.approx(60.0)

    # ---- multiply ---------------------------------------------------------

    def test_multiply(self):
        hits = [_hit("S1", "5 6")]
        verified, _ = run_calculations(
            [_calc("c1", "multiply", [("a", "5", "S1"), ("b", "6", "S1")])], hits
        )
        assert verified[0]["result"] == pytest.approx(30.0)

    # ---- divide -----------------------------------------------------------

    def test_divide(self):
        hits = [_hit("S1", "100 4")]
        verified, _ = run_calculations(
            [_calc("c1", "divide", [("num", "100", "S1"), ("den", "4", "S1")])], hits
        )
        assert verified[0]["result"] == pytest.approx(25.0)

    def test_division_by_zero_rejected(self):
        hits = [_hit("S1", "100 0")]
        _, rejected = run_calculations(
            [_calc("c1", "divide", [("num", "100", "S1"), ("den", "0", "S1")])], hits
        )
        assert len(rejected) == 1
        assert "zero" in rejected[0]["reason"].lower()

    # ---- percent_change ---------------------------------------------------

    def test_percent_change_q1_to_q4(self):
        """Spec example: 125,400 → 167,900 = 33.89%."""
        hits = [_hit("S1", "Q1 revenue was 125,400. Q4 revenue was 167,900.")]
        verified, rejected = run_calculations(
            [
                _calc(
                    "c1",
                    "percent_change",
                    [
                        ("Q1 revenue", "125,400", "S1"),
                        ("Q4 revenue", "167,900", "S1"),
                    ],
                    unit="%",
                )
            ],
            hits,
        )
        assert rejected == []
        # (167900 - 125400) / 125400 * 100 = 33.89...
        assert verified[0]["result"] == pytest.approx(33.89, abs=0.01)
        assert verified[0]["formatted"] == "33.89%"

    def test_percent_change_division_by_zero_rejected(self):
        hits = [_hit("S1", "old=0 new=50")]
        _, rejected = run_calculations(
            [_calc("c1", "percent_change", [("old", "0", "S1"), ("new", "50", "S1")])], hits
        )
        assert len(rejected) == 1

    # ---- percent_of -------------------------------------------------------

    def test_percent_of(self):
        hits = [_hit("S1", "25 200")]
        verified, _ = run_calculations(
            [_calc("c1", "percent_of", [("part", "25", "S1"), ("whole", "200", "S1")])], hits
        )
        assert verified[0]["result"] == pytest.approx(12.5)
        assert "%" in verified[0]["formatted"]

    # ---- average ----------------------------------------------------------

    def test_average(self):
        hits = [_hit("S1", "10 20 30")]
        verified, _ = run_calculations(
            [_calc("c1", "average", [("a", "10", "S1"), ("b", "20", "S1"), ("c", "30", "S1")])],
            hits,
        )
        assert verified[0]["result"] == pytest.approx(20.0)

    # ---- min / max --------------------------------------------------------

    def test_min(self):
        hits = [_hit("S1", "10 50 30")]
        verified, _ = run_calculations(
            [_calc("c1", "min", [("a", "10", "S1"), ("b", "50", "S1"), ("c", "30", "S1")])],
            hits,
        )
        assert verified[0]["result"] == pytest.approx(10.0)

    def test_max(self):
        hits = [_hit("S1", "10 50 30")]
        verified, _ = run_calculations(
            [_calc("c1", "max", [("a", "10", "S1"), ("b", "50", "S1"), ("c", "30", "S1")])],
            hits,
        )
        assert verified[0]["result"] == pytest.approx(50.0)

    # ---- argmax / argmin --------------------------------------------------

    def test_argmax_returns_label(self):
        hits = [_hit("S1", "Alice=80 Bob=95 Carol=70")]
        verified, _ = run_calculations(
            [
                _calc(
                    "c1",
                    "argmax",
                    [
                        ("Alice", "80", "S1"),
                        ("Bob", "95", "S1"),
                        ("Carol", "70", "S1"),
                    ],
                )
            ],
            hits,
        )
        assert verified[0]["result"] == "Bob"
        assert verified[0]["formatted"] == "Bob"

    def test_argmin_returns_label(self):
        hits = [_hit("S1", "Alice=80 Bob=95 Carol=70")]
        verified, _ = run_calculations(
            [
                _calc(
                    "c1",
                    "argmin",
                    [
                        ("Alice", "80", "S1"),
                        ("Bob", "95", "S1"),
                        ("Carol", "70", "S1"),
                    ],
                )
            ],
            hits,
        )
        assert verified[0]["result"] == "Carol"


# ---------------------------------------------------------------------------
# Operand verification
# ---------------------------------------------------------------------------

class TestOperandVerification:
    def test_operand_not_in_source_is_rejected(self):
        """value_text does not appear in the cited source → rejected."""
        hits = [_hit("S1", "Revenue was 50,000 in Q1.")]
        _, rejected = run_calculations(
            [
                _calc(
                    "c1",
                    "add",
                    [
                        # 125,400 is NOT in S1's text.
                        ("Q1", "125,400", "S1"),
                        ("Q2", "50,000", "S1"),
                    ],
                )
            ],
            hits,
        )
        assert len(rejected) == 1
        assert "125,400" in rejected[0]["reason"]

    def test_valid_operands_are_verified(self):
        hits = [_hit("S1", "Q1 revenue: 125,400. Q4 revenue: 167,900.")]
        verified, rejected = run_calculations(
            [
                _calc(
                    "c1",
                    "percent_change",
                    [
                        ("Q1 revenue", "125,400", "S1"),
                        ("Q4 revenue", "167,900", "S1"),
                    ],
                    unit="%",
                )
            ],
            hits,
        )
        assert rejected == []
        assert len(verified) == 1

    def test_operand_from_missing_source_id_is_rejected(self):
        """Source ID that doesn't exist in hits → source_text="" → verbatim check fails."""
        hits = [_hit("S1", "125,400")]
        _, rejected = run_calculations(
            [_calc("c1", "add", [("a", "125,400", "S99")])],  # S99 doesn't exist
            hits,
        )
        assert len(rejected) == 1

    def test_multiple_calcs_partial_rejection(self):
        """One calculation passes, one fails — both handled independently."""
        hits = [_hit("S1", "10 20")]
        planned = [
            _calc("c1", "add", [("a", "10", "S1"), ("b", "20", "S1")]),
            _calc("c2", "add", [("a", "999", "S1"), ("b", "20", "S1")]),  # 999 not in source
        ]
        verified, rejected = run_calculations(planned, hits)
        assert len(verified) == 1
        assert verified[0]["id"] == "c1"
        assert len(rejected) == 1
        assert rejected[0]["id"] == "c2"

    def test_operand_found_in_alternative_source_chunk(self):
        """If model cites S1 for an operand that is actually in table chunk S3,
        cross-chunk verification should find it in S3 and succeed."""
        hits = [
            _hit("S1", "Quarterly Financial Overview 2025. See table below for details."),
            _hit("S3", "Quarter | Revenue | Operating Cost\nQ4 2025 | 167,900 | 108,400"),
        ]
        planned = [
            _calc(
                "c1",
                "subtract",
                [("Q4 Revenue", "167,900", "S1"), ("Q4 Cost", "108,400", "S1")],
                unit="USD",
            )
        ]
        verified, rejected = run_calculations(planned, hits)
        assert rejected == []
        assert len(verified) == 1
        assert verified[0]["result"] == pytest.approx(59500.0)
        assert verified[0]["operands"][0]["source"] == "S3"
        assert verified[0]["operands"][1]["source"] == "S3"


# ---------------------------------------------------------------------------
# Placeholder substitution
# ---------------------------------------------------------------------------

class TestPlaceholderSubstitution:
    def test_single_placeholder_replaced(self):
        calcs = [{"id": "c1", "formatted": "33.89%"}]
        text = "Revenue grew by {c1} from Q1 to Q4."
        assert substitute_placeholders(text, calcs) == "Revenue grew by 33.89% from Q1 to Q4."

    def test_multiple_placeholders_replaced(self):
        calcs = [
            {"id": "c1", "formatted": "33.89%"},
            {"id": "c2", "formatted": "42,500"},
        ]
        text = "The increase was {c2} ({c1})."
        result = substitute_placeholders(text, calcs)
        assert result == "The increase was 42,500 (33.89%)."

    def test_unknown_placeholder_left_unchanged(self):
        calcs = [{"id": "c1", "formatted": "33.89%"}]
        text = "Value is {c1} and also {c2}."
        # {c2} has no matching calc — left as-is.
        assert substitute_placeholders(text, calcs) == "Value is 33.89% and also {c2}."

    def test_no_placeholders_unchanged(self):
        calcs = [{"id": "c1", "formatted": "33.89%"}]
        text = "Revenue grew significantly."
        assert substitute_placeholders(text, calcs) == text

    def test_placeholder_handles_spaces_and_prevents_duplicate_units(self):
        calcs = [
            {"id": "c1", "formatted": "42500 USD", "unit": "USD"},
            {"id": "c2", "formatted": "33.89%", "unit": "%"},
        ]
        text = "Difference was {c1} USD and change was { c2 } %."
        result = substitute_placeholders(text, calcs)
        # Must not have "42500 USD USD" or "33.89% %"
        assert result == "Difference was 42500 USD and change was 33.89%."

    def test_placeholder_cleans_accidental_duplicate_currency_words(self):
        calcs = [{"id": "c1", "formatted": "59500 USD", "unit": "USD"}]
        text = "The difference was {c1} USD."
        assert substitute_placeholders(text, calcs) == "The difference was 59500 USD."


# ---------------------------------------------------------------------------
# Unverified number detection
# ---------------------------------------------------------------------------

class TestUnverifiedNumbers:
    def test_number_in_source_is_not_flagged(self):
        hits = [_hit("S1", "Revenue was 125,400 in Q1.")]
        calcs: list = []
        result = find_unverified_numbers("Revenue was 125,400 in Q1.", hits, calcs)
        assert result == []

    def test_model_written_number_is_flagged(self):
        """A number that neither appears in any source nor is a calc result
        should be flagged as unverified."""
        hits = [_hit("S1", "Revenue was 125,400 in Q1.")]
        calcs: list = []
        # 99999 is not in any source or calc.
        result = find_unverified_numbers("Revenue was 99999 in Q2.", hits, calcs)
        assert "99999" in result

    def test_calc_formatted_result_is_not_flagged(self):
        hits = [_hit("S1", "Q1=125,400 Q4=167,900")]
        calcs = [{"id": "c1", "formatted": "33.89%", "operands": [
            {"value_text": "125,400"}, {"value_text": "167,900"}
        ]}]
        # "33.89" appears as formatted result → should not be flagged.
        result = find_unverified_numbers("Revenue grew by 33.89%.", hits, calcs)
        assert result == []

    def test_small_numbers_not_flagged(self):
        """Single and double-digit numbers are too common to flag (page refs, etc.)."""
        hits = [_hit("S1", "only one section")]
        calcs: list = []
        result = find_unverified_numbers("There are 3 items on page 12.", hits, calcs)
        assert result == []

    def test_empty_answer_returns_empty(self):
        assert find_unverified_numbers("", [_hit("S1", "x")], []) == []
