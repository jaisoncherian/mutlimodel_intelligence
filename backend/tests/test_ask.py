"""Phase 4A tests: /ask endpoint, citation logic, deduplication, guards.

All tests use a fake OllamaClient injected via monkeypatch.
No real database, no real Ollama, no torch required.

Run with:
    cd backend && python -m pytest tests/test_ask.py -v
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID, uuid4

import pytest

from app import create_app
from app.repositories import conversations as conv_repo
from app.services import answering, search as search_service
from app.services.llm import OllamaClient, OllamaError


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

DOC_ID = uuid4()
DOC_ID2 = uuid4()

_BASE_HIT = {
    "chunk_id": 1,
    "doc_id": DOC_ID,
    "filename": "report.pdf",
    "page_number": 3,
    "section": "Revenue",
    "content_type": "text",
    "table_index": None,
    "text": "The Q1 revenue was 125,400.",
    "scores": {"rrf": 0.016, "vector_similarity": 0.82, "vector_rank": 1, "keyword_rank": None},
}


def _good_model_response(status: str = "answered") -> dict[str, Any]:
    return {
        "status": status,
        "answer": "Q1 revenue was 125,400.",
        "claims": [{"text": "Q1 revenue was 125,400.", "sources": ["S1"]}],
        "missing": "",
    }


class FakeOllamaClient:
    """Configurable fake that records calls and returns canned responses."""

    def __init__(self, response: dict[str, Any] | None = None, raise_error: str | None = None):
        self.calls: list[dict[str, Any]] = []
        self._response = response or _good_model_response()
        self._raise_error = raise_error

    def chat(self, messages, schema=None, images=None, num_predict=700):
        self.calls.append({"messages": messages, "schema": schema})
        if self._raise_error:
            raise OllamaError(self._raise_error)
        return json.dumps(self._response), {"prompt_eval_count": 50, "eval_count": 30}


@pytest.fixture
def app(monkeypatch):
    """Flask test app with DB and conversation repo mocked out."""
    _app = create_app({"TESTING": True, "DATABASE_URL": "", "MIN_SIMILARITY": 0.15})

    # --- Mock conversation repo ---
    _store: dict[str, Any] = {"convs": {}, "messages": [], "citations": []}

    def fake_create_conv(title, user_id=None):
        cid = uuid4()
        _store["convs"][str(cid)] = {"id": cid, "title": title}
        return cid

    def fake_get_conv(cid):
        return _store["convs"].get(str(cid))

    def fake_insert_message(conversation_id, role, content, verification=None, used_vision=False):
        mid = len(_store["messages"]) + 1
        _store["messages"].append(
            {"id": mid, "conversation_id": conversation_id, "role": role, "content": content}
        )
        return mid

    def fake_insert_citations(message_id, citations):
        _store["citations"].extend(citations)

    monkeypatch.setattr(conv_repo, "create_conversation", fake_create_conv)
    monkeypatch.setattr(conv_repo, "get_conversation", fake_get_conv)
    monkeypatch.setattr(conv_repo, "insert_message", fake_insert_message)
    monkeypatch.setattr(conv_repo, "insert_citations", fake_insert_citations)

    _app._test_store = _store
    return _app, _store


# ---------------------------------------------------------------------------
# Input validation
# ---------------------------------------------------------------------------

class TestInputValidation:
    def test_missing_question_returns_400(self, app):
        _app, _ = app
        resp = _app.test_client().post("/ask", json={})
        assert resp.status_code == 400

    def test_empty_question_returns_400(self, app):
        _app, _ = app
        resp = _app.test_client().post("/ask", json={"question": "  "})
        assert resp.status_code == 400

    def test_question_too_long_returns_400(self, app):
        _app, _ = app
        resp = _app.test_client().post("/ask", json={"question": "x" * 1001})
        assert resp.status_code == 400

    def test_invalid_k_returns_400(self, app):
        _app, _ = app
        resp = _app.test_client().post("/ask", json={"question": "hi", "k": "bad"})
        assert resp.status_code == 400

    def test_invalid_doc_ids_returns_400(self, app):
        _app, _ = app
        resp = _app.test_client().post("/ask", json={"question": "hi", "doc_ids": ["not-uuid"]})
        assert resp.status_code == 400

    def test_invalid_conversation_id_returns_400(self, app):
        _app, _ = app
        resp = _app.test_client().post(
            "/ask", json={"question": "hi", "conversation_id": "not-uuid"}
        )
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# Similarity guard
# ---------------------------------------------------------------------------

class TestSimilarityGuard:
    def test_below_min_similarity_skips_model(self, app, monkeypatch):
        """When best vector_similarity < MIN_SIMILARITY the model is NOT called."""
        _app, _ = app
        fake = FakeOllamaClient()

        low_hit = {**_BASE_HIT, "scores": {**_BASE_HIT["scores"], "vector_similarity": 0.10}}
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [low_hit])
        monkeypatch.setattr(answering, "make_client_from_config", lambda cfg: fake)

        with _app.app_context():
            result = answering.answer_question("What is revenue?", None, None, 8, fake)

        assert result["status"] == "insufficient_evidence"
        assert fake.calls == []  # model was never called

    def test_null_similarity_does_not_block(self, app, monkeypatch):
        """Keyword-only hits (vector_similarity=None) must NOT trigger the guard."""
        _app, _ = app
        fake = FakeOllamaClient()

        keyword_only_hit = {
            **_BASE_HIT,
            "scores": {
                "rrf": 0.016,
                "vector_similarity": None,   # keyword-only hit
                "vector_rank": None,
                "keyword_rank": 1,
            },
        }
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [keyword_only_hit])
        monkeypatch.setattr(answering, "make_client_from_config", lambda cfg: fake)

        with _app.app_context():
            result = answering.answer_question("What is revenue?", None, None, 8, fake)

        assert len(fake.calls) == 1  # model was called
        assert result["status"] == "answered"

    def test_no_hits_returns_insufficient_evidence(self, app, monkeypatch):
        _app, _ = app
        fake = FakeOllamaClient()
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [])
        monkeypatch.setattr(answering, "make_client_from_config", lambda cfg: fake)

        with _app.app_context():
            result = answering.answer_question("What?", None, None, 8, fake)

        assert result["status"] == "insufficient_evidence"
        assert fake.calls == []


# ---------------------------------------------------------------------------
# Citation validation
# ---------------------------------------------------------------------------

class TestCitationValidation:
    def test_unknown_source_ids_are_dropped(self, app, monkeypatch):
        """The model cites S99 which does not exist in our sources; it must be removed."""
        _app, _ = app
        bad_response = {
            "status": "answered",
            "answer": "Revenue was 125,400.",
            "claims": [{"text": "Revenue was 125,400.", "sources": ["S1", "S99"]}],
            "missing": "",
        }
        fake = FakeOllamaClient(response=bad_response)
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [_BASE_HIT])

        with _app.app_context():
            result = answering.answer_question("Revenue?", None, None, 8, fake)

        # S99 must be gone; S1 must remain.
        for claim in result.get("citations", []):
            assert claim.get("source_id") != "S99"
        assert any(c["source_id"] == "S1" for c in result["citations"])

    def test_zero_valid_citations_becomes_insufficient(self, app, monkeypatch):
        """Model says 'answered' but all cited IDs are invalid → insufficient_evidence."""
        _app, _ = app
        all_bad = {
            "status": "answered",
            "answer": "Revenue was X.",
            "claims": [{"text": "Revenue was X.", "sources": ["S99", "S100"]}],
            "missing": "",
        }
        fake = FakeOllamaClient(response=all_bad)
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [_BASE_HIT])

        with _app.app_context():
            result = answering.answer_question("Revenue?", None, None, 8, fake)

        assert result["status"] == "insufficient_evidence"
        assert result["citations"] == []

    def test_citation_mapping_uses_correct_source(self, app, monkeypatch):
        """Citations in the response must match the chunk's metadata."""
        _app, _ = app
        fake = FakeOllamaClient()
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [_BASE_HIT])

        with _app.app_context():
            result = answering.answer_question("Revenue?", None, None, 8, fake)

        assert result["citations"][0]["source_id"] == "S1"
        assert result["citations"][0]["page"] == 3
        assert result["citations"][0]["filename"] == "report.pdf"
        assert result["citations"][0]["section"] == "Revenue"
        assert "125,400" in result["citations"][0]["snippet"]

    def test_citation_snippet_preserves_full_quarterly_table_up_to_400_chars(self, app, monkeypatch):
        """A 300-char table containing Q1 through Q4 must retain Q4 in the citation snippet."""
        _app, _ = app
        table_text = (
            "Quarter | Revenue (USD) | Operating Cost (USD) | Units Produced\n"
            "Q1 2025 | 125,400 | 83,200 | 4,850\n"
            "Q2 2025 | 138,750 | 91,100 | 5,120\n"
            "Q3 2025 | 152,300 | 99,800 | 5,480\n"
            "Q4 2025 | 167,900 | 108,400 | 5,940"
        )
        assert len(table_text) > 200  # Previously truncated at 200 chars!
        assert len(table_text) <= 400

        table_hit = {
            **_BASE_HIT,
            "text": table_text,
            "content_type": "table",
        }
        fake = FakeOllamaClient(response={
            "status": "answered",
            "answer": "Q4 revenue was 167,900, cost was 108,400, and units were 5,940.",
            "claims": [{"text": "Q4 numbers", "sources": ["S1"]}],
            "missing": "",
        })
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [table_hit])

        with _app.app_context():
            result = answering.answer_question("Q4 2025 numbers?", None, None, 8, fake)

        snippet = result["citations"][0]["snippet"]
        assert "Q4 2025" in snippet
        assert "167,900" in snippet
        assert "108,400" in snippet
        assert "5,940" in snippet

    def test_status_partial_with_none_missing_normalized_to_answered(self, app, monkeypatch):
        """When model outputs status='partial' but missing is 'None' and claims exist,
        normalize to 'answered'."""
        _app, _ = app
        fake = FakeOllamaClient(response={
            "status": "partial",
            "answer": "Q4 2025 revenue was 167,900.",
            "claims": [{"text": "Q4 revenue was 167,900.", "sources": ["S1"]}],
            "missing": "None",
        })
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [_BASE_HIT])

        with _app.app_context():
            result = answering.answer_question("Q4 2025?", None, None, 8, fake)

        assert result["status"] == "answered"
        assert result["missing"] is None  # Normalized to None, not literal string 'None'

    def test_q5_absent_returns_insufficient_evidence(self, app, monkeypatch):
        """When asking for Q5 which is absent in the document, status is insufficient_evidence."""
        _app, _ = app
        fake = FakeOllamaClient(response={
            "status": "insufficient_evidence",
            "answer": "Q5 2025 is not reported in the document.",
            "claims": [],
            "missing": "Q5 2025 data",
        })
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [_BASE_HIT])

        with _app.app_context():
            result = answering.answer_question("What was revenue in Q5 2025?", None, None, 8, fake)

        assert result["status"] == "insufficient_evidence"
        assert result["missing"] == "Q5 2025 data"

    def test_unresolved_placeholders_in_final_answer_downgrades_to_partial(self, app, monkeypatch):
        """If placeholders remain unresolved in the final answer, status must NEVER be 'answered'."""
        _app, _ = app
        # Fake client where Pass 1 has an unresolved placeholder in answer and no matching calculation
        fake = FakeOllamaClient(response={
            "status": "answered",
            "answer": "Revenue in Q1 was {c1} USD and cost was {c2} USD.",
            "claims": [{"text": "Revenue and cost", "sources": ["S1"]}],
            "missing": "",
            "calculations": [],
        })
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [_BASE_HIT])

        with _app.app_context():
            result = answering.answer_question("Compare Q1 and Q4?", None, None, 8, fake)

        # Must never return status: "answered" with unresolved placeholders
        assert result["status"] == "partial"
        assert "{c1}" in result["missing"]
        assert "{c2}" in result["missing"]

    def test_successful_placeholder_resolution_returns_answered_and_missing_none(self, app, monkeypatch):
        """When calculations verify and placeholders are resolved, status is 'answered' and missing is None."""
        _app, _ = app
        hit = {**_BASE_HIT, "text": "Q1 revenue: 100. Q4 revenue: 160."}
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [hit])

        call_idx = 0
        class TwoPassClient:
            def chat(self, messages, schema=None, images=None, num_predict=700):
                nonlocal call_idx
                call_idx += 1
                if call_idx == 1:
                    # Pass 1: plans calculation
                    return json.dumps({
                        "status": "answered",
                        "answer": "Revenue grew by 60.",
                        "claims": [{"text": "Revenue grew", "sources": ["S1"]}],
                        "missing": "None",
                        "calculations": [
                            {
                                "id": "c1",
                                "operation": "subtract",
                                "operands": [
                                    {"label": "Q4", "value_text": "160", "source": "S1"},
                                    {"label": "Q1", "value_text": "100", "source": "S1"},
                                ],
                                "unit": "USD",
                            }
                        ],
                    }), {"prompt_eval_count": 50, "eval_count": 30}
                else:
                    # Pass 2: composes answer with placeholder
                    return json.dumps({
                        "answer": "The increase in revenue was {c1}.",
                        "claims": [{"text": "Revenue increase", "sources": ["S1"]}],
                        "missing": "",
                    }), {"prompt_eval_count": 50, "eval_count": 30}

        with _app.app_context():
            result = answering.answer_question("Revenue difference?", None, None, 8, TwoPassClient())

        assert result["status"] == "answered"
        assert result["missing"] is None
        assert "{c1}" not in result["answer"]
        assert "60 USD" in result["answer"]

    def test_pass2_unresolved_placeholders_falls_back_to_pass1_clean_answer(self, app, monkeypatch):
        """If Pass 2 invents unresolved placeholders, system falls back to Pass 1 verified source values."""
        _app, _ = app
        hit = {**_BASE_HIT, "text": "Q1 revenue: 125,400. Q4 revenue: 167,900."}
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [hit])

        call_idx = 0
        class FallbackClient:
            def chat(self, messages, schema=None, images=None, num_predict=700):
                nonlocal call_idx
                call_idx += 1
                if call_idx == 1:
                    # Pass 1: complete verified answer
                    return json.dumps({
                        "status": "answered",
                        "answer": "In Q1 revenue was 125,400 and in Q4 revenue was 167,900.",
                        "claims": [{"text": "Revenues", "sources": ["S1"]}],
                        "missing": "",
                        "calculations": [
                            {
                                "id": "c1",
                                "operation": "subtract",
                                "operands": [
                                    {"label": "Q4", "value_text": "167,900", "source": "S1"},
                                    {"label": "Q1", "value_text": "125,400", "source": "S1"},
                                ],
                                "unit": "USD",
                            }
                        ],
                    }), {"prompt_eval_count": 50, "eval_count": 30}
                else:
                    # Pass 2: broken with invented placeholders {c1}, {c2}, {c3}, {c4}
                    return json.dumps({
                        "answer": "In Q1 revenue was {c1} and cost was {c2}. In Q4 revenue was {c3} and cost was {c4}.",
                        "claims": [{"text": "Revenues", "sources": ["S1"]}],
                        "missing": "{c1}, {c2}, {c3}, {c4}",
                    }), {"prompt_eval_count": 50, "eval_count": 30}

        with _app.app_context():
            result = answering.answer_question("Compare Q1 and Q4?", None, None, 8, FallbackClient())

        # Should fall back to Pass 1 clean answer
        assert result["status"] == "answered"
        assert result["missing"] is None
        assert "{c2}" not in result["answer"]
        assert "{c3}" not in result["answer"]
        assert "125,400" in result["answer"]
        assert "167,900" in result["answer"]


