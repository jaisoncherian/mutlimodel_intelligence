"""Fetch real responses from the Flask application and save them as JSON fixtures in frontend/src/test/fixtures/."""

from __future__ import annotations

import json
from pathlib import Path
import sys
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import create_app

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "frontend" / "src" / "test" / "fixtures"
FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

app = create_app()
client = app.test_client()

def save_fixture(filename: str, data: any) -> None:
    filepath = FIXTURES_DIR / filename
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"Saved: {filename}")

# 1. GET /documents
resp = client.get("/documents")
assert resp.status_code == 200, f"GET /documents failed: {resp.status_code}"
docs = resp.get_json()
save_fixture("documents.json", docs)

# Pick a document ID (text_table.pdf if available)
doc_id = None
for d in docs:
    if d.get("filename") == "text_table.pdf" and d.get("status") == "ready":
        doc_id = d.get("id")
        break
if not doc_id:
    doc_id = docs[0]["id"]

print(f"Using doc_id: {doc_id}")

# 2. GET /documents/<id>
resp = client.get(f"/documents/{doc_id}")
assert resp.status_code == 200
save_fixture("document_details.json", resp.get_json())

# 3. GET /documents/<id>/pages/3 (or 1)
resp = client.get(f"/documents/{doc_id}/pages/3")
if resp.status_code != 200:
    resp = client.get(f"/documents/{doc_id}/pages/1")
assert resp.status_code == 200
save_fixture("document_page.json", resp.get_json())

# 4. GET /documents/<id>/pages/3/image (or 1)
resp = client.get(f"/documents/{doc_id}/pages/3/image")
if resp.status_code != 200:
    resp = client.get(f"/documents/{doc_id}/pages/1/image")
assert resp.status_code == 200
save_fixture("page_image.json", resp.get_json())

# 5. GET /conversations
resp = client.get("/conversations")
assert resp.status_code == 200
conversations = resp.get_json()
save_fixture("conversations.json", conversations)

# 6. GET /conversations/<id>/messages
conv_id = conversations[0]["id"] if conversations else None
if conv_id:
    resp = client.get(f"/conversations/{conv_id}/messages")
    assert resp.status_code == 200
    save_fixture("conversation_messages.json", resp.get_json())

# 7. Error responses
# 400 Bad Request
resp = client.post("/ask", json={"question": ""})
assert resp.status_code == 400
save_fixture("error_400.json", resp.get_json())

# 404 Not Found
resp = client.get("/documents/00000000-0000-0000-0000-000000000000")
assert resp.status_code == 404
save_fixture("error_404.json", resp.get_json())

# 503 Busy / Unavailable
save_fixture("error_503.json", {"error": "The model is busy, please retry."})

print("Standard fixtures saved. Now querying /ask variants...")

# 8. POST /ask - insufficient_evidence
resp = client.post("/ask", json={"question": "What was the revenue in Q5 2099?"})
assert resp.status_code == 200
save_fixture("ask_insufficient_evidence.json", resp.get_json())

# 9. POST /ask - calculation & answered
resp = client.post("/ask", json={
    "question": "What was the percentage revenue growth from Q1 to Q4?",
    "doc_ids": [doc_id]
})
assert resp.status_code == 200
data_calc = resp.get_json()
save_fixture("ask_calculation.json", data_calc)
if data_calc.get("status") == "answered":
    save_fixture("ask_answered.json", data_calc)

# If ask_answered not yet saved separately
if not (FIXTURES_DIR / "ask_answered.json").exists():
    resp = client.post("/ask", json={
        "question": "What was the revenue in Q1 2025?",
        "doc_ids": [doc_id]
    })
    if resp.status_code == 200:
        save_fixture("ask_answered.json", resp.get_json())

# 10. POST /ask - partial
# Asking for both Q1 (exists) and Q5 (missing)
resp = client.post("/ask", json={
    "question": "What was the revenue in Q1 2025, and what was the projected revenue in Q5 2025?",
    "doc_ids": [doc_id]
})
if resp.status_code == 200:
    data_partial = resp.get_json()
    save_fixture("ask_partial.json", data_partial)

print("All fixtures successfully captured!")
