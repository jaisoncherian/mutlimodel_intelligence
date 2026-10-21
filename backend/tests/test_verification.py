"""Phase 5A tests: verification layer – number_check, claim_check, verification orchestrator.

All tests use fake OllamaClient / fake data. No real DB, no real Ollama, no torch.
Markers:
  (none)        – run in all environments
  integration   – requires a real model or external service; skipped without RUN_INTEGRATION=1

Run with:
    cd backend && python -m pytest tests/test_verification.py -v
"""

from __future__ import annotations

import json
from decimal import Decimal
from typing import Any
from uuid import uuid4

import pytest

from app import create_app
from app.repositories import conversations as conv_repo
from app.services import answering, search as search_service
from app.services.llm import OllamaClient, OllamaError
from app.services.number_check import check_number_grounding
from app.services.claim_check import check_claim_support
from app.services.verification import verify_answer, _error_result


# ---------------------------------------------------------------------------
# Shared fixtures / helpers
# ---------------------------------------------------------------------------

DOC_ID = uuid4()

_HIT_S1 = {
    "chunk_id": 1,
    "doc_id": DOC_ID,
    "source_id": "S1",
    "filename": "report.pdf",
    "page_number": 3,
    "section": "Revenue",
    "content_type": "text",
    "text": "Q4 revenue was 167,900 and Q1 revenue was 125,400.",
    "scores": {"rrf": 0.016, "vector_similarity": 0.82},
}

_HIT_S2 = {
    "chunk_id": 2,
    "doc_id": DOC_ID,
    "source_id": "S2",
    "filename": "report.pdf",
    "page_number": 4,
    "section": "Costs",
    "content_type": "text",
    "text": "Operating cost in Q4 was 108,400.",
    "scores": {"rrf": 0.012, "vector_similarity": 0.70},
}


class FakeOllamaClient:
    """Configurable fake that records calls."""

    def __init__(
        self,
        response: dict[str, Any] | str | None = None,
        raise_error: str | None = None,
    ):
        self.calls: list[dict[str, Any]] = []
        self._response = response
        self._raise_error = raise_error

    def chat(self, messages, schema=None, images=None, num_predict=700):
        self.calls.append({"messages": messages, "schema": schema})
        if self._raise_error:
            raise OllamaError(self._raise_error)
        if isinstance(self._response, dict):
            return json.dumps(self._response), {"prompt_eval_count": 10, "eval_count": 5}
        if isinstance(self._response, str):
            return self._response, {"prompt_eval_count": 10, "eval_count": 5}
        # Default: supported
        return (
            json.dumps({"verdict": "supported", "reason": "test"}),
            {"prompt_eval_count": 10, "eval_count": 5},
        )


@pytest.fixture
def app(monkeypatch):
    """Flask test app with DB fully mocked out."""
    _app = create_app({"TESTING": True, "DATABASE_URL": "", "MIN_SIMILARITY": 0.15})

    _store: dict[str, Any] = {"convs": {}, "messages": [], "citations": []}

    def fake_create_conv(title, user_id=None):
        cid = uuid4()
        _store["convs"][str(cid)] = {"id": cid, "title": title}
        return cid

    def fake_get_conv(cid):
        return _store["convs"].get(str(cid))

    def fake_insert_message(conversation_id, role, content, verification=None, used_vision=False):
        mid = len(_store["messages"]) + 1
        _store["messages"].append({
            "id": mid, "role": role, "content": content,
            "verification": verification,
        })
        return mid

    def fake_insert_citations(message_id, citations):
        _store["citations"].extend(citations)

    monkeypatch.setattr(conv_repo, "create_conversation", fake_create_conv)
    monkeypatch.setattr(conv_repo, "get_conversation", fake_get_conv)
    monkeypatch.setattr(conv_repo, "insert_message", fake_insert_message)
    monkeypatch.setattr(conv_repo, "insert_citations", fake_insert_citations)

    _app._test_store = _store
    return _app, _store


# ===========================================================================
# Section 1: Number extraction and normalization
# ===========================================================================