# ---------------------------------------------------------------------------
# Deduplication
# ---------------------------------------------------------------------------

class TestDeduplication:
    def test_identical_text_chunks_collapse_with_also_in(self, app, monkeypatch):
        """Two chunks with the same normalised text keep the first; the second's
        filename is recorded in also_in."""
        _app, _ = app
        hit1 = {**_BASE_HIT, "chunk_id": 1, "filename": "text_table.pdf"}
        hit2 = {
            **_BASE_HIT,
            "chunk_id": 2,
            "filename": "scan.pdf",
            # Same text as hit1 → should be collapsed.
        }
        fake = FakeOllamaClient()
        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [hit1, hit2])

        with _app.app_context():
            result = answering.answer_question("Revenue?", None, None, 8, fake)

        # Only one citation should exist (S1).
        assert len(result["citations"]) == 1
        assert "scan.pdf" in result["citations"][0]["also_in"]


# ---------------------------------------------------------------------------
# Ollama error handling
# ---------------------------------------------------------------------------

class TestOllamaErrors:
    def test_ollama_unreachable_returns_503(self, app, monkeypatch):
        _app, _ = app
        monkeypatch.setattr(
            search_service,
            "search",
            lambda *a, **kw: [{**_BASE_HIT}],
        )
        monkeypatch.setattr(
            answering,
            "make_client_from_config",
            lambda cfg: FakeOllamaClient(raise_error="Ollama unreachable"),
        )
        resp = _app.test_client().post("/ask", json={"question": "Revenue?"})
        assert resp.status_code == 503

    def test_semaphore_timeout_returns_503(self, app, monkeypatch):
        _app, _ = app
        monkeypatch.setattr(
            search_service,
            "search",
            lambda *a, **kw: [{**_BASE_HIT}],
        )
        monkeypatch.setattr(
            answering,
            "make_client_from_config",
            lambda cfg: FakeOllamaClient(raise_error="semaphore_timeout"),
        )
        resp = _app.test_client().post("/ask", json={"question": "Revenue?"})
        assert resp.status_code == 503
        assert "busy" in resp.get_json()["error"].lower()

    def test_malformed_json_retries_then_fails_safely(self, app, monkeypatch):
        """When the model returns invalid JSON twice, the response is insufficient_evidence."""
        _app, _ = app
        call_count = 0

        class BadJsonClient:
            def chat(self, messages, schema=None, images=None, num_predict=700):
                nonlocal call_count
                call_count += 1
                return "not-json {{{{", {"prompt_eval_count": 10, "eval_count": 5}

        monkeypatch.setattr(search_service, "search", lambda *a, **kw: [{**_BASE_HIT}])

        with _app.app_context():
            result = answering.answer_question("Revenue?", None, None, 8, BadJsonClient())

        # Should have been called twice (initial + retry).
        assert call_count == 2
        assert result["status"] == "insufficient_evidence"


