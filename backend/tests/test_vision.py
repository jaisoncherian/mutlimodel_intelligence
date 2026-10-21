"""Phase 4C tests: multimodal vision support for charts and figures.

Tests:
1. Routing keywords (question keywords & chunk figure mentions).
2. Limit of 2 pages (and prioritising pages mentioning figures).
3. Resizing (downscale to <= 1024 px, preserving smaller images, aspect ratio).
4. IMG citation mapping (content_type='image', page number, no URL, used_vision=True).
5. The flag (VISION_ENABLED=false skips vision even on visual queries).
6. Fetch failure falls back to text safely (no crash, used_vision=False).
7. The calculator refuses chart-only operands.

Run with:
    cd backend
    .venv\\Scripts\\python.exe -m pytest tests/test_vision.py -v
"""

from __future__ import annotations

import io
import json
from typing import Any
from uuid import UUID, uuid4

import pytest
from PIL import Image

from app import create_app
from app.repositories import conversations as conv_repo
from app.services import answering, calculator, search as search_service, vision
from app.services.llm import OllamaError


# ---------------------------------------------------------------------------
# Test Helpers & Fixtures
# ---------------------------------------------------------------------------

DOC_ID = uuid4()
DOC_ID2 = uuid4()


def _make_png_bytes(width: int = 100, height: int = 100, color: tuple = (255, 0, 0)) -> bytes:
    """Create in-memory PNG bytes for testing image manipulation."""
    img = Image.new("RGB", (width, height), color=color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


class FakeOllamaClient:
    """Configurable fake client that records chat invocations."""

    def __init__(self, response: dict[str, Any] | None = None, raise_error: str | None = None):
        self.calls: list[dict[str, Any]] = []
        self._response = response or {
            "status": "answered",
            "answer": "The chart shows quarterly growth.",
            "claims": [{"text": "Growth was positive", "sources": ["IMG1"]}],
            "missing": "",
            "calculations": [],
        }
        self._raise_error = raise_error

    def chat(self, messages, schema=None, images=None, num_predict=700):
        self.calls.append({"messages": messages, "schema": schema, "images": images})
        if self._raise_error:
            raise OllamaError(self._raise_error)
        return json.dumps(self._response), {"prompt_eval_count": 40, "eval_count": 25}


@pytest.fixture
def app(monkeypatch):
    """Flask test app with DB repository mocked out."""
    _app = create_app({
        "TESTING": True,
        "DATABASE_URL": "",
        "MIN_SIMILARITY": 0.15,
        "VISION_ENABLED": True,
        # VERIFY_MODE=off: Phase 4C tests must not be affected by the Phase 5A
        # verification layer. Tests exercising verification use their own fixtures.
        "VERIFY_MODE": "off",
    })

    store: dict[str, Any] = {"convs": {}, "messages": [], "citations": []}

    def fake_create_conv(title, user_id=None):
        cid = uuid4()
        store["convs"][str(cid)] = {"id": cid, "title": title}
        return cid

    def fake_get_conv(cid):
        return store["convs"].get(str(cid))

    def fake_insert_message(conversation_id, role, content, verification=None, used_vision=False):
        mid = len(store["messages"]) + 1
        store["messages"].append({
            "id": mid,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "verification": verification,
            "used_vision": used_vision,
        })
        return mid

    def fake_insert_citations(message_id, citations):
        store["citations"].extend(citations)

    monkeypatch.setattr(conv_repo, "create_conversation", fake_create_conv)
    monkeypatch.setattr(conv_repo, "get_conversation", fake_get_conv)
    monkeypatch.setattr(conv_repo, "insert_message", fake_insert_message)
    monkeypatch.setattr(conv_repo, "insert_citations", fake_insert_citations)

    # Attach store to app for inspection in tests
    _app._db_store = store
    return _app


# ---------------------------------------------------------------------------
# 1. Routing Keywords Tests
# ---------------------------------------------------------------------------

class TestRoutingKeywords:
    @pytest.mark.parametrize(
        "keyword",
        [
            "chart", "graph", "figure", "plot", "diagram",
            "trend", "curve", "bar", "line", "pie",
            "axis", "legend", "image", "picture", "shown in",
        ],
    )
    def test_visual_keyword_triggers_vision(self, keyword):
        q = f"What does the {keyword} indicate about revenue?"
        assert vision.needs_vision(q, hits=[]) is True

    def test_figure_in_chunk_triggers_vision(self):
        q = "What is the breakdown of revenue?"
        hits = [
            {"text": "Total revenue is summarised in Figure 3."},
            {"text": "Operating income remained steady."},
        ]
        assert vision.needs_vision(q, hits=hits) is True

    def test_fig_abbr_in_chunk_triggers_vision(self):
        q = "What is the operating margin?"
        hits = [
            {"text": "See Fig. 2 for operating margin by quarter."},
        ]
        assert vision.needs_vision(q, hits=hits) is True

    def test_plain_question_and_plain_chunks_do_not_trigger_vision(self):
        q = "What was the total revenue in 2023?"
        hits = [
            {"text": "The total revenue for 2023 was $1,500,000."},
            {"text": "Net income was $300,000."},
        ]
        assert vision.needs_vision(q, hits=hits) is False


# ---------------------------------------------------------------------------
# 2. Limit of 2 Pages & Prioritisation Tests
# ---------------------------------------------------------------------------

class TestPageSelection:
    def test_limit_of_2_pages(self):
        hits = [
            {"doc_id": DOC_ID, "page_number": 1, "filename": "doc.pdf", "text": "Page 1 content"},
            {"doc_id": DOC_ID, "page_number": 2, "filename": "doc.pdf", "text": "Page 2 content"},
            {"doc_id": DOC_ID, "page_number": 3, "filename": "doc.pdf", "text": "Page 3 content"},
            {"doc_id": DOC_ID, "page_number": 4, "filename": "doc.pdf", "text": "Page 4 content"},
        ]
        selected = vision.select_vision_pages(hits, max_pages=2)
        assert len(selected) == 2
        assert [p["page_number"] for p in selected] == [1, 2]

    def test_prefers_pages_with_figures(self):
        hits = [
            {"doc_id": DOC_ID, "page_number": 1, "filename": "doc.pdf", "text": "Overview of financial performance."},
            {"doc_id": DOC_ID, "page_number": 2, "filename": "doc.pdf", "text": "General notes on tax expenses."},
            {"doc_id": DOC_ID, "page_number": 3, "filename": "doc.pdf", "text": "As illustrated in Figure 1, sales peaked in Q4."},
            {"doc_id": DOC_ID, "page_number": 4, "filename": "doc.pdf", "text": "Details in Fig. 4 regarding operating costs."},
        ]
        selected = vision.select_vision_pages(hits, max_pages=2)
        assert len(selected) == 2
        # Pages 3 and 4 mention figures, so they must be prioritised over pages 1 and 2
        pages = [p["page_number"] for p in selected]
        assert pages == [3, 4]

    def test_deduplicates_same_doc_and_page(self):
        hits = [
            {"doc_id": DOC_ID, "page_number": 2, "filename": "doc.pdf", "text": "First chunk on page 2"},
            {"doc_id": DOC_ID, "page_number": 2, "filename": "doc.pdf", "text": "Second chunk on page 2 (Figure 1)"},
            {"doc_id": DOC_ID, "page_number": 5, "filename": "doc.pdf", "text": "Chunk on page 5"},
        ]
        selected = vision.select_vision_pages(hits, max_pages=2)
        assert len(selected) == 2
        assert selected[0]["page_number"] == 2
        assert selected[0]["has_figure"] is True
        assert selected[1]["page_number"] == 5

    def test_empty_hits(self):
        assert vision.select_vision_pages([]) == []


# ---------------------------------------------------------------------------
# 3. Image Resizing & Encoding Tests
# ---------------------------------------------------------------------------

class TestImageResizing:
    def test_downscales_large_image(self):
        raw_png = _make_png_bytes(width=2000, height=1000)
        resized_bytes = vision.downscale_image(raw_png, max_edge=1024)

        with Image.open(io.BytesIO(resized_bytes)) as img:
            assert max(img.width, img.height) <= 1024
            assert img.width == 1024
            assert img.height == 512
            assert img.format == "PNG"

    def test_preserves_smaller_image(self):
        raw_png = _make_png_bytes(width=600, height=400)
        resized_bytes = vision.downscale_image(raw_png, max_edge=1024)

        with Image.open(io.BytesIO(resized_bytes)) as img:
            assert img.width == 600
            assert img.height == 400

    def test_encode_image_base64(self):
        raw_png = _make_png_bytes(width=50, height=50)
        b64 = vision.encode_image_base64(raw_png)
        assert isinstance(b64, str)
        assert len(b64) > 0


# ---------------------------------------------------------------------------
# 4. IMG Citation Mapping Tests
# ---------------------------------------------------------------------------

class TestImageCitationMapping:
    def test_img_citation_mapping_and_used_vision(self, app, monkeypatch):
        test_png = _make_png_bytes(width=200, height=200)

        hits = [
            {
                "chunk_id": 1,
                "doc_id": DOC_ID,
                "filename": "report.pdf",
                "page_number": 5,
                "section": "Charts",
                "content_type": "text",
                "table_index": None,
                "text": "See Figure 2 for revenue trends.",
                "scores": {"rrf": 0.016, "vector_similarity": 0.85},
            }
        ]
        monkeypatch.setattr(search_service, "search", lambda **kw: hits)

        fake_model = FakeOllamaClient(
            response={
                "status": "answered",
                "answer": "Revenue trended upward in Q4 according to the chart.",
                "claims": [
                    {"text": "Revenue trended upward in Q4", "sources": ["IMG1"]},
                ],
                "missing": "",
                "calculations": [],
            }
        )

        fake_download = lambda bucket, path: test_png

        with app.app_context():
            result = answering.answer_question(
                question="What does the revenue trend chart show?",
                doc_ids=[DOC_ID],
                conversation_id=None,
                k=8,
                ollama_client=fake_model,
                storage_download_fn=fake_download,
            )

        # 1. used_vision must be True
        assert result["used_vision"] is True

        # 2. Citations must map IMG1 to content_type="image" and page=5
        assert len(result["citations"]) == 1
        cit = result["citations"][0]
        assert cit["source_id"] == "IMG1"
        assert cit["content_type"] == "image"
        assert cit["page"] == 5
        assert cit["doc_id"] == str(DOC_ID)
        assert "http" not in cit.get("snippet", "")

        # 3. Model call received images
        assert len(fake_model.calls) >= 1
        assert fake_model.calls[0]["images"] is not None
        assert len(fake_model.calls[0]["images"]) == 1

        # 4. DB store verification
        db_messages = app._db_store["messages"]
        assert len(db_messages) == 2  # user + assistant
        assert db_messages[1]["used_vision"] is True

        db_citations = app._db_store["citations"]
        assert len(db_citations) == 1
        assert db_citations[0]["content_type"] == "image"
        assert db_citations[0]["page_number"] == 5


# ---------------------------------------------------------------------------
# 5. Flag (VISION_ENABLED=false) Tests
# ---------------------------------------------------------------------------

class TestVisionFlag:
    def test_vision_disabled_by_config(self, app, monkeypatch):
        app.config["VISION_ENABLED"] = False

        hits = [
            {
                "chunk_id": 1,
                "doc_id": DOC_ID,
                "filename": "report.pdf",
                "page_number": 3,
                "section": "Charts",
                "content_type": "text",
                "table_index": None,
                "text": "Figure 1 shows growth.",
                "scores": {"rrf": 0.016, "vector_similarity": 0.85},
            }
        ]
        monkeypatch.setattr(search_service, "search", lambda **kw: hits)

        storage_called = False

        def fake_download(bucket, path):
            nonlocal storage_called
            storage_called = True
            return _make_png_bytes()

        fake_model = FakeOllamaClient(
            response={
                "status": "answered",
                "answer": "Growth was reported.",
                "claims": [{"text": "Growth was reported", "sources": ["S1"]}],
                "missing": "",
                "calculations": [],
            }
        )

        with app.app_context():
            result = answering.answer_question(
                question="Explain the growth chart in Figure 1",
                doc_ids=[DOC_ID],
                conversation_id=None,
                k=8,
                ollama_client=fake_model,
                storage_download_fn=fake_download,
            )

        assert storage_called is False
        assert result["used_vision"] is False
        assert fake_model.calls[0]["images"] is None


# ---------------------------------------------------------------------------
# 6. Fetch Failure Fallback Tests
# ---------------------------------------------------------------------------

class TestFetchFailureFallback:
    def test_storage_failure_falls_back_to_text(self, app, monkeypatch):
        hits = [
            {
                "chunk_id": 1,
                "doc_id": DOC_ID,
                "filename": "report.pdf",
                "page_number": 2,
                "section": "Financials",
                "content_type": "text",
                "table_index": None,
                "text": "Figure 2 plot shows stability.",
                "scores": {"rrf": 0.016, "vector_similarity": 0.85},
            }
        ]
        monkeypatch.setattr(search_service, "search", lambda **kw: hits)

        def failing_download(bucket, path):
            raise RuntimeError("Storage service down")

        fake_model = FakeOllamaClient(
            response={
                "status": "answered",
                "answer": "Financials are stable.",
                "claims": [{"text": "Financials are stable", "sources": ["S1"]}],
                "missing": "",
                "calculations": [],
            }
        )

        with app.app_context():
            result = answering.answer_question(
                question="What does the plot show?",
                doc_ids=[DOC_ID],
                conversation_id=None,
                k=8,
                ollama_client=fake_model,
                storage_download_fn=failing_download,
            )

        # Must fall back to text gracefully, without crashing
        assert result["used_vision"] is False
        assert result["status"] == "answered"
        assert fake_model.calls[0]["images"] is None


# ---------------------------------------------------------------------------
# 7. Calculator Refuses Chart-Only Operands
# ---------------------------------------------------------------------------

class TestCalculatorRefusesChartOperands:
    def test_chart_operand_rejected(self):
        hits = [
            {
                "source_id": "S1",
                "text": "The textual report does not state Q1 revenue.",
            }
        ]
        planned = [
            {
                "id": "c1",
                "operation": "add",
                "operands": [
                    {"label": "Chart Q1", "value_text": "125,000", "source": "IMG1"},
                    {"label": "Chart Q2", "value_text": "150,000", "source": "IMG2"},
                ],
                "unit": "USD",
            }
        ]

        verified, rejected = calculator.run_calculations(planned, hits)
        assert len(verified) == 0
        assert len(rejected) == 1
        assert rejected[0]["id"] == "c1"
        assert "chart" in rejected[0]["reason"].lower() or "img" in rejected[0]["reason"].lower()

    def test_mixed_chart_and_text_operand_rejected(self):
        hits = [
            {
                "source_id": "S1",
                "text": "The textual report says base was 100,000.",
            }
        ]
        planned = [
            {
                "id": "c2",
                "operation": "percent_change",
                "operands": [
                    {"label": "Base", "value_text": "100,000", "source": "S1"},
                    {"label": "Estimated", "value_text": "140,000", "source": "IMG1"},
                ],
                "unit": "%",
            }
        ]

        verified, rejected = calculator.run_calculations(planned, hits)
        assert len(verified) == 0
        assert len(rejected) == 1
        assert rejected[0]["id"] == "c2"