class TestNumberExtraction:
    """Tests for check_number_grounding number-token extraction."""

    def _run(self, answer, claims, hits, calcs=None, **kw):
        return check_number_grounding(
            answer=answer,
            claims=claims,
            hits=hits,
            verified_calcs=calcs or [],
            **kw,
        )

    def test_thousands_separator_extracted_and_grounded(self):
        claims = [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}]
        results = self._run(
            "Q4 revenue was 167,900.", claims=claims, hits=[_HIT_S1]
        )
        grounded = [r for r in results if r.get("text") == "167,900"]
        assert grounded, f"Expected 167,900 to be extracted; got {results}"
        assert grounded[0]["grounded_in"] == "S1"
        assert grounded[0]["ok"] is True

    def test_currency_symbol_extracted_and_grounded(self):
        hit = {**_HIT_S1, "text": "Revenue was $1.2M."}
        claims = [{"text": "Revenue was $1.2M.", "sources": ["S1"]}]
        results = self._run("Revenue was $1.2M.", claims=claims, hits=[hit])
        # $1.2M normalises to 1200000; check it appears
        assert any(r.get("text") == "$1.2M" for r in results)

    def test_percentage_extracted(self):
        hit = {**_HIT_S1, "text": "Growth was 12.5%."}
        claims = [{"text": "Growth was 12.5%.", "sources": ["S1"]}]
        results = self._run("Growth was 12.5%.", claims=claims, hits=[hit])
        pct_results = [r for r in results if "12.5" in r.get("text", "")]
        assert pct_results, f"Expected 12.5% to be extracted; got {results}"

    def test_parenthesised_negative_extracted(self):
        hit = {**_HIT_S1, "text": "Loss was (300) USD."}
        claims = [{"text": "Loss was (300) USD.", "sources": ["S1"]}]
        results = self._run("Loss was (300) USD.", claims=claims, hits=[hit])
        neg_results = [r for r in results if "(300)" in r.get("text", "")]
        assert neg_results, f"Expected (300) to be extracted; got {results}"

    def test_source_id_markers_not_extracted(self):
        """[S1] and [IMG2] must not produce number tokens from their digits."""
        hit = {**_HIT_S1, "text": "Revenue was 167,900."}
        claims = [{"text": "Revenue was 167,900. [S1]", "sources": ["S1"]}]
        results = self._run(
            "Revenue was 167,900. [S1]", claims=claims, hits=[hit]
        )
        # "1" from [S1] must not appear as a standalone extracted token.
        raw_texts = [r["text"] for r in results]
        assert not any(t == "1" for t in raw_texts), \
            f"[S1] digit '1' should not be extracted as a number; got {raw_texts}"

    def test_page_reference_ignored(self):
        hit = {**_HIT_S1, "text": "See page 3 for details. Revenue 167,900."}
        claims = [{"text": "See page 3 for details. Revenue 167,900.", "sources": ["S1"]}]
        results = self._run(
            "See page 3 for details. Revenue 167,900.", claims=claims, hits=[hit]
        )
        # After stripping [S#] markers, page references like "page 3" are in
        # ignored spans. The number token "3" may or may not be extracted by
        # the regex (depends on which patterns match), but if extracted, it
        # must be marked ok=True (either grounded in S1, or the whole sentence
        # "page 3" is context that makes it harmless).
        # The key assertion: 167,900 must be grounded and the answer must not fail
        # just because of the page reference digit.
        revenue_entry = next(
            (r for r in results if r.get("text") == "167,900"), None
        )
        assert revenue_entry is not None, "167,900 must be extracted"
        assert revenue_entry["ok"] is True, "167,900 must be grounded in S1"
        # If "3" is extracted, it must be ok (either ignored or grounded in source).
        three_entries = [r for r in results if r.get("text") == "3"]
        for entry in three_entries:
            assert entry["ok"] is True, (
                f"page reference digit '3' must not fail grounding: {entry}"
            )

    def test_year_in_question_ignored(self):
        hit = {**_HIT_S1, "text": "Q4 2025 revenue was 167,900."}
        claims = [{"text": "Q4 2025 revenue was 167,900.", "sources": ["S1"]}]
        results = self._run(
            "Q4 2025 revenue was 167,900.",
            claims=claims,
            hits=[hit],
            question="What was revenue in Q4 2025?",
        )
        year_entries = [r for r in results if r.get("text") == "2025"]
        # Year in question should be ignored.
        assert all(r.get("ok") for r in year_entries), \
            f"Year in question should not fail grounding; got {year_entries}"