# ---------------------------------------------------------------------------
# Conversation management endpoints
# ---------------------------------------------------------------------------

class TestConversationEndpoints:
    def test_list_conversations_returns_200(self, app, monkeypatch):
        _app, _ = app
        monkeypatch.setattr(conv_repo, "list_conversations", lambda: [])
        resp = _app.test_client().get("/conversations")
        assert resp.status_code == 200
        assert resp.get_json() == []

    def test_get_messages_404_for_unknown_conversation(self, app, monkeypatch):
        _app, _ = app
        monkeypatch.setattr(conv_repo, "get_conversation", lambda cid: None)
        resp = _app.test_client().get(f"/conversations/{uuid4()}/messages")
        assert resp.status_code == 404

    def test_delete_conversation_returns_200(self, app, monkeypatch):
        _app, store = app
        cid = uuid4()
        store["convs"][str(cid)] = {"id": cid, "title": "test"}

        deleted = []
        monkeypatch.setattr(conv_repo, "delete_conversation", lambda c: deleted.append(c))

        resp = _app.test_client().delete(f"/conversations/{cid}")
        assert resp.status_code == 200
        assert resp.get_json() == {"deleted": True}

    def test_delete_unknown_conversation_returns_404(self, app, monkeypatch):
        _app, _ = app
        monkeypatch.setattr(conv_repo, "get_conversation", lambda c: None)
        resp = _app.test_client().delete(f"/conversations/{uuid4()}")
        assert resp.status_code == 404