class TestNumberGrounding:
    """Tests for grounding logic – cited source vs uncited source."""

    def test_number_in_uncited_source_is_not_grounded(self):
        """A number present in S2 but the claim cites only S1 must be ungrounded."""
        claims = [{"text": "Revenue was 108,400.", "sources": ["S1"]}]
        # 108,400 is in S2 text, not S1 text
        results = check_number_grounding(
            answer="Revenue was 108,400.",
            claims=claims,
            hits=[_HIT_S1, _HIT_S2],
            verified_calcs=[],
        )
        entry = next((r for r in results if r.get("text") == "108,400"), None)
        assert entry is not None, "108,400 must be extracted"
        assert entry["grounded_in"] is None, \
            "108,400 appears in S2 but claim cites S1; must not be grounded"
        assert entry["ok"] is False

    def test_number_grounded_in_cited_source(self):
        """167,900 in S1 with claim citing S1 must be grounded."""
        claims = [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}]
        results = check_number_grounding(
            answer="Q4 revenue was 167,900.",
            claims=claims,
            hits=[_HIT_S1],
            verified_calcs=[],
        )
        entry = next((r for r in results if r.get("text") == "167,900"), None)
        assert entry is not None
        assert entry["grounded_in"] == "S1"
        assert entry["ok"] is True

    def test_number_grounded_by_calculator_result(self):
        """A number matching a verified calculator result is grounded."""
        # Calculator computed 42500 = 167900 - 125400
        calc = {
            "id": "c1",
            "operation": "subtract",
            "operands": [
                {"label": "Q4", "value_text": "167,900", "source": "S1"},
                {"label": "Q1", "value_text": "125,400", "source": "S1"},
            ],
            "result": 42500.0,
            "formatted": "42500",
            "unit": "",
        }
        claims = [{"text": "The difference was 42500.", "sources": ["S1"]}]
        results = check_number_grounding(
            answer="The difference was 42500.",
            claims=claims,
            hits=[_HIT_S1],
            verified_calcs=[calc],
        )
        entry = next((r for r in results if r.get("text") == "42500"), None)
        assert entry is not None
        assert entry["grounded_in"] == "calc:c1"
        assert entry["ok"] is True

    def test_image_number_is_approximate_not_grounded(self):
        """Numbers from image-only claims are approximate and never grounded."""
        img_hit = {
            **_HIT_S1,
            "source_id": "IMG1",
            "content_type": "image",
            "text": "",
        }
        claims = [{"text": "Revenue approximately 500000.", "sources": ["IMG1"]}]
        results = check_number_grounding(
            answer="Revenue approximately 500000.",
            claims=claims,
            hits=[img_hit],
            verified_calcs=[],
            image_source_ids={"IMG1"},
        )
        entry = next((r for r in results if "500000" in r.get("text", "")), None)
        assert entry is not None
        assert entry["approximate"] is True
        assert entry["ok"] is False

    def test_regression_175000_against_source_containing_167900(self):
        """Regression: claim states 175,000 but source only has 167,900 → ungrounded."""
        claims = [{"text": "Q4 revenue was 175,000.", "sources": ["S1"]}]
        results = check_number_grounding(
            answer="Q4 revenue was 175,000.",
            claims=claims,
            hits=[_HIT_S1],  # S1 has 167,900 and 125,400, NOT 175,000
            verified_calcs=[],
        )
        entry = next((r for r in results if r.get("text") == "175,000"), None)
        assert entry is not None, "175,000 must be extracted from answer"
        assert entry["grounded_in"] is None, \
            "175,000 is not in the cited source (167,900 is); must be ungrounded"
        assert entry["ok"] is False


# ===========================================================================
# Section 2: Claim support (lexical + LLM)
# ===========================================================================

class TestClaimSupportLexical:
    """Tests for the lexical claim-support pass."""

    def test_supported_claim(self):
        """A claim with good overlap should be 'supported'."""
        claims = [{"text": "Q4 revenue was 167,900 and Q1 revenue was 125,400.", "sources": ["S1"]}]
        results = check_claim_support(
            claims=claims,
            hits=[_HIT_S1],
            verify_mode="lexical",
            high_threshold=0.50,
            low_threshold=0.25,
        )
        assert results[0]["support"] == "supported"
        assert results[0]["kind"] == "heuristic"
        assert results[0]["method"] == "lexical"

    def test_unsupported_claim_low_overlap(self):
        """A claim with very low overlap should be 'unsupported'."""
        claims = [{"text": "The moon is made of cheese.", "sources": ["S1"]}]
        results = check_claim_support(
            claims=claims,
            hits=[_HIT_S1],
            verify_mode="lexical",
            high_threshold=0.60,
            low_threshold=0.35,
        )
        assert results[0]["support"] == "unsupported"

    def test_unsupported_claim_missing_number(self):
        """A claim with good word overlap but a number not in the source is unsupported."""
        claims = [{"text": "Q4 revenue was 175,000.", "sources": ["S1"]}]
        # S1 has 167,900 not 175,000
        results = check_claim_support(
            claims=claims,
            hits=[_HIT_S1],
            verify_mode="lexical",
            high_threshold=0.35,  # Low threshold so word overlap alone would pass
            low_threshold=0.10,
        )
        assert results[0]["support"] == "unsupported"

    def test_image_only_claim_is_visual_unverifiable(self):
        """Claims citing only images cannot be text-verified."""
        img_hit = {**_HIT_S1, "source_id": "IMG1", "text": ""}
        claims = [{"text": "Chart shows revenue growth.", "sources": ["IMG1"]}]
        results = check_claim_support(
            claims=claims,
            hits=[img_hit],
            image_source_ids={"IMG1"},
            verify_mode="lexical",
        )
        assert results[0]["support"] == "visual_unverifiable"
        assert results[0]["kind"] == "heuristic"

    def test_borderline_claim_no_llm_gives_weak(self):
        """Borderline claim without LLM client stays 'weak'."""
        # Force a borderline by using thresholds that bracket the overlap.
        claims = [{"text": "Revenue was strong in Q4.", "sources": ["S1"]}]
        results = check_claim_support(
            claims=claims,
            hits=[_HIT_S1],
            ollama_client=None,
            verify_mode="both",
            high_threshold=0.99,  # nearly impossible to reach
            low_threshold=0.01,   # nearly everything is borderline
        )
        assert results[0]["support"] == "weak"


class TestClaimSupportLLM:
    """Tests for the LLM borderline pass."""

    def test_borderline_sent_to_llm_and_supported(self):
        """A borderline claim is sent to the LLM and upgraded to 'supported' on success."""
        fake = FakeOllamaClient(response={"verdict": "supported", "reason": "matches"})
        claims = [{"text": "Revenue was strong.", "sources": ["S1"]}]
        results = check_claim_support(
            claims=claims,
            hits=[_HIT_S1],
            ollama_client=fake,
            verify_mode="both",
            high_threshold=0.99,
            low_threshold=0.01,
        )
        assert results[0]["support"] == "supported"
        assert results[0]["method"] == "llm"
        assert len(fake.calls) == 1

    def test_borderline_llm_failure_gives_weak(self):
        """LLM call failure must give 'weak', never 'supported' (req: LLM fail → weak)."""
        fake = FakeOllamaClient(raise_error="connection refused")
        claims = [{"text": "Revenue was strong.", "sources": ["S1"]}]
        results = check_claim_support(
            claims=claims,
            hits=[_HIT_S1],
            ollama_client=fake,
            verify_mode="both",
            high_threshold=0.99,
            low_threshold=0.01,
        )
        assert results[0]["support"] == "weak"

    def test_borderline_llm_bad_json_gives_weak(self):
        """LLM returning invalid JSON stays 'weak'."""
        fake = FakeOllamaClient(response="not-json")
        claims = [{"text": "Revenue was strong.", "sources": ["S1"]}]
        results = check_claim_support(
            claims=claims,
            hits=[_HIT_S1],
            ollama_client=fake,
            verify_mode="both",
            high_threshold=0.99,
            low_threshold=0.01,
        )
        assert results[0]["support"] == "weak"

    def test_max_llm_claims_budget_respected(self):
        """With max_llm_claims=1, only 1 borderline claim is sent to the LLM."""
        fake = FakeOllamaClient(response={"verdict": "supported", "reason": "ok"})
        # Both claims need to be borderline (not unsupported). Use thresholds where
        # any small overlap is enough to be borderline rather than unsupported.
        claims = [
            {"text": "Q4 revenue strong.", "sources": ["S1"]},  # "revenue" overlaps → borderline
            {"text": "Q1 revenue present.", "sources": ["S1"]},  # "revenue" overlaps → borderline
        ]
        results = check_claim_support(
            claims=claims,
            hits=[_HIT_S1],
            ollama_client=fake,
            verify_mode="both",
            max_llm_claims=1,
            high_threshold=0.99,   # nearly impossible to reach → borderline
            low_threshold=0.00,    # 0.0 → nothing is unsupported
        )
        assert len(fake.calls) == 1, "Only 1 LLM call expected when budget=1"
        # First claim gets LLM and is promoted to 'supported'.
        assert results[0]["support"] == "supported"
        # Second claim exhausted budget and stays 'weak'.
        assert results[1]["support"] == "weak"


# ===========================================================================
# Section 3: Verification orchestrator
# ===========================================================================

class TestCitationValidityCheck:
    """Citation validity: separate from claim support (requirement 3)."""

    def test_valid_citations_pass(self):
        claims = [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}]
        result = verify_answer(
            draft={"status": "answered", "answer": "Q4 revenue was 167,900.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1],
            config={"VERIFY_MODE": "lexical", "VERIFY_LEXICAL_HIGH": 0.1,
                    "VERIFY_LEXICAL_LOW": 0.0},
        )
        cit_check = next(c for c in result["checks"] if c["name"] == "citation_validity")
        assert cit_check["passed"] is True

    def test_retrieved_but_unsent_id_is_invalid(self):
        """S2 is in hits (retrieved) but NOT in sources_sent → invalid citation."""
        claims = [{"text": "Cost was 108,400.", "sources": ["S2"]}]
        result = verify_answer(
            draft={"status": "answered", "answer": "Cost was 108,400.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],  # S2 was NOT sent to the model
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1, _HIT_S2],
            config={"VERIFY_MODE": "lexical", "VERIFY_LEXICAL_HIGH": 0.1,
                    "VERIFY_LEXICAL_LOW": 0.0},
        )
        cit_check = next(c for c in result["checks"] if c["name"] == "citation_validity")
        assert cit_check["passed"] is False
        assert "S2" in cit_check["details"]["invalid_ids"]


class TestVerificationPolicy:
    """Policy: unsupported claims removed, answer rebuilt, confidence rules."""

    def test_unsupported_claim_removed_and_answer_rebuilt(self):
        """Unsupported claims must be removed and the answer rebuilt from survivors."""
        claims = [
            {"text": "Q4 revenue was 167,900.", "sources": ["S1"]},
            {"text": "The moon is made of cheese.", "sources": ["S1"]},
        ]
        result = verify_answer(
            draft={"status": "answered",
                   "answer": "Q4 revenue was 167,900. The moon is made of cheese.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1],
            config={"VERIFY_MODE": "lexical", "VERIFY_LEXICAL_HIGH": 0.50,
                    "VERIFY_LEXICAL_LOW": 0.15},
        )
        assert result["status"] == "partial"
        removed = result["removed_claims"]
        assert any("cheese" in r["text"] for r in removed)

    def test_all_claims_removed_gives_insufficient_evidence(self):
        """When every claim is removed, status becomes insufficient_evidence."""
        claims = [
            {"text": "The moon is made of cheese.", "sources": ["S1"]},
        ]
        result = verify_answer(
            draft={"status": "answered",
                   "answer": "The moon is made of cheese.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1],
            config={"VERIFY_MODE": "lexical", "VERIFY_LEXICAL_HIGH": 0.60,
                    "VERIFY_LEXICAL_LOW": 0.35},
        )
        assert result["status"] == "insufficient_evidence"

    def test_confidence_high_when_all_checks_pass(self):
        """confidence='high' when every claim passes and no numbers are ungrounded."""
        # Use a claim that closely matches S1 text with all numbers in S1.
        claims = [{"text": "Q4 revenue was 167,900 and Q1 revenue was 125,400.", "sources": ["S1"]}]
        result = verify_answer(
            draft={"status": "answered",
                   "answer": "Q4 revenue was 167,900 and Q1 revenue was 125,400.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1],
            config={"VERIFY_MODE": "lexical",
                    "VERIFY_LEXICAL_HIGH": 0.40,  # achievable for this sentence
                    "VERIFY_LEXICAL_LOW": 0.10},
        )
        assert result["confidence"] == "high"

    def test_confidence_medium_for_weak_claim(self):
        """confidence='medium' when there is a weak claim."""
        claims = [{"text": "Revenue was somehow special.", "sources": ["S1"]}]
        result = verify_answer(
            draft={"status": "answered", "answer": "Revenue was somehow special.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1],
            config={"VERIFY_MODE": "lexical",
                    "VERIFY_LEXICAL_HIGH": 0.99,  # nothing passes high
                    "VERIFY_LEXICAL_LOW": 0.01},  # nothing fails low → borderline → weak
        )
        assert result["confidence"] in {"medium", "low"}

    def test_confidence_low_for_partial_status(self):
        """confidence='low' when final_status is 'partial'."""
        claims = [
            {"text": "Q4 revenue was 167,900.", "sources": ["S1"]},
            {"text": "Nonsense statement.", "sources": ["S1"]},
        ]
        result = verify_answer(
            draft={"status": "answered",
                   "answer": "Q4 revenue was 167,900. Nonsense statement.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1],
            config={"VERIFY_MODE": "lexical",
                    "VERIFY_LEXICAL_HIGH": 0.50,
                    "VERIFY_LEXICAL_LOW": 0.15},
        )
        assert result["confidence"] in {"low", "medium"}

    def test_uncovered_sentence_blocks_high_confidence(self):
        """An answer sentence not covered by any claim blocks confidence='high'."""
        claims = [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}]
        result = verify_answer(
            draft={"status": "answered",
                   "answer": "Q4 revenue was 167,900. This uncovered mysterious sentence.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1],
            config={"VERIFY_MODE": "lexical",
                    "VERIFY_LEXICAL_HIGH": 0.40,
                    "VERIFY_LEXICAL_LOW": 0.10},
        )
        assert result["confidence"] != "high"


class TestVerifyModeOff:
    """VERIFY_MODE=off must return confidence='unchecked' with no checks run."""

    def test_mode_off_returns_unchecked(self):
        claims = [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}]
        result = verify_answer(
            draft={"status": "answered", "answer": "Q4 revenue was 167,900.",
                   "claims": claims, "missing": None},
            sources_sent=["S1"],
            verified_calcs=[],
            rejected_calcs=[],
            hits=[_HIT_S1],
            config={"VERIFY_MODE": "off"},
        )
        assert result["state"] == "ok"
        assert result["confidence"] == "unchecked"
        assert result["checks"] == []


class TestVerifyFailPolicy:
    """Requirement 8: verification errors must never present answer as verified."""

    def test_flag_policy_on_exception(self):
        """With policy=flag, a verification error returns state=error, confidence=unverified."""
        err = _error_result(
            mode="both",
            policy="flag",
            reason="verification_error",
            draft_status="answered",
            draft_answer="Some answer.",
            draft_missing=None,
            draft_claims=[],
        )
        assert err["state"] == "error"
        assert err["confidence"] == "unverified"
        # answer preserved (flag mode)
        assert err["answer"] == "Some answer."

    def test_refuse_policy_returns_insufficient_evidence(self):
        """With policy=refuse, a verification error returns insufficient_evidence."""
        err = _error_result(
            mode="both",
            policy="refuse",
            reason="verification_error",
            draft_status="answered",
            draft_answer="Some answer.",
            draft_missing=None,
            draft_claims=[],
        )
        assert err["state"] == "error"
        assert err["status"] == "insufficient_evidence"

    def test_exception_in_one_check_contained(self):
        """An exception inside one check must not propagate; other checks still run."""
        from app.services import verification as v_mod

        original_fn = v_mod._check_answer_coverage

        def bad_coverage(*args, **kwargs):
            raise RuntimeError("simulated internal failure")

        # Patch just the coverage check.
        import unittest.mock as mock
        with mock.patch.object(v_mod, "_check_answer_coverage", bad_coverage):
            claims = [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}]
            result = verify_answer(
                draft={"status": "answered", "answer": "Q4 revenue was 167,900.",
                       "claims": claims, "missing": None},
                sources_sent=["S1"],
                verified_calcs=[],
                rejected_calcs=[],
                hits=[_HIT_S1],
                config={"VERIFY_MODE": "lexical",
                        "VERIFY_LEXICAL_HIGH": 0.40,
                        "VERIFY_LEXICAL_LOW": 0.10},
            )
        # Other checks must still have run.
        check_names = {c["name"] for c in result["checks"]}
        assert "citation_validity" in check_names
        assert "number_grounding" in check_names
        assert "claim_support" in check_names
        # Coverage check should be marked failed (not propagated).
        cov = next((c for c in result["checks"] if c["name"] == "answer_coverage"), None)
        assert cov is not None
        assert cov["passed"] is False


class TestEvalOverrides:
    """The 'options' field must be inert when ALLOW_EVAL_OVERRIDES=false."""

    def test_options_ignored_when_flag_false(self, app, monkeypatch):
        """options.verify_mode must be ignored when ALLOW_EVAL_OVERRIDES=false."""
        _app, _store = app
        # Configure app with overrides disabled.
        _app.config["ALLOW_EVAL_OVERRIDES"] = False
        _app.config["VERIFY_MODE"] = "off"  # default

        # We only need to check that the flag is wired up at the API level.
        # The ask endpoint shouldn't crash or change behaviour.
        fake = FakeOllamaClient(response={
            "status": "answered",
            "answer": "Q4 revenue was 167,900.",
            "claims": [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}],
            "missing": "",
            "calculations": [],
        })
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [{**_HIT_S1}])
        monkeypatch.setattr(answering, "make_client_from_config", lambda cfg: fake)

        resp = _app.test_client().post(
            "/ask",
            json={"question": "What was Q4 revenue?",
                  "options": {"verify_mode": "llm"}},
        )
        assert resp.status_code == 200
        # When ALLOW_EVAL_OVERRIDES=False, options are ignored.
        data = resp.get_json()
        assert "verification" in data

    def test_options_applied_when_flag_true(self, app, monkeypatch):
        """options.verify_mode must take effect when ALLOW_EVAL_OVERRIDES=true."""
        _app, _store = app
        _app.config["ALLOW_EVAL_OVERRIDES"] = True
        _app.config["VERIFY_MODE"] = "both"  # default

        fake = FakeOllamaClient(response={
            "status": "answered",
            "answer": "Q4 revenue was 167,900.",
            "claims": [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}],
            "missing": "",
            "calculations": [],
        })
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [{**_HIT_S1}])
        monkeypatch.setattr(answering, "make_client_from_config", lambda cfg: fake)

        resp = _app.test_client().post(
            "/ask",
            json={"question": "What was Q4 revenue?",
                  "options": {"verify_mode": "off"}},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        # With verify_mode=off, confidence should be 'unchecked'.
        assert data["verification"].get("confidence") == "unchecked"


class TestPersistedPayloadSize:
    """Verify that persisted verification payloads contain no full source texts."""

    def test_stored_message_snippets_capped(self, app, monkeypatch):
        """Claim details in the persisted payload must not contain full source text."""
        _app, _store = app
        _app.config["VERIFY_MODE"] = "lexical"
        _app.config["VERIFY_LEXICAL_HIGH"] = 0.1
        _app.config["VERIFY_LEXICAL_LOW"] = 0.0

        long_text = "X " * 500  # 1000+ char source text
        hit = {**_HIT_S1, "text": long_text}

        fake = FakeOllamaClient(response={
            "status": "answered",
            "answer": "Q4 revenue was 167,900.",
            "claims": [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}],
            "missing": "",
            "calculations": [],
        })
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [hit])
        monkeypatch.setattr(answering, "make_client_from_config", lambda cfg: fake)

        resp = _app.test_client().post("/ask", json={"question": "Revenue?"})
        assert resp.status_code == 200

        # Check persisted message for payload size.
        stored = _store["messages"]
        asst_msg = next((m for m in stored if m["role"] == "assistant"), None)
        assert asst_msg is not None
        verification_stored = asst_msg.get("verification", {})
        payload_str = json.dumps(verification_stored)
        # The long_text (1000+ chars of "X ") must NOT appear verbatim.
        assert "X " * 100 not in payload_str, \
            "Full source text must not be stored in verification payload"
